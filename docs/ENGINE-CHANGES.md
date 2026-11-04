# Changes the game needs

Everything the game itself (`liminal-hq/lieutenant-fizz`) must change for the real studio. Paths are in that repository. Each item says why, what changes and how to check it. The order is the order they are needed (see `ROADMAP.md`); each change follows the repository's own conventions in `AGENTS.md` (Canadian English, licence headers on new source files, no barrel files, docs updated in the same branch).

| Id | Change | Needed by |
| --- | --- | --- |
| E1 | `OverworldBuilder` in `levels.rs` | M1 |
| E2 | A home for generated level and overworld functions | M1 |
| E3 | A level registry the exporter can write to, and a free id for the saucer | M3 |
| E4 | Widen the progress and requirement masks | M3 |
| E5 | An overworld registry | M3 |
| E6 | Export level data to WebAssembly | M5 |
| E7 | Build and enter a level from a script inside the sim | M5 |
| E8 | Export enemy paths | M5 |
| E9 | Export the playtest bot | M5 |
| E10 | Sprite names for level points | M9 |
| E11 | Name tables the studio can check against | M1 onward |
| E12 | Move the proofs into the game's tests | M1 onward |

## E1. `OverworldBuilder` in `levels.rs`

- **Why.** `overworldToRust` writes `fn <name>() -> MapData` against an `OverworldBuilder` (`new`, `fill`, `path`, `scatter`, `finish`, and the public `points` and `areas` lists). The builder exists only in the proof copy (`scratch/rust/episodes/episode-1/game/src/ow_builder.rs`), included into a test module.
- **What changes.** Add the struct and its impl to `episodes/episode-1/game/src/levels.rs` beside `build_overworld`. Then either rewrite `build_overworld()` to call the generated `overworld_fizz()`, or generate `build_overworld` itself from `overworlds/main.fizz`.
- **Check.** The existing proof (`the_overworld_script_matches_the_game` in `tools/ow_proof.template.rs`) runs in the game's `cargo test`: size, `floor_solid`, all 2,640 tiles, the 27 points, the five areas and the start equal, with more than 50 trees so the scatter is not vacuous. `bun run validate` passes.

## E2. A home for generated functions

- **Why.** `Builder` and `Seg` are private to `levels.rs`. A generated level function must sit in `levels.rs` or a child module that starts with `use super::*;` (the proof copy uses `include!` from `#[cfg(test)]` child modules).
- **What changes.** A child module of `levels`, for example `levels/generated.rs` with one `include!` per generated file, or one generated file per level under `levels/generated/`. Generated files carry the "generated from a Fizz script; edit the script, not this function" doc comment, a licence header, and are excluded from hand formatting rules that would fight the generator (or the exporter writes `rustfmt`-clean output).
- **Check.** A generated function for every script compiles in the game crate; `cargo clippy` is clean for the generated module; deleting a generated file and regenerating it gives the same bytes.

## E3. A level registry, and a free id for the saucer

- **Why.** The exporter does not register a level. Today a level is an id constant (`CRATER: u8 = 0` … `WHISPER_HOLLOW: u8 = 14`), a row in `LEVELS: [LevelDef; TABLE_LEN]` with `id`, `build`, `theme`, `area` and `icon`, and the counts `LEVEL_COUNT = 15` and `TABLE_LEN = 16`. `SAUCER` is id 15, the same value as `LEVEL_COUNT`, so the next cleared-level id collides with it. The language keeps its own copy of the table in `LEVEL_IDS` in `packages/language/src/tables.ts`.
- **What changes.** Make the table data the exporter can write: generate the id constants and the `LEVELS` rows from the level scripts' headers plus a small registry file (name, slug, theme, area, icon, overworld). Give `SAUCER` an id outside `0..LEVEL_COUNT` (for example the last table index, recomputed), after checking every place a level id is stored: saves (`Game::done` holds bits, `map_pos` a position), play samples and recordings (which check `level_hash(id)` and the fingerprint), and the shell's tables.
- **Check.** A test adds a sixteenth scripted level through the registry and asserts: its id is 15, the saucer's id is not, `build_level(15)` builds it, `level_bit(15)` does not equal `SECRET_FOUND`, and every old level keeps its id and fingerprint. A recording made before the change still replays.

## E4. Widen the progress and requirement masks

- **Why.** `Game::done` is a `u32`, but `MapPoint::req` is a `u16`, `World::met(req: u16)` and `first_unmet(req: u16)` take a `u16`, and `SECRET_FOUND = 1 << 15`. `PROGRESS_BITS = ((1 << LEVEL_COUNT) - 1) | SECRET_FOUND` keeps bits 0 to 15. Fifteen levels plus the secret use all 16 bits, so a sixteenth level's bit would be the secret flag. The exporter writes `level_bit(..) as u16` and `SECRET_FOUND as u16`.
- **What changes.** `MapPoint::req` and the two functions become `u32`; `SECRET_FOUND` moves to a high bit (for example `1 << 31`); `PROGRESS_BITS` is computed from the registry; `Game::load_done` migrates an old save (bit 15 set and the save predates the change → set the new secret bit and clear bit 15). The exporter writes `u32` and the `as u16` casts go. The `DONE_MASK` state slot already passes the mask as an `f64`, which holds a `u32` exactly.
- **Check.** Unit tests: an old mask with bit 15 loads as "secret found" and no level cleared at 15; a mask with bit 15 written by the new code loads as level 15 cleared; `met` and `first_unmet` work for a requirement on level 15 and on the secret together; the overworld proof still passes with the new types.

## E5. An overworld registry

- **Why.** The game has one overworld. `build_overworld()` is called directly by `World::enter_map()`; the `area_of(x, y)` export reads `overworld_areas()`, a hand-kept second copy of the same five rectangles; `overworld_thumb()` rebuilds the overworld for save-slot thumbnails. The language already allows several overworlds (`overworld "Name" WxH id=...`, one per file).
- **What changes.** An overworld table indexed by id with each map's build function; `World` holds the current overworld id; `enter_map(id)`; `area_of` and `overworld_thumb` read the current map's own `areas` (delete `overworld_areas()`); `LevelDef` gains the overworld a level belongs to. How Ben travels between maps and how the save records the current map are design questions (`OVERWORLD.md` §6).
- **Check.** With two generated overworlds, entering each by id gives its own tiles, points and areas; `area_of` answers from the current map; the thumbnail draws the current map; existing saves open on overworld 0.

## E6. Export level data to WebAssembly

- **Why.** Both authoring paths stay: a hand-written procedural Rust level must open in the studio by reading its data. Today that data is reached offline only, by the `dump_all_truth` test writing JSON (`FIZZ_DUMP_ALL=<dir> cargo test dump_`), which `tools/decompile-level.ts` turns into fill scripts.
- **What changes.** An export that builds a level by id and writes it into a buffer the shell can read: map size, tiles, `switches`, `floor_solid`, spawns (kind, x, y, dir, ride), items (kind, x, y), platforms (ax, ay, bx, by, speed, w, h, dwell, ph), start, arena and rooms (x0, y0, x1, y1, secret) — the fields `dump_all_truth` writes. Raw C-ABI, as every other export: `level_dump(id) -> u32` (length) and `level_dump_ptr() -> *const u8`.
- **Check.** For all 16 levels, the studio's reading of `level_dump` equals the `dump_all_truth` JSON, and `tools/verify-rasteriser.ts` run against it agrees on every tile, item, spawn and the start.

## E7. Build and enter a level from a script inside the sim

- **Why.** To preview, trace enemy paths in, or playtest a script that has not been compiled into the game, the sim must build it. The game's `World::load_level(id)` only builds levels from the compiled table. Building it in TypeScript and shipping a grid would make the studio's TypeScript the builder of record; the rule is that the game owns this.
- **What changes.** A builder-op stream: the exporter can write, beside the Rust source, a compact list of ops (one per `Builder` call it emits: `new`, `run` with segments, `fill`, `plat`, `hover` with size and dwell, `set_switch`, `crys`, `room`, `secret_room`, `wall_behind`, `mural`, `ladder`, `stairs_right`, `stairs_left`, `vine_nook`, `item`, `row`, `pogo_cache`, `ent`, `ent_at`, `rider`, `ent_dir`, `walls`, `liquid`, and `out` with the start and arena). A Rust interpreter runs them on the real `Builder` and returns a `LevelData`; exports `load_ops(ptr, len) -> u32` (0 on success, an error code otherwise) and `enter_loaded()`.
- **Check.** For all 16 levels and the kitchen sink, the op stream run in the sim gives the same `fingerprint()` as the compiled function; a malformed stream returns an error and leaves the world unchanged.

## E8. Export enemy paths

- **Why.** The Paths lens shows where walking enemies go. Movement is a simulation rule (`world.rs`), so the studio must not compute it. The prototype's JavaScript (`walkExtent`) is a reference only and is approximate on slopes.
- **What changes.** An export that, on a copy of the current level, removes Ben's influence, keeps one spawn live, steps the world a fixed number of ticks and records the enemy's position each tick: `trace_enemy(spawn_index, ticks) -> u32` (count) and a pointer to `(x, y)` pairs. The studio draws the covered cells and turning points; for a drone the trace is its loop; for a hopper the lens may still show its trigger box (10 tiles across, 4 up or down) from the game's own constants.
- **Check.** A Rust test traces each gloop and marshmallow in Crater Fields and asserts the turning columns equal those found by stepping the full game with Ben parked out of reach; the TypeScript lens draws exactly the cells in the trace.

## E9. Export the playtest bot

- **Why.** The idea from the design canvas: the playtest bot as a studio button and an MCP tool, so Claude can check a level is finishable before offering it. The bot exists in `episodes/episode-1/game/src/playtest.rs` but is compiled only for tests (`#[cfg(test)] mod playtest;` in `lib.rs`). It is a beam search (default beam 120, 4 per bucket, at most 6,000 ticks) over input macros, forking the real `World` each step; hostile enemies are removed by default so a result speaks for the platforming; a level passes when the exit is reached. It needs a route of waypoints (`Waypoint::stand(x, y)`, `Waypoint::gate(channel, x, y)`), written by hand per level in its tests.
- **What changes.** Compile `playtest` into the WebAssembly build (behind a feature if size matters), and add exports that run it in slices so a worker can report progress and stop: `playtest_begin(route_ptr, len, options)`, `playtest_step(max_ticks) -> u32` (0 running, 1 done), `playtest_result(field) -> f64` (finished, ticks, furthest waypoint, best x, best y, keys). Let it start from a level loaded by E7. Decide how a route is given for a new level (the exit alone, waypoints placed in the studio, or both; `SPEC.md` Q7).
- **Check.** Through the exports, every route in `playtest.rs`'s tests (Crater Fields, Caves, Zarg Lookout, Marshmallow Meadows, the Saucer, Whisper Hollow, Bonbon Playhouse, Fudge Bog, Mirror Shafts, Sugar Glass Gallery, Frosting Flats, Frosting Spire, Cocoa Foundry, Gumdrop Isle, Meteor Mesa) gives the same outcome as the Rust tests (including `whisper_hollow_cannot_be_finished_without_climbing` failing as expected); a run on the largest level completes in a worker without blocking the page.

## E10. Sprite names for level points

- **Why.** Later, the overworld designer chooses a level point's sprite. Today the sprite is `LevelDef::icon` (a `Spr`, such as `Spr::OwLmCrater`, `Spr::OwCastle` for the Citadel, `Spr::Saucer` for the saucer), not part of the overworld, and the names are in `SPRITE_NAMES` (name table 0 over the existing `table_len`, `name_ptr`, `name_len` exports).
- **What changes.** Decide where a point's sprite lives (the registry row, or a field on `MapPoint`); give the registry or the overworld script a `sprite=` that names an entry of `SPRITE_NAMES`; optionally a flag or prefix that marks which sprites are overworld landmarks, so the picker can list them.
- **Check.** A test asserts every sprite name a script uses is in `SPRITE_NAMES`; changing a point's sprite in a script changes the drawn landmark and nothing else (the level's fingerprint is unchanged, since it does not cover looks).

## E11. Name tables the studio can check against

- **Why.** The language copies the game's names by hand: `TILES`, `ITEMS`, `KINDS`, `LEVEL_IDS`, `THEMES`, `AREAS` in `tables.ts`, `SCATTER_RATES` and `AREA_RUST` in `overworld.ts`. The verifiers already read `tiles.rs` and `levels.rs` with regular expressions to map ids. A drift would compile a script to the wrong thing.
- **What changes.** Either a test in the game that writes these tables as JSON (as the dump tests do) for the language to compare against, or name-table exports (`table(t)` already serves sprites, captions and toasts) extended to tiles, items, kinds, level ids, themes, areas and the scatter rates.
- **Check.** A language test fails when any name or value differs from the game's; changing a tile constant in the game makes it fail.

## E12. Move the proofs into the game's tests

- **Why.** The proofs run in `scratch/rust/`, a copy of the game's crates that matches the game today except for the proof modules. A copy can drift without anyone noticing.
- **What changes.** The generated functions (E2) and the `assert_same` comparison live in the game; the scripts live beside the episode (for example `episodes/episode-1/levels/*.fizz`, `episodes/episode-1/overworlds/*.fizz`); a check script regenerates the Rust and fails if it differs from what is committed; `bun run validate` runs it.
- **Check.** Changing one tile in a script without regenerating fails the check; changing a hand-written Rust level that has a script fails its proof test.

## Fizz 2 (planned)

The list above is about Lieutenant Fizz 1. Lieutenant Fizz 2 is a separate repository whose levels are baked from `.fizz` sources, so its needs are a different list, kept here so the editor's side is visible. Each is a change in the Fizz 2 repository, owned and decided by it; the studio only asks. What exists there today is the `LEVL` data model (`fizz-pack`, `fizz-ep2`, and the level pull requests #137, #138 and #140, unmerged); none of the tools below exists yet.

| Id | Change | What the editor needs from it | Needed by |
| --- | --- | --- | --- |
| F1 | `fizz-script`, a reusable `std` crate, with the dialect's grammar written down | The parser, lossless AST, printer and validator, so the editor and the baker agree on what a script means; the home of the shared conformance corpus | M7 |
| F2 | A content export: the `pack_content()` tables (tile ids and properties, the legend letters, object and snack kinds, key colours, effect and caption ids, styles, limits) and the capability states, written as JSON by a test or a `fizz-bake` command | The `ep2` target profile, generated rather than copied, with a check that fails on drift | M7 |
| F3 | A level and theme format: the theme's back wall, parallax stack, horizon, night ambient, lamps and lanterns, and whether music is per level | Lowering for the reserved `theme`, `light` and `music` words (`docs/OBLIQUE.md` and `docs/LIGHTS.md` both say "a later level and theme format will carry them") | M8 |
| F4 | `fizz-bake` (`fmt`, `bake`, `check`, `dump`, and a size report) | The baker, the lints, the disassembly for the dump view, and the numbers for the Budget window | M7, M8 |
| F5 | A WebAssembly draw export in `fizz-present-web`: draw a level from `LEVL` bytes at a camera position with Night, Sky and detail options, into an RGBA buffer | The Game view (oblique ground, parallax, night and lights), drawn by the game's own presenter | M8 |
| F6 | A WebAssembly world built from `LEVL` bytes (`world_from_view` exists in `fizz-ep2` on #137), stepped by inputs, with the playtest bot | Rule behaviour, enemy paths and finishability for Fizz 2 levels, as E7 to E9 give Fizz 1 | M7 onward |
| F7 | The `SPRT` layout, and numeric sprite ids if names are replaced | Sprites reaching packs, and the profile's kind-to-sprite map | M9 |
| F8 | The enemy roster's kinds, object records and sprite states | Objects beyond the chicken | M9 |
| F9 | A rule for the missing wall-kick: a baker check or the playtest bot | Turning W103 from a design rule into a refusal (`SPEC.md` Q13) | M7 |

The rules phase in the simulation (triggers, channel actions and cues run as table rows) and the pack loaders are the Fizz 2 repository's own milestones; the editor waits for them through the capability states (an "accepted" trigger becomes "built" when the game runs it).

The Fizz 1 export check (E120 to E122, W104, W110) is the one place the editor writes back to the Fizz 1 game, and it uses the existing exporter, not a new engine change.
