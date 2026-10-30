# Fizz Level Studio — product specification

Fizz Level Studio is the level and overworld editor for Lieutenant Fizz (`liminal-hq/lieutenant-fizz`). A person and Claude (over MCP) design levels together in it. Every level and every overworld is a short text script in the Fizz builder language; the studio paints on that script, Claude proposes changes to it, and an exporter turns it into the Rust `Builder` calls the game compiles.

This document is the main spec. The companion documents go deeper:

| Document | What it covers |
| --- | --- |
| [docs/GOALS.md](docs/GOALS.md) | The goals, ranked, each with a measure of success |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Packages, data flow, what the game owns, the WebAssembly plan, the file layout |
| [docs/EDITOR.md](docs/EDITOR.md) | The editor's behaviour, screen by screen |
| [docs/MCP.md](docs/MCP.md) | The MCP server as built, and the tools still to add |
| [docs/OVERWORLD.md](docs/OVERWORLD.md) | The overworld model, its script, its exporter and the steps to add a level |
| [docs/ENGINE-CHANGES.md](docs/ENGINE-CHANGES.md) | What the game itself must change |
| [docs/TESTING.md](docs/TESTING.md) | What is tested today, what each test proves, and the gaps |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, exit criteria and dependencies |
| [docs/DECISIONS.md](docs/DECISIONS.md) | The decisions taken, with reasons and the alternatives set aside |
| [docs/LANGUAGE.md](docs/LANGUAGE.md) | The language reference: grammar, Builder equivalents, errors |

## 1. Summary

The studio has four parts, three of which exist today in this folder:

1. **The builder language** (`packages/language`) — a parser, printer, edits helper, Rust exporter, overworld module and language docs. Built and tested: 76 `bun test` cases, and a Rust proof that the scripts for all 16 Episode 1 levels and the overworld rebuild the game's data exactly.
2. **The MCP server** (`packages/mcp`) — nine tools that let Claude read a level, render it as text, check it and write `paint`, `clear` and `place` lines to it, in a propose mode (the default) or a direct mode that only the person can turn on. Built and tested: 21 `bun test` cases including a real stdio round trip.
3. **The design prototype** (`design/project/Proto.dc.html`) — an interactive design of the editor: the Ultimate layout, tools, objects, the overworld designer, lenses, the script panel with completion, and the starter levels. It is a design, not the product: Claude's ideas are canned, nothing is saved and the playtest bot is a stand-in.
4. **The studio application** — not built. This spec describes it.

A fifth part is planned: **the Fizz 2 target**. Lieutenant Fizz 2 bakes its levels from `.fizz` sources written in a dialect that is a superset of the Fizz 1 script (`script fizz2 0`), with a map grid, exact positions, channels, locks and a `when ... then ...` rule layer, and the editor gains a Target setting (Fizz 1 or Fizz 2) with a Fizz 1 export check. None of it is built; see §6.1, `docs/LANGUAGE.md` and `docs/EDITOR.md` section 13.

What has been proven, exactly:

- All 16 levels of Episode 1, rebuilt from their scripts through the exporter, equal the game's levels exactly, including each level's fingerprint (`scripts/prove-all.sh`). The studio's rasteriser agrees with the game on every tile, item, enemy and start of all 16.
- The overworld script rebuilds `build_overworld()` exactly: 2,640 tiles including 200 trees and 32 rocks, 27 points, five areas and the start.
- The language gained platform `size=` and `dwell=` and `channel LIST on|off` because real levels use them (Zarg Lookout and Frosting Spire have sized lifts with rest times; Mirror Shafts starts channels 1, 2 and 3 on), and the edits block gained enemies, `hover`, `channel`, `room` and `secret-room`.

Gaps found by auditing the game:

- `MapPoint::req` is a `u16` and `SECRET_FOUND` is bit 15, so bits 0..15 are all used (15 levels plus the secret-found flag). Adding a level needs the requirement mask widened (see [ENGINE-CHANGES E4](docs/ENGINE-CHANGES.md#e4-widen-the-progress-and-requirement-masks)).
- The game builds one overworld (`build_overworld()`, with `overworld_areas()`, `overworld_thumb()` and the `area_of` export all assuming it).
- The exporter writes the level function only; it does not register a level in the `LEVELS` table.
- `OverworldBuilder` exists only in the proof copy (`scratch/rust/.../ow_builder.rs`); it has to be added to the game's `levels.rs`.

Not done or not verified:

- The prototype has canned Claude ideas, saves nothing and has no real playtest bot.
- The prototype's Paths lens is computed in JavaScript and is approximate on slopes; the real one must come from the game's WebAssembly.
- Enemy kinds `beetle`, `bat`, `pod`, `phantom`, `roller`, `sentry`, `boss` and `cage` have only one-line summaries in `docs.ts`.
- The prototype draws one character per cell, so an item that shares a block with an enemy or another item is hidden: 16 items across 7 levels (the starter-levels card shows each level's count).
- Lifts, rooms and the arena cannot yet be dragged by every corner: a lift drags by its two ends, a room by its body, the arena not at all.
- The MCP server has no tools for objects or the overworld; there is no sprite picker.

## 2. Goals

Each goal is specific and testable. [docs/GOALS.md](docs/GOALS.md) ranks them and gives each a measure.

### Creative flow

- **G-FLOW-1** A person can open any Episode 1 level or the overworld and make a visible change in under a minute, without reading the manual.
- **G-FLOW-2** Every edit, whether painted, dragged, typed or accepted from Claude, is one undo step with a name, and undo and redo restore the level and its script exactly.
- **G-FLOW-3** The level is the canvas; every other window floats, snaps within 8 px, resizes, collapses and can be reset with Ctrl+Shift+0.
- **G-FLOW-4** Typing a line gives completion for every word the language knows, from `packages/language/src/docs.ts`.

### Correctness and trust

- **G-TRUST-1** A script that exports, compiles and runs produces a level whose fingerprint equals the one the studio shows; any difference is a failing test.
- **G-TRUST-2** Hand-written lines are never rewritten: after any number of studio edits, every hand-written line the studio did not own prints byte for byte as written.
- **G-TRUST-3** Nothing Claude writes reaches the level file without passing the language parser, and in propose mode nothing reaches it without the person's accept.
- **G-TRUST-4** The studio never claims what it has not checked: a check that did not run says so (as `run_checks` does with `playtest_bot: "not run"`).

### Collaboration with Claude

- **G-AI-1** Claude can read any level or overworld as text, see the person's selection, and propose tile, item, enemy, object and overworld changes as reviewable hunks.
- **G-AI-2** Propose is the default; only the person can switch to direct, accept or reject, and no MCP tool can change the mode.
- **G-AI-3** Claude and the person edit one script; each sees the other's changes on the next read, with no separate copy to merge.

### Fidelity to the game

- **G-GAME-1** The studio's picture of a level agrees with the game on every tile, item, enemy and start, checked against data the game itself produces.
- **G-GAME-2** Anything that depends on simulation rules (enemy paths, reachability, playtests) comes from the game's WebAssembly, never from rules re-derived in TypeScript.
- **G-GAME-3** Every name the language uses (tiles, items, kinds, level ids, themes, areas, scatter rates, sprite names) is checked against the game's own tables by a test.

### Openness to Rust-written content

- **G-RUST-1** Both authoring paths stay: a level may be a script that exports to Rust, or hand-written procedural Rust that the studio opens by reading its data.
- **G-RUST-2** Generated and procedural statements (terrain runs, `crystal`, `pogo-cache`, `ladder`, stairs, `vine-nook`, `scatter`, `path`) stay in the language beside painted fills.

### Performance

- **G-PERF-1** A paint stroke updates the canvas and the script within one 60 Hz frame (16 ms) on the largest Episode 1 level (Marshmallow Meadows, 220 × 32, 7,040 cells).
- **G-PERF-2** Opening any Episode 1 level or the overworld takes under one second from choosing it to a drawn canvas.
- **G-PERF-3** The full proof (`scripts/prove-all.sh`) stays under two minutes on a developer machine with a warm Cargo cache.

## 3. Non-goals

- **Arbitrary Rust in scripts.** Loops over computed positions, closures, constants, `if`, `.find(...)` and `b.ground_at(...)` stay in Rust. Such a level is opened by reading its data, not by writing it as a script.
- **Fractional item positions.** Items sit at the middle of a whole block; a fractional treat position is not supported now.
- **Variables, macros, includes, whitespace-insensitive layout.** A script is a flat list of literal statements.
- **Re-deriving simulation rules in TypeScript.** The prototype's JavaScript paths lens is a reference for the design only.
- **Claude accepting its own proposals or changing the mode.** Not through any tool, ever.
- **Editing the game's physics, enemy behaviour or tuning.** The studio places things; the game decides how they behave.
- **A general-purpose tile editor for other games.** The language is a skin over this game's `Builder`.
- **Porting the design prototype's code.** `design/` is reference only, as in the game repository.

## 4. Users and scenarios

| User | Wants |
| --- | --- |
| Level designer (the owner) | Paint a level fast, see what is wrong with it, try Claude's ideas without risk, and get Rust that drops into the game |
| Claude, over MCP | Read the level precisely, propose small reviewable changes, explain why, and learn what the person kept |
| Engine developer | Generated Rust that is obviously correct, proofs that fail loudly, and no surprises in `levels.rs` |
| A later contributor | Scripts that read as a description of the level, and docs that say what each word does |

Scenarios the product must support:

1. **Tune an existing level.** Open Crater Fields from the starter-levels card, turn on the Gaps lens, see the 6-wide pool flagged "needs a ledge", paint a one-way stone, check the gap turns green, save. The script gains one `paint one-way ...` line under `edits`.
2. **Ask Claude.** Select the second pool and ask for an idea. Claude reads the region, proposes "Stepping stone over the pool" as a hunk, and the ghost appears dashed purple. Accept writes it as one undo step; reject leaves the file byte-identical.
3. **Let Claude draft.** Turn on direct mode for a draft level. Claude's edits land at once, each one an undo step Claude or the person can take back.
4. **Move a lift.** In Zarg Lookout, select the lift, drag its B end up two tiles. Its `hover` line is rewritten in place; there is still exactly one lift.
5. **Design the overworld.** Open the overworld, add a level point with the Point tool, set its Unlocks chips to Crater Fields, check the Links lens draws the unlock line, pair two teleporters, export, and see the game's overworld change.
6. **Add a new level.** Write a new script, register it (id, `LEVELS` row, overworld point), widen the mask if needed, export, and play it. This needs the engine changes in [docs/ENGINE-CHANGES.md](docs/ENGINE-CHANGES.md).
7. **Open a Rust-written level.** A level written as procedural Rust opens in the studio from the game's data, read only for its procedural parts, with edits layered on top.
8. **Check a level is finishable.** Run the playtest bot from the studio (or Claude runs it over MCP) and see whether the exit was reached, through the game's own simulation.

## 5. The product

[docs/EDITOR.md](docs/EDITOR.md) describes every screen. This section is the shape.

### 5.1 Workspace

The **Ultimate** layout is home: the level fills the window, and every other panel is a floating window over it. Windows: tool rail; Palette and Outliner (tabs); Objects; History; Checks; Lens bar; Inspector; Review changes and Claude (tabs); Script and Playtest (tabs); Navigator. A window drags by its header, snaps within 8 px to the workspace edges, an 8 px margin and other windows (with orange guides), resizes by its corner grip down to a minimum size, collapses to its header, and comes to the front when grabbed. The script can pop out into its own window ("Display 2"). Menus: the app menu, then File, Edit, View, Level, Claude, Window and Help, plus a right-click menu on the thing under the cursor and a shortcuts card on `?`.

### 5.2 Tools

| Tool | Key | Where | Does |
| --- | --- | --- | --- |
| Paint | B | both | Places the chosen tile, item or enemy; a dragged stroke is one undo step |
| Erase | E | both | Clears cells |
| Pick | I | both | Copies a cell into the palette and switches to Paint |
| Select | S | both | Selects a cell, or drags a rectangle; drags objects |
| Stamp | T | both | Pastes the copied area with its top-left on the clicked cell; one undo step; cells past the edge are skipped |
| Lift | L | level | Drag from one end to the other to add a moving platform |
| Room | R | level | Drag a rectangle to add a room |
| Arena | A | level | Drag a width to add the boss arena |
| Point | P | overworld | Click to add the point kind chosen in the Objects window |
| Pan | H (in the Ultimate design) | both | Not built |

### 5.3 Tiles and objects

Tiles are painted. A painted tile, item or enemy becomes a line appended to the `edits` block, such as `paint block x=3..5 y=2` or `place cheezie x=40..43 y=7`.

Objects are different. A lift (`hover`), room (`room`, `secret-room`), the boss arena (`arena`), the switch channels that start on (`channel`), and on an overworld each point (`level`, `tele`, `saucer`, `sign`) and area (`area`) is **one line**, and **the studio owns that line**: when the object changes, the studio rewrites that one line in place, so moving a lift never adds a second one. An object the studio adds goes under `edits`. An object the person deletes has its line turned into a comment (`// removed in the studio: ...`). A hand-written line the studio did not touch is never rewritten.

### 5.4 Overworld designer

The next big feature. An overworld is a script (`overworld "Name" WxH id=...`), there can be more than one, and it compiles to Rust through an `OverworldBuilder`. The designer paints the map like a level and places points: level points (with **unlock rules**: the levels to clear first, or the secret), **teleporters** paired by name, signs and the saucer. The Links lens draws unlock lines and teleporter pairs; the Areas lens outlines the regions that decide the scatter. Later: **level sprites** on points, chosen from the game's sprite names. [docs/OVERWORLD.md](docs/OVERWORLD.md) has the model.

### 5.5 Lenses

Lenses draw over the level without changing it. Level: Gaps, Ghosts, Reach, Hazards, Paths (Alt+1 to Alt+5). Overworld: Links, Areas, Ghosts. Ctrl+Shift+L hides them all. The Gaps rule: up to 3 wide "a jump clears it", exactly 4 "tight: a tenth of a second", 5 or more "needs a ledge". The Paths lens shows where walking enemies go; the real one asks the game's WebAssembly (see [ARCHITECTURE §5](docs/ARCHITECTURE.md#5-the-webassembly-boundary)).

### 5.6 Script panel and completion

The script is always in sync with the canvas. Claude's lines carry a purple `+`; pending lines are tinted. Clicking a line selects its thing; selecting a thing highlights its line and the script follows unless Following is off. A box under the script takes a typed line, applies it as one undo step, and explains a line it cannot read with a suggested fix and a "Use this fix" button. Completion offers statement words, then tile or item words after `paint` and `place`, then field names, then values for `req=` and `with=`, from `docs.ts`.

### 5.7 Starter levels

File, Open starter level lists 18 entries: the 16 Episode 1 levels rebuilt from the game's own data, the overworld, and a small sample draft. Crater Fields opens first. Each card shows the size, the counts of treats, enemies, lifts and rooms, the boss arena, and how many items the one-character grid hides.

### 5.8 Claude and MCP

Claude reaches the studio through an MCP server. Today's server ([docs/MCP.md](docs/MCP.md)) works on one `.fizz` level file and a sidecar `<level>.studio.json`; the real studio adds the selection, objects, overworlds, paths, playtests and the language docs. **Propose** is the default: Claude's edit is a pending proposal shown as ghosts. **Direct** is a switch only the person can turn on; each direct edit is one undo step. **Accept and reject are never MCP tools**; today they exist only in the CLI that stands in for the studio's buttons.

## 6. The language

The language is specified in [docs/LANGUAGE.md](docs/LANGUAGE.md). The essentials:

- A script is lines; one line does one thing; `//` starts a comment. Statements run in file order, exactly as the Builder runs; section headers (`terrain`, `blocks`, `treats`, `enemies`, `edits`) label lines and never reorder them.
- Coordinates are tiles. **y counts up from the bottom**; row 0 is the bottom of the world.
- **Items sit at the middle of a whole block**: `soda x=36 y=5` is stored at (36.5, 5.5).
- `edits` is last and runs after everything else. It takes `paint`, `clear`, `place`, any enemy line, `hover`, `channel`, `room` and `secret-room`.
- Errors are per line, with a code (E001 to E016), a message and a suggested fix; a bad line stays in the AST so the file still prints back unchanged.

```text
level "Crater Fields" 192x28 ground=4 id=crater
start 3,4

terrain
  flat 14, up 2, flat 6, down 2, flat 5
  pool 4, flat 8, up22 2, flat 10, gap 3, flat 9, down22 2, flat 6

blocks
  plat     x=107..108 y=5
  crystal  x=10,26,60,98,118,150,178

treats
  row choc    x=46..52 y=8 by=3
  pogo-cache  x=8..10 rise=7

enemies
  drone  x=88.5,165.5 y=7.5

edits
  paint one-way x=26,28,30 y=9
  place cheezie x=26,28,30 y=10
```

An overworld script has `overworld`, `start`, `area` lines, a `blocks` section (tile fills, `path from=.. to=..` routes and `scatter`), a `points` section (`level`, `tele`, `saucer`, `sign`) and an optional `edits` block. [docs/OVERWORLD.md](docs/OVERWORLD.md) has its grammar.

Note: the "What v0 does not cover" list at the end of `docs/LANGUAGE.md` predates the overworld module and the 16-level proof; its "Overworld maps" and "Proof coverage" items are superseded by the overworld section above it and by `scripts/prove-all.sh`.

### 6.1 The Fizz 2 dialect (planned)

- **A superset.** First line `script fizz2 0`. Every Fizz 1 script still parses and prints; only the Fizz 2 subset lowers to a level.
- **Syntax.** A `map` block with a legend (slope letters and letters reserved for Fizz 1 tiles without a Fizz 2 id), `at=` for exact positions beside `x=`/`y=` for cell centres (the printer writes `x=`/`y=` only for exact cell centres), `chicken`, `soda`, `floor`, a required `id=` on every object, and objects stably sorted by kind. Errors reuse E001 to E016 and add E1xx; lints are W1xx.
- **Doors and rules.** Channels are state, switched tiles read a channel, keys and items are facts, locks sit on the door, and `when <trigger> [if channel N on|off] then <actions>` rules are compiled at bake time into fixed 32-byte records, with no VM and no rule text on DOS. `channel 1,2 on` sets the start state, and W101 warns when a door channel starts off unless the level says `allow W101`.
- **The baker.** `fizz-script` (the parser crate) and `fizz-bake` in the Fizz 2 repository decide what a script bakes to (`LEVL` v2, `LIGHT.FAP`, manifests, digests). The editor must agree with them.
- **Fizz 1 export.** A lowering plus a check: `map` to blocks, `at=` snapped with W104, `chicken` to `gloop`, E120 for a non-standard lock, E121 for any `when`, E122 for a solid `floor`.
- **What is not decided** is listed in [docs/DECISIONS.md](docs/DECISIONS.md) (the 2026-10-30 log entry) and in §11 below.

## 7. Architecture

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the detail. The layers, and which owns what:

| Layer | Owns | Today |
| --- | --- | --- |
| The game (Rust, `episodes/episode-1/game`, `crates/sim`) | The simulation, the `Builder`, the level and overworld tables, fingerprints, the playtest bot | In the game repository; copied into `scratch/rust/` for the proofs |
| Language package (`packages/language`) | Text ↔ AST, the edits rule, Rust export, the overworld model and rasteriser, the language docs | Built |
| Level rasteriser (`packages/mcp/src/world.ts`) | A picture of a level script, for drawing and structural checks | Built; agrees with the game on all 16 levels |
| MCP server (`packages/mcp`) | Claude's tools, proposals, modes, history, notes | Built for one level file |
| Studio app | The workspace, tools, objects, lenses, history, the script panel | Prototype only |
| WebAssembly bridge | Enemy paths, playtests, level data for Rust-written levels, a level built from a script | Not built |

The boundary rule: **the Rust crate owns the simulation; TypeScript owns presentation.** The rasteriser mirrors level construction (the `Builder`), which is proven equal to the game on every level; anything that needs simulation rules (how an enemy walks, whether a jump lands, whether a level can be finished) is asked of the game's WebAssembly through the raw C-ABI exports, never re-derived.

Data flow: script text → `parse` → AST (one node per line, with its raw text) → `toRust` → Rust `fn name() -> LevelData` (into the game) and → `rasterise` → `World` (into the canvas, `get_region` and `run_checks`). Overworld scripts go through `parseOverworld` → `overworldToRust` and `rasteriseOverworld`.

## 8. Data and files

| File | Format | Owner |
| --- | --- | --- |
| `levels/<slug>.fizz` | A level script | The person, the studio (edits block and owned object lines), Claude (through the MCP server) |
| `overworlds/<id>.fizz` | An overworld script | As above |
| `<level>.studio.json` | The sidecar: `version`, `mode`, `nextId`, `nextNote`, `history`, `notes` | The MCP server and the person's CLI |
| Generated Rust (`fn <slug>_fizz() -> LevelData`, `fn <name>() -> MapData`) | Rust source with a "generated from a Fizz script; edit the script" doc comment | The exporter only |
| `design/project/levels-data.js`, `lang-docs.js` | Generated data for the prototype | `tools/gen-proto-levels.ts`, `tools/gen-lang-docs.ts` |
| `scratch/truth/*.json` | The game's own level and overworld data, dumped by tests | `dump_all_truth`, `dump_overworld_truth` |

Writes are atomic: a temporary file in the same folder, then a rename (`writeAtomic` in `packages/mcp/src/studio.ts`). The level file is reloaded on every MCP call, so an edit made in a text editor shows on the next read.

## 9. Correctness strategy

Correctness rests on proofs against the game's own data, not on reading the code. [docs/TESTING.md](docs/TESTING.md) lists every test.

| Proof | Command | Proves |
| --- | --- | --- |
| Language unit tests | `bun test packages/language` | Parser, printer round trip, edits rule, every error code, exporter output, overworld parsing and export, docs completeness (76 tests) |
| MCP tests | `bun test packages/mcp` | Propose, direct, accept, reject, undo, refusals, rendering, checks, a real stdio session (21 tests) |
| Crater and kitchen sink | `bash scripts/prove-crater.sh` | The hand-written `levels/crater.fizz` equals `crater()` field by field and by fingerprint; `scratch/kitchen-sink.fizz`, which uses each v0 statement once, compiles and runs |
| Every level and the overworld | `bash scripts/prove-all.sh` | All 16 scripts in `levels/real/` equal the game's levels (tiles, switches, spawns, items, platforms, start, arena, rooms, fingerprint); `overworlds/main.fizz` equals `build_overworld()`; the TypeScript rasterisers agree with the game's dumped data |
| Design harness | `tools/design-harness/*.cjs` | The prototype's behaviours in a real headless Chromium, with audio muted |

The proofs need Rust and the crates already in the local Cargo cache (`--offline`); they build only inside `scratch/rust/`, a copy of the game's `crates/sim` and `episodes/episode-1/game` that differs from the game only by the proof modules: four `#[cfg(test)]` declarations at the end of `levels.rs` and the files they include (checked with `diff` on 2026-10-18).

## 10. Requirements

Status values: **Proven** — built in `packages/language` or `packages/mcp` and shown equal to the game by a Rust proof. **Package** — built in `packages/language` or `packages/mcp` and covered by its unit tests, not proven against the game. **Prototype** — built in the design prototype only. **Not built**.

### Language and export

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

### Overworld

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
| R-OW-12 | Level sprites on points, with a sprite picker | Not built | ENGINE-CHANGES E10 |
| R-OW-13 | Canonical printing of overworld nodes built in memory | Not built | `printOverworld` prints raw lines only |

### Editor

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-ED-01 | Ultimate layout: level as canvas, floating windows that snap within 8 px, resize to a minimum, collapse, come to front | Prototype | `e2e.cjs`, `guide-e2e.cjs` |
| R-ED-02 | Reset layout (Ctrl+Shift+0); save and restore a layout | Prototype | Session only; nothing written |
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
| R-LENS-03 | Paths lens from the game's WebAssembly | Not built | The prototype's JavaScript is a reference, approximate on slopes |
| R-SCR-01 | Script panel in sync, Claude's lines marked, click a line to select, following selection | Prototype | `e2e3.cjs`, `guide-e2e.cjs` |
| R-SCR-02 | Typed line applies as one undo step; a bad line gets an explanation and a fix | Prototype | Uses the prototype's own JavaScript checker, not the language parser |
| R-SCR-03 | Completion from `docs.ts` | Prototype | `compl-e2e.cjs` |
| R-SCR-04 | The typed line, the script panel and file loading use `packages/language` | Not built | |
| R-START-01 | Starter-levels card with 18 entries; Crater Fields opens first | Prototype | `proto-levels-e2e.cjs` |
| R-START-02 | Every item drawn even when it shares a block | Not built | 16 items hidden across 7 levels |

### Claude and MCP

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

### Game, WebAssembly and Rust content

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-RUST-01 | Open a hand-written Rust level by reading its data | Package | Offline only: `dump_all_truth` then `tools/decompile-level.ts` |
| R-RUST-02 | Read level data from WebAssembly at run time | Not built | ENGINE-CHANGES E6 |
| R-RUST-03 | Edits to a Rust-written level are kept and exported | Not built | Open question Q2 |
| R-WASM-01 | Build and enter a level from a script inside the sim, without recompiling | Not built | ENGINE-CHANGES E7 |
| R-WASM-02 | Enemy paths from the sim | Not built | ENGINE-CHANGES E8 |
| R-WASM-03 | Playtest bot from the studio and over MCP | Not built | The bot exists as `#[cfg(test)]` Rust (`playtest.rs`) |
| R-ENG-01 | Widen the requirement mask so a 16th level fits | Not built | ENGINE-CHANGES E4 |
| R-ENG-02 | A level and overworld registry the exporter can write to | Not built | ENGINE-CHANGES E3, E5 |

### Fizz 2 target (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-F2-01 | `script fizz2 0` is a superset of the Fizz 1 script: every Fizz 1 script parses and prints unchanged | Not built | `docs/LANGUAGE.md` |
| R-F2-02 | `map` grid with the full legend, `at=` versus `x=`/`y=` with the printer rule, `chicken`, `soda`, `floor`, required `id=`, objects sorted by kind | Not built | `docs/LANGUAGE.md` |
| R-F2-03 | `channel`, `lock`, `when ... then ...` and `allow`, with the 32-rule limit | Not built | `docs/LANGUAGE.md` |
| R-F2-04 | Errors E1xx and lints W1xx, with W101 | Not built | `docs/LANGUAGE.md` |
| R-F2-05 | A Target setting that greys out what Fizz 1 lacks and runs the Fizz 1 export check (E120 to E122, W104) | Not built | `docs/EDITOR.md` section 13 |
| R-F2-06 | Snap to floor writing `at=`, close all doors, a Rules window, rule lints inline | Not built | `docs/EDITOR.md` section 13 |
| R-F2-07 | A dump view equal to the baker's disassembly | Not built | `docs/EDITOR.md` section 13 |
| R-F2-08 | The editor and `fizz-script` agree through a shared conformance corpus | Not built | `docs/TESTING.md` section 7 |

### Performance requirements

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-PERF-01 | Paint to canvas and script within 16 ms on a 7,040-cell level | Not built | Not measured in a studio; parse plus rasterise of the slowest real level (Frosting Spire) averages 0.35 ms and the overworld 0.71 ms in Bun 1.3.10 on an AMD Ryzen 7 7700X |
| R-PERF-02 | Open any level in under 1 s | Not built | |
| R-PERF-03 | `prove-all.sh` under 2 minutes with a warm cache | Not built | Not timed |

## 11. Open questions

| Id | Question | Notes |
| --- | --- | --- |
| Q1 | Is the `edits` block an append-only log, or regrouped from the grid? | `appendEdits` appends; the prototype rebuilds the block from the difference between the grid and the hand-written level, grouped by row. The decision says "appended". A long session therefore grows the block; a "tidy edits" command that the person runs could merge lines. |
| Q2 | Where do edits to a Rust-written level live? | Options: a script that names the Rust function as its base and holds only `edits`, exported as a call after it; or the decompiled fill script replacing the Rust (loses the procedure). |
| Q3 | How does the sim build a level from a script without a rebuild? | ENGINE-CHANGES E7 proposes a builder-op stream that the Rust `Builder` executes; the alternative is to serialise the rasteriser's output. |
| Q4 | How are objects identified across hand edits? | The prototype reads object lines once on open and keys them by line index. A file edited outside the studio moves lines. Matching by line number plus original text, and refusing when it changed, is the proposal in docs/MCP.md. |
| Q5 | Which overworld does a level belong to, and how do players move between overworlds? | No design yet; see docs/OVERWORLD.md. |
| Q6 | What does `arena` do when added by the Arena tool? | The prototype writes a new arena under `edits`, and the parser accepts `arena` there (a second one is E006). Open: whether the studio should instead move it above the first section. |
| Q7 | How is the playtest route given for a new level? | The bot needs waypoints (`Waypoint::stand`, `Waypoint::gate`); the Rust tests write them by hand per level. |
| Q8 | Is the level table's `icon` (sprite) set by the script, the overworld point, or the registry? | See ENGINE-CHANGES E10. |
| Q9 | How do two processes share the sidecar safely? | Today the server and the CLI read-modify-write it with no lock. |
| Q10 | Does the editor keep a TypeScript parser for the Fizz 2 dialect or load `fizz-script` as WebAssembly? | Not decided; a shared conformance corpus is needed either way (`docs/ARCHITECTURE.md` section 7). |
| Q11 | Which legend letter means which tile, and how are the E1xx and W1xx codes beyond those named assigned? | Fixed by the Fizz 2 repository's tile table and validator; this spec follows it. |
| Q12 | The Fizz 2 planner's twelve open questions (a conditional hash step, channels persisting over a death, captions, limits, lock semantics and more) | Listed in `docs/DECISIONS.md`, awaiting the owner. |
| Q13 | How is a shaft that only a wall-kick could climb refused, given Fizz 2 has no wall-kick? | Open; the baker or an editor check. |

## 12. Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| The scratch copy drifts from the game | The proofs pass against old code | Move the proofs into the game repository (R-EXP-04); until then, `diff -r` the copy before trusting a run |
| Name tables drift (`tables.ts`, `SCATTER_RATES`, `AREA_RUST`) | A script compiles to the wrong tile or theme | Generate them from the game or test them against it (ENGINE-CHANGES E11) |
| The TypeScript rasteriser diverges from the `Builder` on a statement no real level uses | The canvas lies about a level | Proof on every statement, not only the 16 levels; prefer the sim's own build (E7) |
| The progress mask is full | A 16th level silently shares the secret-found bit | Widen before adding a level (E4), with a save migration |
| Object identity across hand edits | The studio rewrites the wrong line | Match by line and original text; refuse otherwise (Q4) |
| The `edits` log grows without bound | Scripts become hard to read | A person-run tidy command; fold edits into sections on request |
| Claude proposals go stale | Accepting writes something that no longer fits | `accept` revalidates against the current file (built); show the conflict in the studio |
| The playtest bot is slow in a browser | The studio stalls | Run it in a worker with a tick budget per step (E9) |
| The design prototype is mistaken for the product | Canned behaviour is relied on | The prototype labels canned parts; this spec marks every requirement's status |
| Two parsers drift (TypeScript here, Rust in `fizz-script`) | The editor accepts a script the baker rejects, or the reverse | A shared conformance corpus in both repositories' tests (G-F2-1) |

## 13. Milestones

[docs/ROADMAP.md](docs/ROADMAP.md) has exit criteria and dependencies.

| Milestone | Delivers |
| --- | --- |
| M0 Spec | This document and `docs/` |
| M1 Overworld designer | The first slice of the real studio: open, paint and place points on an overworld script, unlock rules, teleporters, Links and Areas lenses, object lines rewritten in place by the language package, overworld MCP tools, `OverworldBuilder` in the game |
| M2 Level editing | The level tools, objects, lenses (except Paths), script panel, completion and saving, on the language package |
| M3 Registry and progress | A level and overworld registry, the wider mask, export that registers a level |
| M4 Claude in the studio | The MCP server attached to the live studio: selection, ghosts, accept and reject buttons, object tools |
| M5 WebAssembly bridge | Level data from the game, a level built from a script inside the sim, enemy paths, the playtest bot |
| M6 Sprites and Rust levels | The sprite picker and level sprites, editing on top of Rust-written levels |
| M7 Fizz 2 target (planned) | The Fizz 2 dialect, the Target setting, the Fizz 1 export check, rule authoring and the dump view |
