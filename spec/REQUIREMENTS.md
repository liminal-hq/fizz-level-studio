# Requirements

Status values: **Proven** — built in `packages/language` or `packages/mcp` and shown equal to the game by a Rust proof. **Package** — built in `packages/language` or `packages/mcp` and covered by its unit tests, not proven against the game. **Prototype** — built in the design prototype only. **Not built**.

## Language and export

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-LANG-01 | A script compiles to the same `Builder` calls a hand-written level makes, one call per statement (one per value for lists) | Proven | `rust.test.ts`; `prove-all.sh` |
| R-LANG-02 | Statements run in file order; sections never reorder | Proven | `prove-all.sh` (order-dependent fingerprints) |
| R-LANG-03 | y counts up from the bottom; row 0 is the bottom | Proven | `prove-all.sh`; `proto-crater-e2e.cjs` |
| R-LANG-04 | An item sits at the middle of its block (cell + 0.5) | Proven | `verify-rasteriser.ts` |
| R-LANG-05 | A parsed script prints back byte for byte, including comments, odd spacing, CRLF and lines with errors | Package | `printer.test.ts` |
| R-LANG-06 | Every error has a line, a code E001–E016, a message and a fix; one error per line; no cascades from a bad header | Package | `errors.test.ts` |
| R-LANG-07 | Terrain runs, `walls`, `crystal`, `row`, `pogo-cache` | Proven | `crater_proof.rs` |
| R-LANG-08 | `ladder`, `stairs-right`, `stairs-left`, `vine-nook`, `mural`, `wall-behind`, `liquid` | Package | `kitchen_sink_builds` compiles and runs them; not proven against a real level |
| R-LANG-09 | `hover` with `size=` and `dwell=` | Proven | Zarg Lookout, Frosting Spire |
| R-LANG-10 | `channel LIST on\|off` | Proven | Mirror Shafts |
| R-LANG-11 | `room`, `secret-room`, `arena` | Proven | Bonbon Playhouse, Sugar Glass Gallery, Citadel |
| R-LANG-12 | `edits` is appended after the last line; hand-written lines are never rewritten | Package | `edits.test.ts`, `studio.test.ts` |
| R-LANG-13 | `edits` accepts `paint`, `clear`, `place`, enemies, `hover`, `channel`, `room`, `secret-room` | Package | `objects.test.ts` |
| R-LANG-14 | `theme` and `area` checked against the level table (E014) | Package | `parser.test.ts`, `errors.test.ts` |
| R-LANG-15 | Every word the parser accepts has a doc entry with syntax, example and note | Package | `docs.test.ts` |
| R-LANG-16 | Full docs for `beetle`, `bat`, `pod`, `phantom`, `roller`, `sentry`, `boss`, `cage` | Not built | `docs.ts` has one-line notes |
| R-LANG-17 | An API to rewrite one owned object line in place (the studio-owned-lines rule) | Not built | Only in the prototype's JavaScript |
| R-LANG-18 | Fractional item positions | Not built | Decided: not now |
| R-EXP-01 | `toRust` writes `fn <name>() -> LevelData` that compiles inside `levels.rs` or a child module with `use super::*;` | Proven | `all_proof.rs` |
| R-EXP-02 | Each exported level's fingerprint equals the game's | Proven | `assert_same` in `crater_proof.rs` |
| R-EXP-03 | Export registers a new level (id constant, `LEVELS` row, `LEVEL_COUNT`) | Not built | See ENGINE-CHANGES E3 |
| R-EXP-04 | Export writes into the game repository and its tests run there | Not built | Proofs run in `scratch/rust/` only |
| R-EXP-05 | The language's name tables are generated from or checked against the game's | Not built | `tables.ts` is hand-copied |

## Overworld

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-OW-01 | `overworld "Name" WxH id=...`, `start`, `area`, `blocks`, `points`, `edits` | Proven | `ow_proof.rs` |
| R-OW-02 | `path from= to=` routes run x first, then y | Proven | `ow_proof.rs` |
| R-OW-03 | `scatter` rolls the game's `hashf` and matches tree for tree (200 trees, 32 rocks) | Proven | `ow_proof.rs`, `verify-overworld.ts` |
| R-OW-04 | Teleporters are named and paired by `with=`; the exporter computes indices | Proven | 27 of 27 points agree |
| R-OW-05 | `req=` lists levels or `secret`; `big`; `hidden` | Proven | `ow_proof.rs` |
| R-OW-06 | `overworldToRust` writes `fn <name>() -> MapData` against `OverworldBuilder` | Proven | `ow_fizz.rs` in the proof copy |
| R-OW-07 | `OverworldBuilder` in the game's `levels.rs` | Not built | ENGINE-CHANGES E1 |
| R-OW-08 | Several overworlds registered and entered by id in the game | Not built | ENGINE-CHANGES E5 |
| R-OW-09 | Open, paint, add, move and remove points; Unlocks chips; teleporter pairing; Big and Hidden | Prototype | `obj-e2e.cjs` |
| R-OW-10 | Links and Areas lenses | Prototype | `Proto.dc.html` |
| R-OW-11 | Overworld checks: each level once, pairs both ways, unlock cycles, reachability | Not built | The parser checks only that a `with=` partner exists |
| R-OW-12 | Level sprites on points, with a sprite picker | Not built | ENGINE-CHANGES E10; `ROADMAP.md` M9 |
| R-OW-13 | Canonical printing of overworld nodes built in memory | Not built | `printOverworld` prints raw lines only |

## Editor

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-ED-01 | Ultimate layout: level as canvas, floating windows that snap within 8 px, resize to a minimum, collapse, come to front | Prototype | `e2e.cjs`, `guide-e2e.cjs` |
| R-ED-02 | Reset layout (Ctrl+Shift+0); save and restore a layout | Prototype | Session only; nothing written; the app keeps layouts in its settings document (R-APP-06) |
| R-ED-03 | Pop the script out to its own window and dock it back | Prototype | `e2e.cjs` |
| R-ED-04 | Menu bar, app menu, right-click menu, shortcuts card (`?`) | Prototype | `e2e.cjs`, `e2e3.cjs` |
| R-ED-05 | Zoom 16, 24, 32, 48 px with `-` and `=` | Prototype | `e2e.cjs` |
| R-ED-06 | Save to the `.fizz` file; New, Save as, Export, Preferences, Quit | Not built | Save shows a message only |
| R-ED-07 | Pan and grid | Not built | |
| R-TOOL-01 | Paint, Erase, Pick, Select, Stamp with B, E, I, S, T; a stroke or stamp is one undo step | Prototype | `e2e.cjs` |
| R-TOOL-02 | Lift (L), Room (R), Arena (A), Point (P) | Prototype | `obj-e2e.cjs`, `compl-e2e.cjs` |
| R-TOOL-03 | Palette lists every tile, item and enemy kind the language knows | Prototype | `defs()` in `Proto.dc.html` |
| R-OBJ-01 | Each object is one line; the studio rewrites its line in place; new objects go under `edits`; untouched lines are never rewritten | Prototype | `obj-e2e.cjs` ("changing the rest time rewrites its script line") |
| R-OBJ-02 | Removing an object turns its line into `// removed in the studio: ...` | Prototype | `buildScript` in `Proto.dc.html` |
| R-OBJ-03 | Drag every handle: lift ends and whole path, room corners and body, arena ends | Not built | Lift ends, room body and points drag; arena does not |
| R-OBJ-04 | The Objects window edits each object field by field | Prototype | `obj-e2e.cjs` |
| R-HIST-01 | Named undo and redo for every change; History shows pending ideas after Now | Prototype | `e2e.cjs` |
| R-LENS-01 | Gaps lens and the 3/4/5 rule | Prototype | Also `run_checks` in the MCP server (Package) |
| R-LENS-02 | Ghosts, Hazards, Reach lenses | Prototype | |
| R-LENS-03 | Paths lens from the game host | Not built | The prototype's JavaScript is a reference, approximate on slopes |
| R-SCR-01 | Script panel in sync, Claude's lines marked, click a line to select, following selection | Prototype | `e2e3.cjs`, `guide-e2e.cjs` |
| R-SCR-02 | Typed line applies as one undo step; a bad line gets an explanation and a fix | Prototype | Uses the prototype's own JavaScript checker, not the language parser |
| R-SCR-03 | Completion from `docs.ts` | Prototype | `compl-e2e.cjs` |
| R-SCR-04 | The typed line, the script panel and file loading use `packages/language` | Not built | |
| R-START-01 | Starter-levels card with 18 entries; Crater Fields opens first | Prototype | `proto-levels-e2e.cjs` |
| R-START-02 | Every item drawn even when it shares a block | Not built | 16 items hidden across 7 levels |

## Claude and MCP

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-AI-01 | Nine tools: `get_level`, `get_region`, `list_kinds`, `edit_level`, `get_proposal_state`, `add_note`, `run_checks`, `undo`, `get_changes` | Package | `studio.test.ts`, `e2e.test.ts` |
| R-AI-02 | Propose by default; the mode is read from the sidecar; no tool takes or changes it | Package | "the mode cannot be changed through any tool" |
| R-AI-03 | Accept and reject exist only outside MCP | Package | `packages/mcp/src/cli.ts` |
| R-AI-04 | Every line is parsed before anything is stored; one bad line rejects the call | Package | "a malformed line is rejected with code, line and fix" |
| R-AI-05 | `undo` reverts only Claude's last applied step and refuses on conflict | Package | `studio.test.ts` |
| R-AI-06 | `get_selection` | Not built | Needs the studio app |
| R-AI-07 | Object tools (rewrite one owned line) | Not built | |
| R-AI-08 | Overworld tools | Not built | |
| R-AI-09 | Paths, playtest and language-docs tools | Not built | |
| R-AI-10 | `edit_level` accepts the whole `edits` vocabulary | Not built | Takes `paint`, `clear`, `place` only (S002 otherwise) |
| R-AI-11 | Claude's ideas in the studio come from Claude, not a canned list | Not built | The prototype has three canned ideas per level |
| R-AI-12 | Exercised inside a real Claude Code session | Not built | Only the protocol tests have driven it |

## Game host and Rust content

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-RUST-01 | Open a hand-written Rust level by reading its data | Package | Offline only: `dump_all_truth` then `tools/decompile-level.ts` |
| R-RUST-02 | Read level data from the game at run time, natively | Not built | ENGINE-CHANGES E6 |
| R-RUST-03 | Edits to a Rust-written level are kept and exported | Not built | Open question Q2 |
| R-WASM-01 | Build and enter a level from a script inside the sim, without recompiling | Not built | ENGINE-CHANGES E7; native in the game host (D59), the id is historical |
| R-WASM-02 | Enemy paths from the sim | Not built | ENGINE-CHANGES E8; native (D59) |
| R-WASM-03 | Playtest bot from the studio and over MCP | Not built | The bot exists as `#[cfg(test)]` Rust (`playtest.rs`); native (D59, E9) |
| R-ENG-01 | Widen the requirement mask so a 16th level fits | Not built | ENGINE-CHANGES E4 |
| R-ENG-02 | A level and overworld registry the exporter can write to | Not built | ENGINE-CHANGES E3, E5 |

## Fizz 2 target (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-F2-01 | `script fizz2 0` is a superset of the Fizz 1 script in text: every Fizz 1 script parses and prints unchanged | Not built | `spec/LANGUAGE.md` |
| R-F2-02 | `map` grid with the profile's legend, `at=` versus `x=`/`y=` with the printer rule, the `objects` section (`key-red`, `key-blue`, `cheezie`, `choc`, `cookie`, `soda`, `chicken`), required `id=`, objects stably sorted by kind | Not built | `spec/LANGUAGE.md`; Fizz 2 #137 |
| R-F2-03 | `state`, bindings, `when ... then ...`, `lock` as sugar and `allow`, with the limits (32 rules, 32 states of up to 8 values) | Not built | `spec/LANGUAGE.md` "States and rules"; owner decision D42; F11 |
| R-F2-04 | Errors E1xx and lints W1xx, with W101 | Not built | `spec/LANGUAGE.md` |
| R-F2-05 | A level's target is fixed at creation and selects its tools, sprites, rules, views and checks; Export to Fizz 1 runs the lossy check (E120 to E123, W103, W104, W110) first | Not built | `spec/EDITOR.md` section 13; D46 |
| R-F2-06 | Snap to floor writing `at=`, Close all doors, the Rules window, rule lints inline | Not built | `spec/EDITOR.md` section 13 |
| R-F2-07 | A dump view equal to the baker's disassembly | Not built | `spec/EDITOR.md` section 13 |
| R-F2-08 | The editor and `fizz-script` agree through a shared conformance corpus | Not built | `docs/TESTING.md` section 7 |
| R-F2-09 | Header words: `start`, `floor solid\|open`, `theme`; Fizz 1 `channel` lines read as two-valued states; `ground=` ignored with W112 | Not built | `spec/LANGUAGE.md` "The header"; Fizz 2 `docs/FAP.md` |
| R-F2-10 | Ids resolve to object indices; renaming an id rewrites every rule that names it; one key per colour (E107); objects cannot be reordered by hand | Not built | `spec/LANGUAGE.md` "Objects"; Fizz 2 #137, #138 |
| R-F2-11 | `lock DOOR key=COLOUR at=X,Y` expands exactly to a state, a door binding and a rule; E110 for a bad cell | Not built | `spec/LANGUAGE.md` "States and rules"; D42 |
| R-F2-12 | Every rule input, condition and action has a source form, with two conditions and two actions per rule; E113 to E118, E124 to E126, W113 | Not built | `spec/LANGUAGE.md` "States and rules"; F10, F11 |
| R-F2-13 | Effects and shared captions by name from the profile; `string` lines (32, 1 to 30 bytes, seven styles); E112, E116, W107 | Not built | `spec/LANGUAGE.md` "Rules"; Fizz 2 `cues.rs` on #140 |
| R-F2-14 | Divergence lints from the profile's physics parameters: W102 (exit needs a place to stand and press Up), W103 (a Fizz 1 level that needs a wall-kick), W105 (head room for a body size) | Not built | `spec/LANGUAGE.md`; Fizz 2 #145, `7b948ae`; D47 |
| R-F2-15 | Capability states: W106 for a feature the game cannot run yet, W109 for the reserved `theme` (until F3) and `music` | Not built | `spec/LANGUAGE.md` "Targets and capabilities"; Fizz 2 #140, #144 |
| R-F2-16 | The Fizz 1 export follows the mapping table: standard locks and rule-free two-valued states lower, every other state and rule is E120 or E121, Fizz 2-only objects E123 | Not built | `spec/LANGUAGE.md` "Lowering to Fizz 1" |
| R-F2-17 | Convert to Fizz 2 writes a new level into a world from a Fizz 1 level through the proven rasteriser, with a conversion report | Not built | `spec/LANGUAGE.md` "Converting a Fizz 1 level to Fizz 2"; D46 |
| R-F2-18 | Map painting rewrites map rows in place; the Objects window with ids and indices | Not built | `spec/EDITOR.md` section 13 |
| R-F2-19 | States, Exit and Head room lenses | Not built | `spec/EDITOR.md` section 13 |
| R-F2-20 | The canvas of a Fizz 2 level is the Game view drawn natively by the game's presenter in the game host (oblique ground, panels, Sky, Night, lights), with the flat grid as an aid and as the fallback until the game exports it | Not built | `spec/EDITOR.md` "Views"; Fizz 2 #142 to #146; D45; F5, F13 |
| R-F2-21 | A Budget window whose meters name their source and say "estimate" or "not run" when the baker is not available | Not built | `spec/EDITOR.md` "Budgets" |
| R-F2-22 | The slice level written as a script bakes, through `fizz-bake`, to the digest of the `const` slice (`fizz_ep2::level::digest`) | Not built | `docs/TESTING.md` section 7; Fizz 2 `docs/FAP.md` "Proof" |
| R-F2-23 | MCP tools for targets, worlds, objects with ids, states, rules, strings, sounds, lights, definitions, budgets, sprites and the Game view | Not built | `spec/MCP.md` section 2 |
| R-F2-24 | Placed lights: the Light tool, radius, colour or bank, falloff, flicker, a state, attachment, and the light meters | Not built | `spec/EDITOR.md` section 13; D44; F12, F22 |

## World projects (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-WLD-01 | A world project: `world.fizz`, its levels, definitions, sprites, panels, sounds and strings | Not built | `spec/WORLD.md` sections 1 and 2; D48 |
| R-WLD-02 | New level and New world fix the target; no setting changes it | Not built | `spec/WORLD.md` section 3; D46 |
| R-WLD-03 | Build world and Check world through `fizz-bake`, with its report in the Budget window | Not built | `spec/WORLD.md` section 4; F4, F15 |
| R-WLD-04 | Shared definitions used by name; a clash is E130; removing a used definition is refused | Not built | `spec/WORLD.md` section 6 |
| R-WLD-05 | Import Fizz 1 art as a read-only retro set packed in the world pack; retro levels are art only | Not built | `spec/WORLD.md` section 5; D49; F20 |
| R-WLD-06 | Convert to Fizz 2 opens a conversion report with four lists linked to the canvas | Not built | `spec/EDITOR.md` section 13 |

## States and rules (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-ST-01 | `state` with a value set and a start value; a death resets every state | Not built | `spec/LANGUAGE.md` "States and rules"; D33, D42 |
| R-ST-02 | Bindings: `door` rectangles, and `state=` with `on=` on lights and panels | Not built | As above; F11 |
| R-ST-03 | Rule inputs, conditions and actions as listed, with the limits | Not built | As above; F10, F11 |
| R-ST-04 | `lock` expands exactly; the dump view shows the expansion | Not built | As above |
| R-ST-05 | Raised events: `word` and `cue` from rules and objects, checked against the strings, captions and the world's sound library | Not built | `spec/LANGUAGE.md`; D50; F18 |
| R-ST-06 | The States window, the Rules window with Words and Sounds tabs, the States lens | Not built | `spec/EDITOR.md` section 13 |
| R-ST-07 | Rule previews run in the game host | Not built | F6 |
| R-ST-08 | The studio's state, binding and rule records equal `fizz-bake dump` for the corpus | Not built | `docs/TESTING.md` section 7 |

## Behaviour scripting (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-BHV-01 | The definition language for enemies and items: sprites per state, hitbox, stats, registers, modes, handlers, reactions, item effects | Not built | `spec/SCRIPTING.md` section 2; D51 |
| R-BHV-02 | Compilation to bytecode with a static worst-case count per handler; E201 to E208, W201 to W205 | Not built | `spec/SCRIPTING.md` sections 3 and 6.3; F17 |
| R-BHV-03 | The Definitions window and behaviour editor with the mode graph and live counts | Not built | `spec/SCRIPTING.md` section 6.1 |
| R-BHV-04 | Preview, debugger and replay in the game host | Not built | `spec/SCRIPTING.md` section 6.2; F6, F21 |
| R-BHV-05 | Behaviour cost meters: worst-case instructions against the budgets, section sizes, an estimated DOS cost | Not built | `spec/SCRIPTING.md` section 4; F22 |
| R-BHV-06 | A compiler conformance corpus and determinism fixtures equal on native, Web and DOS | Not built | `spec/SCRIPTING.md` section 8 |
| R-BHV-07 | A Fizz 1 level refuses custom definitions (E208); exporting one is E123 | Not built | `spec/SCRIPTING.md` section 7 |
| R-BHV-08 | MCP tools for definitions and behaviour runs | Not built | `spec/SCRIPTING.md` section 6.4 |

## Art (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-ART-01 | A pixel editor with the EGA constraints enforced | Not built | `spec/EDITOR.md` section 15; D52 |
| R-ART-02 | PNG import quantised to the 16 EGA colours, with a preview and repeatable settings | Not built | As above |
| R-ART-03 | Parallax panels: scroll factors, repeat, vertical position, open-air rule, state; shown in the Game view | Not built | As above; F19 |
| R-ART-04 | Drawn sprite sets painted and written canonically | Not built | As above; Fizz 2 `docs/SPRITES.md` |
| R-ART-05 | Tile textures, once the game reads them as data | Not built | F14 |

## Target profiles (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-TGT-01 | A target profile is data: dialect versions, content tables, limits, budgets, physics parameters and a capability state per feature | Not built | `spec/LANGUAGE.md` "Targets and capabilities" |
| R-TGT-02 | Profiles are generated from the game's published tables, and a test fails when a profile drifts from its game | Not built | ENGINE-CHANGES E11 (Fizz 1), F2 (Fizz 2) |
| R-TGT-03 | Every word, field and list the editor offers comes from the profile | Not built | `spec/EDITOR.md` section 13 |
| R-TGT-04 | Each capability state shows in the UI, with a Capabilities card that cites each row's source | Not built | `spec/EDITOR.md` section 13 |
| R-TGT-05 | A world names its profile at creation (`target=` in `world.fizz`) and a level's `script` line fixes its dialect; an unknown dialect version is E101 | Not built | `spec/LANGUAGE.md` "Later episodes"; D46 |
| R-TGT-06 | A new profile (Episode 3) is added as data with no change to the editor's code | Not built | `docs/TESTING.md` section 7 (a synthetic profile) |

## Sprites (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-SPR-01 | The canvas draws each object with its kind's sprite from the target's sets, by anchor and facing, and a labelled placeholder when a target has none | Not built | `spec/EDITOR.md` section 14 |
| R-SPR-02 | A Sprites window: every set and frame with size, anchor, source and provisional note; Ben's pose sets; availability per target | Not built | `spec/EDITOR.md` section 14; Fizz 2 `docs/SPRITES.md`, `7b948ae` |
| R-SPR-03 | Animation preview from the game's frame sequence, or a fixed cadence labelled as the preview's own | Not built | `spec/EDITOR.md` section 14 |
| R-SPR-04 | Fizz 2 sprite files read and written canonically: opening and saving without a change leaves the bytes unchanged | Not built | Fizz 2 `docs/SPRITES.md`, `tools/sprites/lib.ts` |
| R-SPR-05 | Sprite editing for `drawn` sets only, through the pixel editor | Not built | `spec/EDITOR.md` sections 14 and 15 |
| R-SPR-06 | A sprite preview at the night ambient through the game's palette banks | Not built | Fizz 2 #146 |

## Desktop app (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-APP-01 | A Tauri v2 desktop app in the Liminal HQ layout: `apps/studio` with a thin `src-tauri`, pure `crates/*` with no `tauri` dependency, `plugins/*` with `guest-js`, Bun and Cargo workspaces, a pinned toolchain | Not built | `spec/DESKTOP.md` sections 2 to 4; `folio/AGENTS.md` |
| R-APP-02 | `packages/chrome` from Waypoint with the studio's own tokens, `packages/protocol` generated with `ts-rs` and a drift check | Not built | `spec/DESKTOP.md` section 3 |
| R-APP-03 | `bun run validate` as the single gate, CI in the Liminal HQ containers, Dependabot grouping | Not built | `spec/DESKTOP.md` section 11 |
| R-APP-04 | Licence headers on every source file and `THIRD_PARTY_NOTICES.md` with licences checked by `cargo deny` | Not built | `spec/DESKTOP.md` section 8 |
| R-APP-05 | Windows created in Rust with the proposed labels and capabilities per concern; pop-outs through tear-off | Not built | `spec/DESKTOP.md` section 6 |
| R-APP-06 | Settings, layouts and recent worlds in a Rust-owned settings document; no browser storage, checked by the gate | Not built | `spec/DESKTOP.md` section 7 |
| R-APP-07 | Every user-visible string from the message catalogue; error and lint messages as catalogue keys | Not built | `spec/DESKTOP.md` section 8 |
| R-APP-08 | Logging through `tauri-plugin-log`, never logging script text or Claude's messages | Not built | `spec/DESKTOP.md` section 8 |
| R-APP-09 | Rust owns each world: intents in, patches out, one writer, a monotonic revision, named undo and redo in Rust, stale answers refused | Not built | `spec/DESKTOP.md` section 5; D55 |
| R-APP-10 | Native files: atomic canonical writes, file watching for hand and Claude edits, autosave and crash recovery, single instance | Not built | `spec/DESKTOP.md` section 9 |
| R-APP-11 | The game host links both games natively and streams frames and traces over `Channel`s | Not built | `spec/DESKTOP.md` section 4; D59 |
| R-APP-12 | Claude's MCP server as a stdio sidecar with live and headless modes, propose by default, accept and reject in the app | Not built | `spec/MCP.md`; D57 |
| R-APP-13 | Packages for Linux (deb, rpm, AppImage) and Windows 11 (msi, nsis), x64 and arm64, with opt-in signed updates | Not built | `spec/DESKTOP.md` section 10 |
| R-APP-14 | Keyboard-operable throughout, with the canvas's objects as a focusable list | Not built | `spec/DESKTOP.md` section 12 |
| R-APP-15 | The running app tested through `tauri-mcp-server` and the debug-only MCP bridge | Not built | `spec/DESKTOP.md` section 13; D60 |
| R-APP-16 | The Fizz 1 dialect ported to Rust, matching every TypeScript fixture and every Episode 1 proof | Not built | D56 |

## Performance requirements

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-PERF-01 | Paint to canvas and script within 16 ms on a 7,040-cell level | Not built | Not measured in a studio; parse plus rasterise of the slowest real level (Frosting Spire) averages 0.35 ms and the overworld 0.71 ms in Bun 1.3.10 on an AMD Ryzen 7 7700X |
| R-PERF-02 | Open any level in under 1 s | Not built | |
| R-PERF-03 | `prove-all.sh` under 2 minutes with a warm cache | Not built | Not timed |
