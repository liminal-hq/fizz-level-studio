# Testing

What is tested today, what each test proves, how to run it, and the gaps. Counts and results are as run on 2026-10-18 with Bun 1.3.10.

## 1. Commands

```bash
bun test packages/language        # or: bun run test      — 76 tests in 8 files
bun test packages/mcp             # or: bun run test:mcp  — 21 tests in 2 files
bash scripts/prove-crater.sh      # or: bun run prove     — crater and kitchen-sink proofs
bash scripts/prove-all.sh         # or: bun run prove:all — every level, the overworld, both rasterisers
```

The two proof scripts need Rust with the crates already in the local Cargo cache (they run `cargo test --offline`), and build only inside `scratch/rust/`. They write generated files into `scratch/rust/episodes/episode-1/game/src/` (`crater_fizz.rs`, `kitchen_sink.rs`, `all_fizz.rs`, `all_proof.rs`, `ow_fizz.rs`, `ow_proof.rs`) and the game's data as JSON into `scratch/truth/`.

## 2. Unit tests: `packages/language` (76 tests)

| File | Proves |
| --- | --- |
| `parser.test.ts` | `crater.fizz` parses with a line number on every node; the header; terrain across commas; ranges, lists and single values; `row` counts; the four spawn forms; top-level lines between sections; trailing comments; `//` inside a quoted name; theme and area against the table; every `Builder`-backed statement parses |
| `printer.test.ts` | `crater.fizz` round-trips byte for byte; odd spacing, comments, blank lines, CRLF and no final newline survive; scripts with errors print back unchanged; the empty script; canonical text of a whole script parses back to the same nodes |
| `edits.test.ts` | `paint`, `clear`, `place` parse; appending creates the block after one blank line and keeps the final newline; appending never rewrites a hand-written line; appended nodes carry their line; appending to an existing block goes after its last line and before trailing blanks; edits run last and in file order (a later paint wins, `clear` paints empty); only edit lines may follow the header |
| `errors.test.ts` | Each code E001 to E016 with its message and fix; a malformed header is one error, not a cascade; several bad lines are all reported in order; `formatError` and `parseOrThrow` carry the line, code and fix |
| `rust.test.ts` | The function wrapper; float spelling and `.0`; `row` to the count `Builder::row` wants; `room`/`secret-room` argument order versus `wall-behind`; the spawn forms; other statements; the arena in `out()`; `crater.fizz` exports the same calls in the same order as the hand-written `crater()`; refusals |
| `objects.test.ts` | `hover` with `size=` and `dwell=` exports as `Platform::new(..).sized(..).with_dwell(..)`; the plain form still uses `b.hover`; it prints back; a bad size is explained; `channel` sets one switch per channel and refuses a word other than on or off; the edits block takes a fractional enemy, a lift and a room, and still refuses a terrain segment |
| `overworld.test.ts` | Recognised by the header; `main.fizz` parses and prints back unchanged; rasterises to 2,640 tiles and 27 points; `hashf` matches the game for a known tile; a teleporter must pair with one that exists; a level must be known; a point outside the map is refused; a level point belongs under `points`; export puts points before fills and resolves partners |
| `docs.test.ts` | Every tile, item, enemy and terrain word has an entry; every statement the parser takes has one; every entry has a syntax, an example and a note; every field a statement lists is described; standalone level examples parse; overworld point examples parse; `docsFor` splits level and overworld words |

## 3. Unit and protocol tests: `packages/mcp` (21 tests)

| File | Proves |
| --- | --- |
| `studio.test.ts`, propose mode | Defaults to propose, leaves the file alone, and CLI accept appends under `edits`; CLI reject leaves the file byte-identical and records the reason; the mode cannot be changed through any tool; a malformed line is rejected with code, line and fix and nothing is stored; hand-written lines are never rewritten |
| `studio.test.ts`, direct mode and undo | Direct applies at once and undo restores the file byte-identically; two direct steps undo one at a time, and CLI undo works; undo refuses when someone has edited after the step; undo still works when the person edited elsewhere in the file |
| `studio.test.ts`, reading | `get_level` reports header, numbered script, counts, start and exit; `get_region` renders painted cells and shows pending as a separate layer; `get_region` draws terrain, entities and start with a legend; `list_kinds` comes from the language tables; notes are stored and shown; `get_changes` since an id or the last N |
| `studio.test.ts`, `run_checks` | Gaps of 3, 4 and 5 and a pool with the three rules; structural checks, with the playtest bot never claimed; a missing exit is flagged; `include_pending` checks the level as if accepted; the crater's 4-wide and wider pools are reported |
| `e2e.test.ts` | A real stdio session: initialize, `tools/list`, a propose and a `get_region` |

## 4. Proofs against the game

### `scripts/prove-crater.sh`

Exports `levels/crater.fizz` as `crater_fizz` and `scratch/kitchen-sink.fizz` as `kitchen_sink` into the proof copy and runs every `_proof` test:

- `generated_crater_matches_hand_written_crater`: the hand-written script equals `crater()` in id, theme, area, map size, switches, `floor_solid`, every tile, spawns, items, platforms, start, arena, rooms and fingerprint (`0x6e9fac40`), with guards against a vacuous pass (9 spawns, more than 40 items, more than 1,000 filled tiles).
- `comparison_detects_a_difference`: moving one item changes the fingerprint, so the comparison can fail.
- `kitchen_sink_builds`: a script that uses each v0 statement once compiles and runs, and spot checks hold (an arena, one platform, two rooms with the second secret, a painted one-way, a cleared cell, the last item at (30.5, 10.5), a rider and a facing spawn). It is a smoke test, not an equality proof, and it does not use `channel`, `size=` or `dwell=`.

### `scripts/prove-all.sh`

1. `tools/gen-all-proof.ts` exports all 16 scripts in `levels/real/` and writes one `<slug>_matches_the_game` test each, using the same `assert_same` as the crater proof.
2. `tools/gen-overworld-proof.ts` exports `overworlds/main.fizz` and writes `the_overworld_script_matches_the_game`.
3. Runs `prove-crater.sh`, then `cargo test --offline -p lf-episode-1 _proof`. On 2026-10-18: 23 passed, 0 failed (16 levels, the overworld, crater, the difference check, the kitchen sink, and three dump tests that do nothing without their environment variables).
4. Dumps the game's own data (`FIZZ_DUMP_ALL`, `FIZZ_DUMP_OW`) into `scratch/truth/`.
5. Runs `tools/verify-rasteriser.ts` for each level: every tile, every item (cell + 0.5, in order), every spawn and the start agree, for all 16 levels.
6. Runs `tools/verify-overworld.ts`: 2,640 of 2,640 tiles, 27 of 27 points, the areas and the start agree.

The level proofs check the scripts in `levels/real/`, which `tools/decompile-level.ts` wrote as fills from the game's data; the hand-written `levels/crater.fizz` is proven by the crater test. The proof copy matched the game's crates on 2026-10-18 except for the proof modules (`diff` of `crates/sim/src` and `episodes/episode-1/game/src`).

### The native rasteriser check

`crates/fizz-studio-games/tests/rasteriser.rs` links Fizz 1's crates natively and, for each of the 16 scripts in `levels/real/`, rasterises it with the Rust rasteriser (`fizz-studio-language`) and compares the result with `lf_episode_1::levels::build_level` for the id the script names: the grid size, switch bits, every tile (game ids mapped to tile words through a table the compiler checks against `lf_episode_1::tiles`), every item with its cell centre, every spawn's kind, position, facing and `ride`, and Ben's start. A difference fails the test with the level name and the first few mismatches. It proves that the Rust rasteriser agrees with the game itself, not only with the TypeScript rasteriser's golden files, and it needs no bun, no `scratch/` copy and no dump step.

### Audits (run by hand)

| Command | Reports |
| --- | --- |
| `bun tools/audit-levels.ts scratch/truth` | For each level: size, tile kinds, items, spawns, platforms (and how many have a size, rest or phase), rooms, arena, switches, `floorSolid`, and anything the language cannot say |
| `bun tools/audit-editor.ts scratch/truth` | For each level, the tiles, items and enemies beyond a fixed palette list, and its objects. The palette list in the script is an early snapshot; the prototype's palette now covers every word. |

## 5. The design harness

`tools/design-harness/` drives the design pages in a real headless Chromium with the artifact's own runtime (`design/project/support.js`), using Playwright from the game repository's `node_modules` and the `chrome-headless-shell` from Playwright's cache. **Audio is muted**: every script launches Chromium with `--mute-audio`, and the pages make no sound.

Run it:

```bash
cd design/project && python3 -m http.server 8765 --bind 127.0.0.1    # serve the pages; stop it when finished
mkdir -p /tmp/fls-shots
H=/tmp/fls-shots node tools/design-harness/e2e.cjs                     # H is where screenshots go
H=$PWD/design/project node tools/design-harness/all.cjs               # for all.cjs, H is the folder of pages
```

| Suite | Checks | Covers | Result on 2026-10-18 |
| --- | --- | --- | --- |
| `load.cjs <page> [png]` | — | Loads one page, prints the title, the first text, the cell count and console errors, takes a screenshot | — |
| `all.cjs` | 28 pages | Every page loads with text and no unresolved `{{...}}` placeholders | 28 ok |
| `e2e.cjs` | 21 | Sample draft: 640 cells, Inspector, selecting, B for Paint, painting adds a line, Ctrl+Z, a dragged run, moving a window, the right-click menu, Escape, accepting a hunk, typed lines and their fixes, zoom 48 and 16, the `?` card, area select, copy, stamp, pop-out, no console errors | 21 pass |
| `e2e3.cjs` | 8 | Area select, copy, stamp, the stamp in the script, undoing it, cut, moving a gloop with an arrow, switching menus by hovering | 8 pass |
| `guide-e2e.cjs` | 19 | The walkthrough's twelve steps and demos: legend, images, painting demo lines, all 40 tiles, propose and accept, direct and undo, the gap slider, snapping, pop-out, the status step | 19 pass |
| `manual-e2e.cjs` | 17 | The language manual and its live checker: contents, a default line, E002 with a suggestion, E013 live, `place` expansion, filters, search, examples, error details, line explanations | 17 pass |
| `obj-e2e.cjs` | 14 | Objects: Zarg Lookout's lift, its fields, rewriting `dwell` in place, undo; Mirror Shafts' channels and rewriting the `channel` line; Sugar Glass Gallery's rooms; the overworld (2,640 cells, points as objects, the Point tool adds a sign, changing a point's level rewrites its line, undo) | 11 pass, then a timeout: clicking the "Level: Meteor Mesa" row in the Objects window is intercepted by another window on top of it, so the last three checks did not run |
| `compl-e2e.cjs` | 9 | Completion: `pa` → `paint`, Tab, tile words, fields, `hover` fields, a typed `hover` adds a lift, enemy words, Escape; the Paths lens tags a gloop | 9 pass |
| `proto-crater-e2e.cjs` | 12 | Crater Fields: 5,376 cells, title and size, the gap lens's first gap 4 wide, no false valley gaps, start at 3,4, painting writes y counted from the bottom, undo, a typed `place`, the item hint for `paint cheezie`, switching to the sample | 12 pass |
| `proto-levels-e2e.cjs` | 18 | The starter-levels card has 18 entries and closes with Escape; each of the 16 levels opens with the right cell count and title | 18 pass |

## 6. Gaps

- **CI runs only part of it.** `.github/workflows/ci.yml` lints the Markdown and runs the language and MCP tests; the proofs need Rust and the game's crates and run locally.
- **The proofs run in a copy.** `scratch/rust/` can drift from the game; until the proofs move into the game (ENGINE-CHANGES E12), diff the copy before trusting a run.
- **Statements without an equality proof.** `ladder`, `stairs-right`, `stairs-left`, `vine-nook`, `mural`, `wall-behind` and `liquid` are covered by the kitchen-sink compile-and-run and by unit tests of the text they export, but no real level script uses them (the `levels/real/` scripts are written as fills).
- **The rasteriser check is partial.** `verify-rasteriser.ts` compares tiles, items, spawns and the start; platforms, rooms, the arena and switches are compared only by the Rust proof.
- **Name tables are not checked against the game** (ENGINE-CHANGES E11).
- **The harness is tied to one machine.** The scripts `require` Playwright from `/home/scott/source/liminal-hq/lieutenant-fizz/node_modules`, launch `~/.cache/ms-playwright/chromium_headless_shell-1228/...`, use fixed waits instead of conditions, and `load.cjs` defaults its screenshot to a path under `~/.claude/jobs/`. The Google Fonts links fail offline, so pages render with fallback fonts.
- **`obj-e2e.cjs` fails** at its twelfth check, as above.
- **The prototype is not the product.** The harness proves the design behaves as described; the studio app has no tests because it does not exist.
- **The MCP server has never run inside a real Claude Code session**; only `e2e.test.ts` speaks the protocol to it.
- **The gap rule is not physics.** The 3/4/5 widths are the stated design rule.
- **No playtest from the studio.** The game's bot (`playtest.rs`) has routes for 15 levels in its own tests; the Citadel has none.
- **No performance measurements** of the studio. Parse plus rasterise of the slowest real level (Frosting Spire) averages 0.35 ms, and the overworld 0.71 ms, in Bun 1.3.10 on an AMD Ryzen 7 7700X (20 runs after a warm-up).

## 7. Planned: targets, worlds, the Fizz 2 dialect, behaviours and art

None of these tests exist. They are what the work needs, so the implementer knows what done means.

### The dialect

- **Conformance corpus.** A folder of Fizz 2 scripts, each with its expected printed output and its expected error and lint codes with `path:line:col`. The language package runs it with `bun test`; the Fizz 2 repository's `fizz-script` runs the same files, so the two parsers cannot drift. The corpus lives in the Fizz 2 repository (it owns the dialect) and the studio pins a copy by commit, refreshed by a script that fails when the copy differs.
- **Round trip.** Every script, valid or not, prints back byte for byte; `x=`/`y=` versus `at=` follows the printer rule; a map edit rewrites only the rows it touched.
- **One test per code.** Every E1xx and W1xx code has a script that produces it and a test that says so, and every code in `LANGUAGE.md` has one.
- **Superset in text.** Every Fizz 1 script in `levels/` and `overworlds/` parses and prints unchanged under the Fizz 2 parser, and `bun run prove:all` stays green.
- **Ids and indices.** Renaming an id rewrites every rule that names it and nothing else; the baked index of every object equals its position after the stable kind sort; a second key of one colour is E107.
- **States and rules.** 32 states pass and 33 fail; a state with 9 values fails; a start value outside the set fails; `toggle` on a three-valued state is E124; 32 rules pass and 33 fail (each `lock` counted after expansion); a third condition or action fails; an action without its cell fails; `time` with `every=3` or with `every=` and no `repeat` fails; a rule that names a missing object, group, string or cue fails; W113 fires for a rule that can never fire.
- **`lock` is sugar.** For each corpus `lock`, the expansion written out by hand gives byte-identical records, and the printer keeps the `lock` line as written.
- **A death resets states.** A fixture, run in the game host, changes three states, dies, and finds every state at its start value (with the Fizz 2 repository's state table, F11).
- **Records.** For each corpus level, the studio's resolved objects, states, bindings, rules and strings equal `fizz-bake dump` of `LEVL` version 2 field for field (needs the baker and F10). There is no version 1 path to test: version 1 is dropped.

### Proof against the Fizz 2 game

- **The slice as a script.** A `.fizz` file of the slice level, in a world project, bakes through `fizz-bake` to the digest of the `const` slice (`fizz_ep2::level::digest`, FNV-1a 64 over the whole level but its name; `0x44cc_83fb_5218_552f` for the version 1 records on #140, re-pinned when F10 regenerates the slice as `LEVL` 2), and the world it builds has the same `hash()` as `level::world()`. The game's replay golden then proves it plays the same on native, Web and DOS. This is the Fizz 2 equivalent of `prove-all.sh`, and it runs in the Fizz 2 repository.
- **Not covered here:** the rules' behaviour, the drawing and the sound, which the Fizz 2 repository's replay golden, frame digests and audio tests own.

### Targets and divergence

- **The capability matrix is tested.** Every row in `LANGUAGE.md`'s matrix has a fixture that shows its state in each profile: a built feature lowers, an accepted one lowers with W106 or W109, a reserved one parses and is not lowered, an absent one is E102.
- **Profiles are data.** A synthetic third profile (a renamed `ep2` with one extra tile, one extra object kind and one feature moved from absent to built) loads, offers the new words in completion and the palette, and changes the checks, with no change to the editor's code (R-TGT-06).
- **Profiles follow their games.** A test compares the `fizz1` profile with the Fizz 1 game's tables (ENGINE-CHANGES E11) and the `ep2` profile with Fizz 2's content export (F2), and fails on any difference.
- **Fizz 1 export.** A Fizz 2 level with a `map`, an `at=` off a cell centre, a `chicken`, a standard and a non-standard lock, a door that starts open, a `when`, a `string`, `floor solid` and an exit exports with exactly the expected W104, E120, E121, E122 and W110, and the exported script parses, exports to Rust and compiles in the proof copy.
- **Convert to Fizz 2.** Crater Fields and Whisper Hollow convert with exactly the expected conversion report, a map equal tile for tile to the rasteriser's output, the red and blue doors as `lock` lines, and Fizz 1 channels as states. Whisper Hollow's wall-kick chimney needs no check after conversion, because Fizz 2 has the kick (D47).
- **Fizz 1 levels and the wall-kick.** A Fizz 1 fixture with a ledgeless two-wall shaft gets W103; one with ledges does not.
- **The target is fixed.** No command, tool or field changes a level's `script` line; Convert to Fizz 2 writes a new file and leaves the Fizz 1 file byte-identical.
- **Divergence lints.** Fixtures for W102 (an exit over a gap), W103 (a ledgeless shaft in a Fizz 1 level) and W105 (a two-high passage over a slope, checked at body heights 1.4 and 2.0).
- **Fizz 1 export of states.** A standard-lock level exports exactly; a rule-free two-valued state exports as a `channel` line; a three-valued state, a door that starts open, a `switch` rule, a light and a custom enemy give E120, E121 and E123 as `LANGUAGE.md` says.

### Worlds

- **Build world.** A two-level world with shared definitions, a sprite set, the retro set and a panel builds through `fizz-bake` into one world pack whose manifest lists each section; the retro set is in the world pack and not in `SHARED.FAP`.
- **Shared names.** A level that redefines a world name is E130; removing a used definition is refused.

### Previews and budgets

- **Game view parity.** For the slice, frames drawn through the game's draw export equal the game's pinned frame digests by day and at night. With the export missing, the canvas shows the flat fallback with its banner and `get_preview` reports "not available".
- **Lights.** A light switched by a state is on exactly while its state has the `on=` value; an attached light's position equals its carrier's every tick; the light-count readout equals the game's count for the slice.
- **Budget meters.** For the slice, the `LEVL` meter equals the baker's decoded length; with the baker missing, the meter says "estimate"; the light, panel and behaviour cost meters show the game's bench figures or "not run"; no meter reports a number without its source.

### Behaviours

- The compiler conformance corpus, the determinism fixtures on native, Web and DOS, the budget edge cases, the verifier's refusals, the sandbox fixtures and the debugger's agreement with native traces, as `SCRIPTING.md` section 8 lists them.

### Sprites

- **Canonical files.** Every file in Fizz 2's `assets/sprites/` opens and saves byte for byte unchanged through the studio's reader and writer, and agrees with `tools/sprites/lib.ts` on a set of edited fixtures.
- **Editing rules.** The pixel editor refuses a letter outside the 16 EGA letters and `.`, a size outside 1 to 255, a duplicate name and any edit to a generated or retro set.
- **PNG import.** The same image and settings give the same grid every time; every pixel of the result is one of the 16 colours or transparent; the source image and settings are saved beside it.
- **Panels.** A panel's scroll factors, repeat, vertical position and open-air rule round-trip through its file, and the Game view draws it where the game says.
- **Drawing by kind.** Every object kind in each profile draws with its mapped sprite, and a kind without one draws the labelled placeholder.

## 8. Planned: the desktop app

None of this exists. The studio becomes a Tauri v2 desktop app ([DESKTOP.md](../spec/DESKTOP.md)), and its tests follow the Liminal HQ standard (`DECISIONS.md` D60):

- **Rust tests** with `cargo nextest` for every crate: the session (one writer, revisions, undo and redo, stale answers refused), files (atomic canonical writes, watching, recovery), profiles, states, art, budgets, export and the MCP server, with golden files.
- **The Fizz 1 port's corpus.** Today's 76 language tests become fixtures (input, expected print, errors, exported Rust) run by the Rust crate, and the 16-level and overworld proofs become Rust tests that link the Fizz 1 crates at a pinned revision, so `scratch/rust/` and its drift go away. The TypeScript package keeps passing the same fixtures until it is retired (D56).
- **Frontend tests** with Vitest, Testing Library and happy-dom, and `tauri::test::mock_builder` for the app crate (`folio/spec/02-architecture.md` "Testing").
- **The running app** is driven by `tauri-mcp-server` through the debug-only `tauri-plugin-mcp-bridge`, by window label, with audio muted: the M1 walking-skeleton checks (open a Fizz 1 level and a Fizz 2 world, paint, undo, save, an outside edit, recovery), then each milestone's exit criteria. The bridge is not built for Windows in Folio because of a `webview2-com` clash, so these checks run on Linux.
- **The gate.** `bun run validate` runs all of it except the running-app checks, which CI runs in its Linux job.
- **The design harness stays.** The Playwright suites in `tools/design-harness/` keep checking the design prototype in `design/`; they are not ported to the app.
