# Changes the game needs

Everything the game itself (`liminal-hq/lieutenant-fizz`) must change for the real studio. Paths are in that repository. Each item says why, what changes and how to check it. The order is the order they are needed (see `ROADMAP.md`); each change follows the repository's own conventions in `AGENTS.md` (Canadian English, licence headers on new source files, no barrel files, docs updated in the same branch).

| Id | Change | Needed by |
| --- | --- | --- |
| E1 | `OverworldBuilder` in `levels.rs` | M9 |
| E2 | A home for generated level and overworld functions | M9 |
| E3 | A level registry the exporter can write to, and a free id for the saucer | M11 |
| E4 | Widen the progress and requirement masks | M11 |
| E5 | An overworld registry | M11 |
| E6 | Export level data to WebAssembly | M12 |
| E7 | Build and enter a level from a script inside the sim | M12 |
| E8 | Export enemy paths | M12 |
| E9 | Export the playtest bot | M12 |
| E10 | Sprite names for level points | M9 |
| E11 | Name tables the studio can check against | M8 onward (the `fizz1` profile) |
| E12 | Move the proofs into the game's tests | M9 onward |

The milestone numbers are those of the reordered roadmap, in which the Fizz 2 milestones come first.

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

The list above is about Lieutenant Fizz 1. Lieutenant Fizz 2 is a separate repository, and the studio does not change it: every Fizz 2 change the studio depends on is a **change request** below, for the Fizz 2 repository to accept, reshape or refuse. Several are the owner's design intent decided on 2026-11-04 (`DECISIONS.md` D42 to D53), which the Fizz 2 repository does not have yet; each says what exists there today.

| Id | Change request | Today in Fizz 2 | What the studio needs from it | Needed by |
| --- | --- | --- | --- | --- |
| F1 | `fizz-script`, a reusable `std` crate, with the dialect's grammar written down, and the shared conformance corpus | No crate, no grammar (`docs/FAP.md` says "not yet specified") | The parser, lossless AST, printer and validator, so the editor and the baker agree | M2 |
| F2 | A content export: the `pack_content()` tables (tile ids and properties, legend letters, object and snack kinds, keys, effect and caption ids, styles, limits, step budgets) and the capability states, as JSON | `pack_content()` exists as bytes for the compatibility number | The `ep2` target profile, generated rather than copied, with a check that fails on drift | M2 |
| F3 | A theme format: back-wall material, panel stack, horizon, night ambient, chosen by a world and overridden by a level | Constants in `oblique.rs` (#144); "a later level and theme format will carry them" | Lowering `theme` | M5 |
| F4 | `fizz-bake`: `fmt`, `bake` of a whole world project into its world pack, `check` against manifests, `dump`, and a size report | Planned (`docs/FAP.md`) | Build world, the dump view and the Budget window's numbers | M2 |
| F5 | A WebAssembly draw export in `fizz-present-web`: draw a level from its baked bytes and the world's art at a camera position with Night, Sky and detail options, into an RGBA buffer | The presenters draw the slice only | The Game view, the canvas of every Fizz 2 level | M2 (flat fallback until then), M5 |
| F6 | A WebAssembly world built from baked bytes (`world_from_view` exists on #137), stepped by inputs, with the playtest bot | Native and Web run the slice | Rule and behaviour previews, the debugger, playtests | M3 |
| F7 | The `SPRT` layout, and numeric sprite ids if names are replaced | "Not yet specified" (`docs/FAP.md`) | Sprites in the world pack | M2 |
| F8 | The built-in enemy roster: kinds, records and sprite states | Planned (`enemy-roster`); only the chicken | Built-in enemies beside custom ones | M7 |
| F9 | **The wall-kick as a core Fizz 2 mechanic, always on**, with no per-level switch, and Fizz 2's `docs/FIZZ1-DIFFERENCES.md` changed to say so | Left out (owner decision of 2026-10-30, recorded on that page); `roadmap.json` still lists it first in M3.5 | The `ep2` physics parameters; the reversal of the earlier decision (D47) | M2 |
| F10 | **`LEVL` section version 2**, carrying states, bindings, the new objects and the new rule records; version 1 dropped with no reader kept; the slice level regenerated as version 2 and its golden hash re-pinned in the same change | Version 1 amended in place (#138) | The format the studio's lowering targets (D43) | M2 |
| F11 | **A state table and rule inputs in the simulation:** named states with up to 8 values and a start value, bindings for doors, lights, platforms and panels, inputs (keys held, switches, enter, take, touch, use, hit, stomp, stun, defeat, a group cleared, time, a state change), conditions and actions (set, toggle, next, spend, give, score, ammo, raise a word or a cue), the switch object, the death reset of every state, and `lock` as the key-and-door case of it | A lock is a key colour, a channel fixed by the door tile and a cell; only locks run (#140) | The owner's design of states with rules (D42) | M3 |
| F12 | **Placed lights as level objects:** position, radius, colour or palette bank, falloff, flicker, a state that switches them, and attachment to an enemy, item or Ben; their count and frame cost reported | Lights are constants and derived from objects (#146) | The Light tool and the light meters (D44) | M5 |
| F13 | **The oblique ground as the look of every Fizz 2 level**, drawn from any level's map, not only the slice's | Built for the slice (#143) | The Game view as every Fizz 2 level's canvas (D45) | M5 |
| F14 | Tile textures as data a world can supply, rather than generated code tables | `oblique_data.rs` generated by `tools/tiles/emit-oblique.ts` (#143) | The pixel editor's reach to tiles (Q34) | M6, later |
| F15 | **One world pack per world project:** a world header (name, stem, theme, the level list), the levels, definitions, bytecode, sprites (with a retro set), panels and the sound library, with its manifest | `<WORLD>.FAP` planned with `LEVL`, `BDRP` and `SPRT` (`docs/FAP.md`) | Build world (D48) | M2 |
| F16 | **A `DEFS` section** of fixed-size records for custom enemy and item definitions: sprite references per state, hitbox, stats, default reactions, item effects, register count | None | Custom enemies and items (D51) | M7 |
| F17 | **A `BHVR` section and a behaviour interpreter:** fixed-width bytecode with forward jumps only, a load-time verifier, per-entity and per-level step budgets, defined results for division by zero and NaN, the numeric model's operations only, entity state in the hash, and a bytecode version in the compatibility number | None | Behaviour scripting (D51; [SCRIPTING.md](SCRIPTING.md)) | M7 |
| F18 | **Raised events and a world sound library:** a rule action or an object raises a floating word (a level or world string, or a shared caption) or a cue from the world's sound library, drawn and played by each presenter and written to the transcript | Built-in events with a fixed presentation table; effects in `SHARED.FAP`; strings carried, not drawn (#138) | Words and sounds from rules and objects (D50; Q29) | M3 |
| F19 | **Bitmap parallax panels:** a `BDRP` layout and a panel layer kind with scroll factors, repeat, vertical position, the open-air rule and a state | Procedural layers (#144); `BDRP` "not yet specified" | Panels from the pixel editor (D52) | M5 |
| F20 | **The retro art set in a world pack:** Fizz 1's sprites, exported to grids as `tools/sprites/export-fizz1.ts` does, packed into a world's `SPRT` rather than `SHARED.FAP`, with how a Fizz 1 sprite is anchored over a Fizz 2 body | The exporter exists for the slice's sprites | Retro levels, art only (D49) | M8 |
| F21 | Debug exports for the behaviour debugger: each entity's mode, registers and instructions used per tick, step by tick, from the WebAssembly world | None | The debugger and `run_behaviour` | M7 |
| F22 | A cost model for the Budget window: the game's bench figures per light, panel and behaviour instruction on the DOS floor, as data | `/BENCH` measures whole frames | The DOS cost meters | M5, M7 |

The pack loaders and the rules phase are the Fizz 2 repository's own milestones; the editor waits for them through the capability states (an "accepted" feature becomes "built" when the game runs it).

The Fizz 1 export check (E120 to E123, W103, W104, W110) is the one place the editor writes back to the Fizz 1 game, and it uses the existing exporter, not a new engine change.
