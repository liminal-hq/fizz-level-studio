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

- **No CI.** Nothing runs these on a change; this folder is not a git repository.
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
