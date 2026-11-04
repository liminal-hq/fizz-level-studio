# Fizz Level Studio — product specification

Fizz Level Studio is the level and overworld editor for Lieutenant Fizz (`liminal-hq/lieutenant-fizz`) and Lieutenant Fizz 2. A person and Claude (over MCP) design levels together in it. Its end goal is a **desktop app built with Tauri v2 to the Liminal HQ Tauri standards**, like Folio, Waypoint, Jar and Cadence: Linux first, Windows 11 a real target, no mobile and no browser build ([docs/DESKTOP.md](docs/DESKTOP.md)). Every level and every overworld is a short text script in the Fizz builder language; the studio paints on that script, Claude proposes changes to it, and an exporter turns it into the Rust `Builder` calls the game compiles.

This document is the main spec. The companion documents go deeper:

| Document | What it covers |
| --- | --- |
| [docs/GOALS.md](docs/GOALS.md) | The goals, ranked, each with a measure of success |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Packages, data flow, what the game owns, the game host, the file layout |
| [docs/DESKTOP.md](docs/DESKTOP.md) | The Tauri v2 desktop app to the Liminal HQ standards: platforms, stack, layout, crates and plugins, state, windows, settings, files, packaging, CI |
| [docs/EDITOR.md](docs/EDITOR.md) | The editor's behaviour, screen by screen |
| [docs/MCP.md](docs/MCP.md) | The MCP server as built, and the tools still to add |
| [docs/OVERWORLD.md](docs/OVERWORLD.md) | The overworld model, its script, its exporter and the steps to add a level |
| [docs/ENGINE-CHANGES.md](docs/ENGINE-CHANGES.md) | What the game itself must change |
| [docs/TESTING.md](docs/TESTING.md) | What is tested today, what each test proves, and the gaps |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, exit criteria and dependencies |
| [docs/DECISIONS.md](docs/DECISIONS.md) | The decisions taken, with reasons and the alternatives set aside |
| [docs/LANGUAGE.md](docs/LANGUAGE.md) | The language reference: grammar, Builder equivalents, errors, the Fizz 2 dialect and the target profiles |
| [docs/FIZZ2-COVERAGE.md](docs/FIZZ2-COVERAGE.md) | Every Fizz 2 feature an author controls, against the document that handles it |
| [docs/WORLD.md](docs/WORLD.md) | World projects: a world's levels, definitions, sprites, panels, sounds and strings, built into one world pack; the retro art set |
| [docs/SCRIPTING.md](docs/SCRIPTING.md) | Custom enemies and items with behaviour scripts compiled to bytecode, the step budget, the behaviour editor and debugger |

## 1. Summary

The studio has four parts, three of which exist today in this folder:

1. **The builder language** (`packages/language`) — a parser, printer, edits helper, Rust exporter, overworld module and language docs. Built and tested: 76 `bun test` cases, and a Rust proof that the scripts for all 16 Episode 1 levels and the overworld rebuild the game's data exactly.
2. **The MCP server** (`packages/mcp`) — nine tools that let Claude read a level, render it as text, check it and write `paint`, `clear` and `place` lines to it, in a propose mode (the default) or a direct mode that only the person can turn on. Built and tested: 21 `bun test` cases including a real stdio round trip.
3. **The design prototype** (`design/project/Proto.dc.html`) — an interactive design of the editor: the Ultimate layout, tools, objects, the overworld designer, lenses, the script panel with completion, and the starter levels. It is a design, not the product: Claude's ideas are canned, nothing is saved and the playtest bot is a stand-in.
4. **The studio application** — not built. It is planned as a Tauri v2 desktop app whose domain logic is Rust and which links both games' crates natively; this spec describes it.

A fifth part is planned, and it is the more important target: **Lieutenant Fizz 2**. A Fizz 2 level belongs to a **world project** (its levels, overworld, shared definitions, sprites, parallax panels, sounds and strings, built into one world pack) and is written in a dialect of the Fizz 1 script (`script fizz2 0`): a map grid, exact positions, objects with ids, **named states that doors, lights and panels bind to and rules change** (with `lock` as sugar for a key and a door), placed lights, raised floating words and sounds, and custom enemies and items with **behaviour scripts** compiled to bytecode. It lowers to `LEVL` version 2. A level's target is **fixed when it is created**; a Fizz 1 level can be converted up to Fizz 2, and a Fizz 2 level exported down with a lossy check. Fizz 2 levels are drawn in the game's oblique look, Fizz 1's art can be used as a retro set, and the studio has a pixel editor for panels and sprites. The design is the owner's (2026-11-04), and much of it needs Fizz 2 work, recorded as change requests F1 to F23. None of it is built; see §6.1, `docs/LANGUAGE.md`, `docs/WORLD.md`, `docs/SCRIPTING.md`, `docs/EDITOR.md` sections 13 to 15 and `docs/FIZZ2-COVERAGE.md`.

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
- The prototype's Paths lens is computed in JavaScript and is approximate on slopes; the real one must come from the game's own code, linked natively in the studio's game host.
- Enemy kinds `beetle`, `bat`, `pod`, `phantom`, `roller`, `sentry`, `boss` and `cage` have only one-line summaries in `docs.ts`.
- The prototype draws one character per cell, so an item that shares a block with an enemy or another item is hidden: 16 items across 7 levels (the starter-levels card shows each level's count).
- Lifts, rooms and the arena cannot yet be dragged by every corner: a lift drags by its two ends, a room by its body, the arena not at all.
- The MCP server has no tools for objects or the overworld; there is no sprite picker.
- Nothing for Fizz 2 is built: the dialect, the target profiles, the Fizz 1 export check, the Game view and the sprite tools are designs in these documents.

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
- **G-GAME-2** Anything that depends on simulation rules (enemy paths, reachability, playtests) comes from the game's own code (linked natively, D59), never from rules re-derived in TypeScript.
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

Lenses draw over the level without changing it. Level: Gaps, Ghosts, Reach, Hazards, Paths (Alt+1 to Alt+5). Overworld: Links, Areas, Ghosts. Ctrl+Shift+L hides them all. The Gaps rule: up to 3 wide "a jump clears it", exactly 4 "tight: a tenth of a second", 5 or more "needs a ledge". The Paths lens shows where walking enemies go; the real one asks the game host (see [ARCHITECTURE §5](docs/ARCHITECTURE.md#5-the-game-host)).

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

### 6.1 Fizz 2: the dialect, world projects and target profiles (planned)

- **A superset in text, not in meaning.** First line `script fizz2 0`, written when the level is created and fixed for life. Every Fizz 1 script still parses, so it can be converted; the games behave differently in places (the exit needs Up in Fizz 2, a door is bound to a state, Fizz 2 has the wall-kick as a core mechanic), and each difference is a row in the capability matrix with its own check.
- **World projects.** A world holds its levels, overworld, shared definitions (enemies, items, states, sounds, strings), sprites, parallax panels and theme, and builds through `fizz-bake` into one world pack ([docs/WORLD.md](docs/WORLD.md)).
- **What a level holds** is `LEVL` version 2 (version 1 dropped): size, name, start, `floor_solid`, a state table, bindings, a tile map, objects (keys, snacks and cans, the chicken, switches, lights, custom enemies and items), rules and strings.
- **States and rules.** `state NAME START [values=...]`; `door ... state=NAME open=VALUE` and `state=` on lights and panels; `when INPUT [if CONDITION [and CONDITION]] [after=T] then ACTION[, ACTION] [repeat]` with inputs from keys, switches, areas, pick-ups, enemies and groups cleared, timers and state changes; `lock red-door key=red at=X,Y` as sugar. Rules and objects raise floating words and sounds from the world's library.
- **Behaviour scripting.** Custom enemies and items are defined in the world (sprite, hitbox, stats, modes and handlers, reactions, item effects), compiled to bytecode with a static worst-case step count, and run by the game's interpreter under a per-tick budget ([docs/SCRIPTING.md](docs/SCRIPTING.md)).
- **The look.** The oblique ground is the Fizz 2 look and the canvas of a Fizz 2 level is the game's own drawing (the flat grid stays as an aid and as the Fizz 1 view); placed lights and bitmap parallax panels are authored; Fizz 1's sprites are a retro art set, art only.
- **Syntax.** The Fizz 2 repository has not written the grammar; this is the studio's proposal, and `fizz-script` wins where it differs. Errors reuse E001 to E016 and add E101 to E130 and E201 to E208; lints are W101 to W113 and W201 to W205.
- **Target profiles.** A profile (`fizz1`, `ep2`, later `ep3`) holds the dialect versions it accepts, the content tables, limits, budgets, physics parameters and a capability state per feature: built, accepted, reserved or absent. Later episodes are new profiles on a versioned dialect.
- **Fizz 1 export and conversion.** Export is a lowering plus the lossy check (E120 to E123, W103, W104, W110); Convert to Fizz 2 writes a new level with a conversion report.
- **What is not decided** is listed in [docs/DECISIONS.md](docs/DECISIONS.md) and in §11 below.

## 7. Architecture

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the detail. The layers, and which owns what:

| Layer | Owns | Today |
| --- | --- | --- |
| The game (Rust, `episodes/episode-1/game`, `crates/sim`) | The simulation, the `Builder`, the level and overworld tables, fingerprints, the playtest bot | In the game repository; copied into `scratch/rust/` for the proofs |
| Language package (`packages/language`) | Text ↔ AST, the edits rule, Rust export, the overworld model and rasteriser, the language docs | Built |
| Level rasteriser (`packages/mcp/src/world.ts`) | A picture of a level script, for drawing and structural checks | Built; agrees with the game on all 16 levels |
| MCP server (`packages/mcp`) | Claude's tools, proposals, modes, history, notes | Built for one level file |
| Studio app (`apps/studio`, Tauri v2) | The windows, the canvas and panels, the chrome; it renders and sends intents | Prototype only; planned in `docs/DESKTOP.md` |
| Studio crates (`crates/fizz-studio-*`) | The session (state, revisions, history), the Fizz 1 dialect port, the Fizz 2 dialect on `fizz-script`, profiles, states, art, budgets, export, the baker adapter, the MCP server | Not built |
| Game host (`fizz-studio-host`) | Both games linked natively: level data, building from a script, the Game view's frames, rule previews, the behaviour debugger, enemy paths, the playtest bot, streamed over Channels | Not built |

The boundary rule: **the games' Rust owns the simulation, the studio's Rust owns the domain, and the webview only renders.** The rasteriser mirrors level construction (the `Builder`), which is proven equal to the game on every level; anything that needs simulation rules (how an enemy walks, whether a jump lands, whether a level can be finished) is asked of the game's own code in the game host, never re-derived. Today's TypeScript packages are the reference for the Rust port (D56).

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
| R-OW-12 | Level sprites on points, with a sprite picker | Not built | ENGINE-CHANGES E10; `ROADMAP.md` M9 |
| R-OW-13 | Canonical printing of overworld nodes built in memory | Not built | `printOverworld` prints raw lines only |

### Editor

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

### Game host and Rust content

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

### Fizz 2 target (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-F2-01 | `script fizz2 0` is a superset of the Fizz 1 script in text: every Fizz 1 script parses and prints unchanged | Not built | `docs/LANGUAGE.md` |
| R-F2-02 | `map` grid with the profile's legend, `at=` versus `x=`/`y=` with the printer rule, the `objects` section (`key-red`, `key-blue`, `cheezie`, `choc`, `cookie`, `soda`, `chicken`), required `id=`, objects stably sorted by kind | Not built | `docs/LANGUAGE.md`; Fizz 2 #137 |
| R-F2-03 | `state`, bindings, `when ... then ...`, `lock` as sugar and `allow`, with the limits (32 rules, 32 states of up to 8 values) | Not built | `docs/LANGUAGE.md` "States and rules"; owner decision D42; F11 |
| R-F2-04 | Errors E1xx and lints W1xx, with W101 | Not built | `docs/LANGUAGE.md` |
| R-F2-05 | A level's target is fixed at creation and selects its tools, sprites, rules, views and checks; Export to Fizz 1 runs the lossy check (E120 to E123, W103, W104, W110) first | Not built | `docs/EDITOR.md` section 13; D46 |
| R-F2-06 | Snap to floor writing `at=`, Close all doors, the Rules window, rule lints inline | Not built | `docs/EDITOR.md` section 13 |
| R-F2-07 | A dump view equal to the baker's disassembly | Not built | `docs/EDITOR.md` section 13 |
| R-F2-08 | The editor and `fizz-script` agree through a shared conformance corpus | Not built | `docs/TESTING.md` section 7 |
| R-F2-09 | Header words: `start`, `floor solid\|open`, `theme`; Fizz 1 `channel` lines read as two-valued states; `ground=` ignored with W112 | Not built | `docs/LANGUAGE.md` "The header"; Fizz 2 `docs/FAP.md` |
| R-F2-10 | Ids resolve to object indices; renaming an id rewrites every rule that names it; one key per colour (E107); objects cannot be reordered by hand | Not built | `docs/LANGUAGE.md` "Objects"; Fizz 2 #137, #138 |
| R-F2-11 | `lock DOOR key=COLOUR at=X,Y` expands exactly to a state, a door binding and a rule; E110 for a bad cell | Not built | `docs/LANGUAGE.md` "States and rules"; D42 |
| R-F2-12 | Every rule input, condition and action has a source form, with two conditions and two actions per rule; E113 to E118, E124 to E126, W113 | Not built | `docs/LANGUAGE.md` "States and rules"; F10, F11 |
| R-F2-13 | Effects and shared captions by name from the profile; `string` lines (32, 1 to 30 bytes, seven styles); E112, E116, W107 | Not built | `docs/LANGUAGE.md` "Rules"; Fizz 2 `cues.rs` on #140 |
| R-F2-14 | Divergence lints from the profile's physics parameters: W102 (exit needs a place to stand and press Up), W103 (a Fizz 1 level that needs a wall-kick), W105 (head room for a body size) | Not built | `docs/LANGUAGE.md`; Fizz 2 #145, `7b948ae`; D47 |
| R-F2-15 | Capability states: W106 for a feature the game cannot run yet, W109 for the reserved `theme` (until F3) and `music` | Not built | `docs/LANGUAGE.md` "Targets and capabilities"; Fizz 2 #140, #144 |
| R-F2-16 | The Fizz 1 export follows the mapping table: standard locks and rule-free two-valued states lower, every other state and rule is E120 or E121, Fizz 2-only objects E123 | Not built | `docs/LANGUAGE.md` "Lowering to Fizz 1" |
| R-F2-17 | Convert to Fizz 2 writes a new level into a world from a Fizz 1 level through the proven rasteriser, with a conversion report | Not built | `docs/LANGUAGE.md` "Converting a Fizz 1 level to Fizz 2"; D46 |
| R-F2-18 | Map painting rewrites map rows in place; the Objects window with ids and indices | Not built | `docs/EDITOR.md` section 13 |
| R-F2-19 | States, Exit and Head room lenses | Not built | `docs/EDITOR.md` section 13 |
| R-F2-20 | The canvas of a Fizz 2 level is the Game view drawn natively by the game's presenter in the game host (oblique ground, panels, Sky, Night, lights), with the flat grid as an aid and as the fallback until the game exports it | Not built | `docs/EDITOR.md` "Views"; Fizz 2 #142 to #146; D45; F5, F13 |
| R-F2-21 | A Budget window whose meters name their source and say "estimate" or "not run" when the baker is not available | Not built | `docs/EDITOR.md` "Budgets" |
| R-F2-22 | The slice level written as a script bakes, through `fizz-bake`, to the digest of the `const` slice (`fizz_ep2::level::digest`) | Not built | `docs/TESTING.md` section 7; Fizz 2 `docs/FAP.md` "Proof" |
| R-F2-23 | MCP tools for targets, worlds, objects with ids, states, rules, strings, sounds, lights, definitions, budgets, sprites and the Game view | Not built | `docs/MCP.md` section 2 |
| R-F2-24 | Placed lights: the Light tool, radius, colour or bank, falloff, flicker, a state, attachment, and the light meters | Not built | `docs/EDITOR.md` section 13; D44; F12, F22 |

### World projects (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-WLD-01 | A world project: `world.fizz`, its levels, definitions, sprites, panels, sounds and strings | Not built | `docs/WORLD.md` sections 1 and 2; D48 |
| R-WLD-02 | New level and New world fix the target; no setting changes it | Not built | `docs/WORLD.md` section 3; D46 |
| R-WLD-03 | Build world and Check world through `fizz-bake`, with its report in the Budget window | Not built | `docs/WORLD.md` section 4; F4, F15 |
| R-WLD-04 | Shared definitions used by name; a clash is E130; removing a used definition is refused | Not built | `docs/WORLD.md` section 6 |
| R-WLD-05 | Import Fizz 1 art as a read-only retro set packed in the world pack; retro levels are art only | Not built | `docs/WORLD.md` section 5; D49; F20 |
| R-WLD-06 | Convert to Fizz 2 opens a conversion report with four lists linked to the canvas | Not built | `docs/EDITOR.md` section 13 |

### States and rules (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-ST-01 | `state` with a value set and a start value; a death resets every state | Not built | `docs/LANGUAGE.md` "States and rules"; D33, D42 |
| R-ST-02 | Bindings: `door` rectangles, and `state=` with `on=` on lights and panels | Not built | As above; F11 |
| R-ST-03 | Rule inputs, conditions and actions as listed, with the limits | Not built | As above; F10, F11 |
| R-ST-04 | `lock` expands exactly; the dump view shows the expansion | Not built | As above |
| R-ST-05 | Raised events: `word` and `cue` from rules and objects, checked against the strings, captions and the world's sound library | Not built | `docs/LANGUAGE.md`; D50; F18 |
| R-ST-06 | The States window, the Rules window with Words and Sounds tabs, the States lens | Not built | `docs/EDITOR.md` section 13 |
| R-ST-07 | Rule previews run in the game host | Not built | F6 |
| R-ST-08 | The studio's state, binding and rule records equal `fizz-bake dump` for the corpus | Not built | `docs/TESTING.md` section 7 |

### Behaviour scripting (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-BHV-01 | The definition language for enemies and items: sprites per state, hitbox, stats, registers, modes, handlers, reactions, item effects | Not built | `docs/SCRIPTING.md` section 2; D51 |
| R-BHV-02 | Compilation to bytecode with a static worst-case count per handler; E201 to E208, W201 to W205 | Not built | `docs/SCRIPTING.md` sections 3 and 6.3; F17 |
| R-BHV-03 | The Definitions window and behaviour editor with the mode graph and live counts | Not built | `docs/SCRIPTING.md` section 6.1 |
| R-BHV-04 | Preview, debugger and replay in the game host | Not built | `docs/SCRIPTING.md` section 6.2; F6, F21 |
| R-BHV-05 | Behaviour cost meters: worst-case instructions against the budgets, section sizes, an estimated DOS cost | Not built | `docs/SCRIPTING.md` section 4; F22 |
| R-BHV-06 | A compiler conformance corpus and determinism fixtures equal on native, Web and DOS | Not built | `docs/SCRIPTING.md` section 8 |
| R-BHV-07 | A Fizz 1 level refuses custom definitions (E208); exporting one is E123 | Not built | `docs/SCRIPTING.md` section 7 |
| R-BHV-08 | MCP tools for definitions and behaviour runs | Not built | `docs/SCRIPTING.md` section 6.4 |

### Art (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-ART-01 | A pixel editor with the EGA constraints enforced | Not built | `docs/EDITOR.md` section 15; D52 |
| R-ART-02 | PNG import quantised to the 16 EGA colours, with a preview and repeatable settings | Not built | As above |
| R-ART-03 | Parallax panels: scroll factors, repeat, vertical position, open-air rule, state; shown in the Game view | Not built | As above; F19 |
| R-ART-04 | Drawn sprite sets painted and written canonically | Not built | As above; Fizz 2 `docs/SPRITES.md` |
| R-ART-05 | Tile textures, once the game reads them as data | Not built | F14 |

### Target profiles (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-TGT-01 | A target profile is data: dialect versions, content tables, limits, budgets, physics parameters and a capability state per feature | Not built | `docs/LANGUAGE.md` "Targets and capabilities" |
| R-TGT-02 | Profiles are generated from the game's published tables, and a test fails when a profile drifts from its game | Not built | ENGINE-CHANGES E11 (Fizz 1), F2 (Fizz 2) |
| R-TGT-03 | Every word, field and list the editor offers comes from the profile | Not built | `docs/EDITOR.md` section 13 |
| R-TGT-04 | Each capability state shows in the UI, with a Capabilities card that cites each row's source | Not built | `docs/EDITOR.md` section 13 |
| R-TGT-05 | A world names its profile at creation (`target=` in `world.fizz`) and a level's `script` line fixes its dialect; an unknown dialect version is E101 | Not built | `docs/LANGUAGE.md` "Later episodes"; D46 |
| R-TGT-06 | A new profile (Episode 3) is added as data with no change to the editor's code | Not built | `docs/TESTING.md` section 7 (a synthetic profile) |

### Sprites (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-SPR-01 | The canvas draws each object with its kind's sprite from the target's sets, by anchor and facing, and a labelled placeholder when a target has none | Not built | `docs/EDITOR.md` section 14 |
| R-SPR-02 | A Sprites window: every set and frame with size, anchor, source and provisional note; Ben's pose sets; availability per target | Not built | `docs/EDITOR.md` section 14; Fizz 2 `docs/SPRITES.md`, `7b948ae` |
| R-SPR-03 | Animation preview from the game's frame sequence, or a fixed cadence labelled as the preview's own | Not built | `docs/EDITOR.md` section 14 |
| R-SPR-04 | Fizz 2 sprite files read and written canonically: opening and saving without a change leaves the bytes unchanged | Not built | Fizz 2 `docs/SPRITES.md`, `tools/sprites/lib.ts` |
| R-SPR-05 | Sprite editing for `drawn` sets only, through the pixel editor | Not built | `docs/EDITOR.md` sections 14 and 15 |
| R-SPR-06 | A sprite preview at the night ambient through the game's palette banks | Not built | Fizz 2 #146 |

### Desktop app (planned)

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| R-APP-01 | A Tauri v2 desktop app in the Liminal HQ layout: `apps/studio` with a thin `src-tauri`, pure `crates/*` with no `tauri` dependency, `plugins/*` with `guest-js`, Bun and Cargo workspaces, a pinned toolchain | Not built | `docs/DESKTOP.md` sections 2 to 4; `folio/AGENTS.md` |
| R-APP-02 | `packages/chrome` from Waypoint with the studio's own tokens, `packages/protocol` generated with `ts-rs` and a drift check | Not built | `docs/DESKTOP.md` section 3 |
| R-APP-03 | `bun run validate` as the single gate, CI in the Liminal HQ containers, Dependabot grouping | Not built | `docs/DESKTOP.md` section 11 |
| R-APP-04 | Licence headers on every source file and `THIRD_PARTY_NOTICES.md` with licences checked by `cargo deny` | Not built | `docs/DESKTOP.md` section 8 |
| R-APP-05 | Windows created in Rust with the proposed labels and capabilities per concern; pop-outs through tear-off | Not built | `docs/DESKTOP.md` section 6 |
| R-APP-06 | Settings, layouts and recent worlds in a Rust-owned settings document; no browser storage, checked by the gate | Not built | `docs/DESKTOP.md` section 7 |
| R-APP-07 | Every user-visible string from the message catalogue; error and lint messages as catalogue keys | Not built | `docs/DESKTOP.md` section 8 |
| R-APP-08 | Logging through `tauri-plugin-log`, never logging script text or Claude's messages | Not built | `docs/DESKTOP.md` section 8 |
| R-APP-09 | Rust owns each world: intents in, patches out, one writer, a monotonic revision, named undo and redo in Rust, stale answers refused | Not built | `docs/DESKTOP.md` section 5; D55 |
| R-APP-10 | Native files: atomic canonical writes, file watching for hand and Claude edits, autosave and crash recovery, single instance | Not built | `docs/DESKTOP.md` section 9 |
| R-APP-11 | The game host links both games natively and streams frames and traces over `Channel`s | Not built | `docs/DESKTOP.md` section 4; D59 |
| R-APP-12 | Claude's MCP server as a stdio sidecar with live and headless modes, propose by default, accept and reject in the app | Not built | `docs/MCP.md`; D57 |
| R-APP-13 | Packages for Linux (deb, rpm, AppImage) and Windows 11 (msi, nsis), x64 and arm64, with opt-in signed updates | Not built | `docs/DESKTOP.md` section 10 |
| R-APP-14 | Keyboard-operable throughout, with the canvas's objects as a focusable list | Not built | `docs/DESKTOP.md` section 12 |
| R-APP-15 | The running app tested through `tauri-mcp-server` and the debug-only MCP bridge | Not built | `docs/DESKTOP.md` section 13; D60 |
| R-APP-16 | The Fizz 1 dialect ported to Rust, matching every TypeScript fixture and every Episode 1 proof | Not built | D56 |

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
| Q10 | Does the editor keep a TypeScript parser for the Fizz 2 dialect or load `fizz-script` as WebAssembly? | Proposed answer: neither; the desktop app links `fizz-script` natively (D55). Before that: not decided; a shared conformance corpus is needed either way (`docs/ARCHITECTURE.md` section 7). |
| Q11 | Which legend letter means which tile? | The slice fixes `. w # B = ^ D b E` (Fizz 2 `level.rs`); `CHOC` and the six slopes have ids but no letter or drawing (hills are specified in `docs/OBLIQUE.md`, #142, not built). The studio proposes `~ / \ r R l L`; the Fizz 2 repository decides. |
| Q12 | The Fizz 2 planner's twelve open questions | Five are now answered by the Fizz 2 repository (the death reset, the limits, captions and strings, `LEVL` amended in place, the lock semantics); the rest are open. `docs/DECISIONS.md`, the 2026-11-04 entry. |
| Q13 | How is a shaft that only a wall-kick could climb refused? | Resolved for Fizz 2: the wall-kick is core there (D47). For Fizz 1 levels see Q26. |
| Q14 | Does `fizz-script` adopt the studio's proposed syntax (`objects`, `lock ... at=`, `after=`, `string`, `cue`) and its E101 to E123 and W102 to W112 numbering? | Proposed in D40; the Fizz 2 repository has written no grammar or codes. |
| Q15 | How does a target profile reach the studio: generated from a content export in the game (the `pack_content()` tables as JSON) or copied by hand? | A generated export is recommended (ENGINE-CHANGES F2); hand copies drift, as `tables.ts` shows. |
| Q16 | Is the wall-kick out of Fizz 2, or first in the mechanics roster? | Resolved: it is a core Fizz 2 mechanic, always on (D47). Fizz 2's `docs/FIZZ1-DIFFERENCES.md` still says it is left out; changing that page and building it is change request F9. |
| Q17 | What is the theme format? | Lights are now placed objects (D44) and panels world art (D52); what remains is the theme itself (back wall, panel stack, horizon, night ambient) as world data with a level override (F3), and whether music is per level. |
| Q18 | In what order do rules, state-change inputs and behaviours run in a tick, and is there a conditional hash step? | Only locks run today (#140); F11 and F17 fix the order. Options: rules after all movement with state changes seen the same tick (proposed), or the next tick. |
| Q19 | Which Ben ships, and at what body size? | The pose workshop trial is 0.8 by 2.0 tiles (`7b948ae`, not for merge), which moves the hash and changes head room; Fizz 2's `docs/ARCHITECTURE.md` lists it as open. |
| Q20 | Can a level choose a sprite variant per object, and how is the enemy roster's set of states named? | Not designed in Fizz 2; the roster is planned with idle, walk, alert, stunned and dead. |
| Q21 | Should a Fizz 1 export ever lower a rule beyond the standard locks? | See Q25. |
| Q23 | How many values may a state have, and what are `LEVL` 2's record sizes and limits? | Proposed: up to 8 values, 32 states, fixed-size records; F10 decides. |
| Q24 | How many conditions and actions does a rule hold? | Proposed: two and two, to keep records fixed-size; options are more slots (larger records) or chaining rules through a state. |
| Q25 | Which Fizz 1 props (`switch`, `press`, `target`, `crystal-switch`) and channels can carry a simple Fizz 2 switch rule in a Fizz 1 export, and which Up-press `use` inputs does Fizz 2 allow besides the exit? | Recommended: only an exact match lowers; everything else is E121. The `use` input depends on F11 and #145's open question of Up for doors. |
| Q26 | What does "the wall-kick is disabled for Fizz 1 target levels" mean, given Fizz 1 the game has a wall-kick (`WALL_KICK_UP` in its `world.rs`) and Whisper Hollow is built around it? | Recorded as decided (D47) with W103 on Fizz 1 levels. Options: new Fizz 1 levels must not rely on it (the existing Episode 1 levels are exempt), or every Fizz 1 level is checked. The owner should confirm. |
| Q27 | Can a state be world-scoped (shared by every level of a world), and how does it persist and reset? | `docs/WORLD.md` section 7. Options: level-only states (simplest; a death reset stays exact), or world states saved with progress. |
| Q28 | How is a light's colour drawn on DOS, where the palette banks dim a colour and cannot tint it (#146)? | Options: `bank=` only on DOS with `colour=` on the Web, or a small set of tinted banks; F12 decides. |
| Q29 | Is the world's sound library its own section in the world pack, or more `FXPK` entries, and how does it relate to `SHARED.FAP`'s effects and the per-device audio compatibility numbers? | F18 decides; `docs/FAP.md` keeps effects in `SHARED.FAP` today. |
| Q30 | An in-editor sound designer | Not in scope (D50); a future item that would overlap the Undertone and OPX work. |
| Q31 | Fizz 1 mechanics inside Fizz 2 (Fizz 1's lifts, ladders, roster or physics in a Fizz 2 level) | A recorded non-goal (D49); custom behaviours are the planned route to Fizz 1-like enemies. |
| Q32 | What are the behaviour step budgets per entity and per level, and the register count? | Proposed: set by the profile from the 486 floor; eight registers. F17 decides. |
| Q33 | May a behaviour spawn entities (shots, children)? | Not in the first version; options are a fixed pool per definition or none. |
| Q34 | Will tile textures become data a world can supply, so the pixel editor can paint them? | F14; today they are generated code tables (#143). |
| Q35 | Which quantiser and dither does PNG import use, and does Fizz 2 want the result stored as a grid or as the source image plus settings? | Proposed: both, the grid baked and the source kept for re-import. |
| Q36 | The app's identifier, product name and file type: `ca.liminalhq.fizzstudio` and "Fizz Level Studio" are proposed; does `.fizz` get a registered MIME type? | `docs/DESKTOP.md` sections 1 and 9 |
| Q37 | When are `SPEC.md` and `docs/` split into the standard's `spec/` and `docs/`? | Proposed: in M1 |
| Q38 | Which locales ship first? | Proposed: en-CA, with fr-CA and pseudo-locales as Waypoint has (`waypoint/SPEC.md` §9) |
| Q39 | What happens when a file changes on disk while the session has unsaved changes to it? | Options: merge when the changed lines do not overlap and ask otherwise (proposed), or always ask |
| Q40 | **Settled:** the studio's home is GitHub, with GitHub Actions on the Liminal HQ containers and shared workflows, and Forgejo holds a mirror. | `docs/DESKTOP.md` section 11 |
| Q41 | Can two episodes' crates link into one app (Episode 2 and Episode 3 depending on different revisions of `fizz-sim`)? | Cargo refuses two copies of one package from the same source at the same version; options are one revision for all episodes, a host process per episode, or renamed packages per episode (D58) |
| Q42 | Which Fizz 1 APIs (E6 to E9) can the Fizz 1 repository accept behind a feature, and does `lf-episode-1` stay one crate for its web build and for linking? | `lf-episode-1` is a `cdylib` and `rlib` with raw C-ABI exports today |
| Q43 | What frame format, rate and size does the Game view stream, and is it fast enough on Linux and Windows webviews? | Proposed: indexed frames with a palette on change; measured in M1 |
| Q22 | Will Fizz 2 or Episode 3 have an overworld, and with what points and unlocks? | Fizz 2 has none; the Fizz 1 overworld model is not assumed to carry over. |

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
| The playtest bot is slow | The studio stalls | Run it natively on a worker thread with a tick budget per step and progress over a `Channel` (E9) |
| Cross-repository crate coupling | A change in a game crate breaks the studio, or two episodes' crates cannot link together | Pinned git revisions bumped in reviewed changes (D58); a host process per episode if they cannot share a build (Q41); F23 marks the APIs the studio calls |
| A large TypeScript-to-Rust port | The port stalls, or drifts from the proven TypeScript | The TypeScript package stays the reference until every fixture and proof matches (D56); the port is bounded (about 1,845 lines) and has its corpus from day one |
| The Liminal HQ standards' plugins are copies | The studio's copies of tear-off and window effects drift from Waypoint's | `PROVENANCE.md` per copy, and a move to the published plugins when they are published |
| Streaming frames over IPC is too slow for a smooth Game view | A laggy canvas | Indexed frames with a palette (a 320 by 200 frame is 64,000 bytes), sent only on change; measured in M1 (Q43) |
| The design prototype is mistaken for the product | Canned behaviour is relied on | The prototype labels canned parts; this spec marks every requirement's status |
| Two parsers drift (TypeScript here, Rust in `fizz-script`) | The editor accepts a script the baker rejects, or the reverse | A shared conformance corpus in both repositories' tests (G-F2-1) |
| The studio's dialect proposal is written before the Fizz 2 grammar | The editor is built against syntax `fizz-script` does not adopt | Build M2 and M3 behind the corpus, start the corpus in the Fizz 2 repository, and treat every syntax line in `LANGUAGE.md` as provisional until `fizz-script` exists (D40) |
| Fizz 2 changes fast and its level pull requests are unmerged | The documents describe records or rules that change before merging | Each fact names its pull request and is marked provisional; recheck `docs/FIZZ2-COVERAGE.md` before starting M2 |
| The games keep diverging | A Fizz 1 export silently plays differently | Every divergence is a capability-matrix row with a check (W110 and the rest); a divergence found without a row is a bug in the profile |
| Ben's body size changes | Levels tuned for one body block the other | The body is a profile parameter and the Head room lens compares two sizes (W105) |
| A preview imitates the game's look | The person trusts a picture the game does not draw | The Game view is the game's presenter or the labelled flat fallback (D37) |
| Behaviour scripts are not deterministic or too slow on a 486 | Worlds play differently on DOS, or stutter | The numeric model only, static worst-case counts, budgets from the profile, parity fixtures (`docs/SCRIPTING.md` section 9) |
| Bytecode versions drift, or bad bytecode is loaded | Old packs run with new meanings; a pack crashes the game | A bytecode version in the compatibility number; a load-time verifier |
| Much of the design waits on Fizz 2 change requests | The studio's Fizz 2 milestones stall | Each milestone names its change requests; capability states let the editor ship a feature as "accepted" before the game runs it |
| The studio's state and rule design outgrows `LEVL` 2's fixed records | Rules that cannot be baked | Limits in the profile (Q23, Q24); the corpus checks the baker's records |

## 13. Milestones

[docs/ROADMAP.md](docs/ROADMAP.md) has exit criteria and dependencies.

| Milestone | Delivers |
| --- | --- |
| M0 Spec | This document and `docs/` |
| M1 Desktop walking skeleton | The Tauri v2 app to the Liminal HQ standards (layout, gate, CI, chrome, windows, settings, i18n, the Rust session, native files), the editor shell, the game crates linked, opening a Fizz 1 level and a Fizz 2 world |
| M2 World projects and Fizz 2 levels | World projects and Build world, target profiles, the Fizz 2 dialect without states, map painting, objects, the Sprites window, the Fizz 1 export check, the dump view and the first MCP tools |
| M3 States and rules | States, bindings, rules, `lock` sugar, raised words and sounds, the States and Rules windows and the States lens |
| M4 Claude in the studio | The MCP server attached to the live studio, Fizz 2 first: selection, ghosts, accept and reject buttons, object, state and rule tools |
| M5 Lights, panels and the Game view | The game's oblique look as the Fizz 2 canvas, placed lights, bitmap parallax panels, the theme, the cost meters |
| M6 Pixel editor | Painting and importing panels and drawn sprites in the 16 EGA colours |
| M7 Behaviour scripting | Custom enemies and items, the behaviour editor, the debugger and the behaviour budgets |
| M8 Retro art and Fizz 1 conversion | The retro art set in a world pack, and Convert to Fizz 2 with its report |
| M9 Fizz 1 overworld designer | Points, unlock rules, teleporters, the Links and Areas lenses, level sprites, `OverworldBuilder` in the game |
| M10 Fizz 1 level editing | The Fizz 1 level tools, objects and lenses on the shell |
| M11 Fizz 1 registry and progress | A level and overworld registry, the wider mask, export that registers a level |
| M12 Fizz 1 native host and Rust levels | Level data from the game, a level built from a script inside the sim, enemy paths and the playtest bot, all linked natively; editing on top of Rust-written levels |
| M13 Episode 3 profile | A third profile on the Fizz 2 dialect family, from Episode 3's own tables, with no change to the editor's code |
