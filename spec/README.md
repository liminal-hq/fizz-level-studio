# Fizz Level Studio — product specification

Fizz Level Studio is the level and overworld editor for Lieutenant Fizz (`liminal-hq/lieutenant-fizz`) and Lieutenant Fizz 2. A person and Claude (over MCP) design levels together in it. Its end goal is a **desktop app built with Tauri v2 to the Liminal HQ Tauri standards**, like Folio, Waypoint, Jar and Cadence: Linux first, Windows 11 a real target, no mobile and no browser build ([spec/DESKTOP.md](DESKTOP.md)). Every level and every overworld is a short text script in the Fizz builder language; the studio paints on that script, Claude proposes changes to it, and an exporter turns it into the Rust `Builder` calls the game compiles.

This document is the main spec. The companion documents go deeper:

| Document | What it covers |
| --- | --- |
| [spec/GOALS.md](GOALS.md) | The goals, ranked, each with a measure of success |
| [spec/ARCHITECTURE.md](ARCHITECTURE.md) | Packages, data flow, what the game owns, the game host, the file layout |
| [spec/DESKTOP.md](DESKTOP.md) | The Tauri v2 desktop app to the Liminal HQ standards: platforms, stack, layout, crates and plugins, state, windows, settings, files, packaging, CI |
| [spec/EDITOR.md](EDITOR.md) | The editor's behaviour, screen by screen |
| [spec/MCP.md](MCP.md) | The MCP server as built, and the tools still to add |
| [spec/OVERWORLD.md](OVERWORLD.md) | The overworld model, its script, its exporter and the steps to add a level |
| [docs/ENGINE-CHANGES.md](../docs/ENGINE-CHANGES.md) | What the game itself must change |
| [docs/TESTING.md](../docs/TESTING.md) | What is tested today, what each test proves, and the gaps |
| [docs/ROADMAP.md](../docs/ROADMAP.md) | Milestones, exit criteria and dependencies |
| [docs/DECISIONS.md](../docs/DECISIONS.md) | The decisions taken, with reasons and the alternatives set aside |
| [spec/LANGUAGE.md](LANGUAGE.md) | The language reference: grammar, Builder equivalents, errors, the Fizz 2 dialect and the target profiles |
| [docs/FIZZ2-COVERAGE.md](../docs/FIZZ2-COVERAGE.md) | Every Fizz 2 feature an author controls, against the document that handles it |
| [spec/WORLD.md](WORLD.md) | World projects: a world's levels, definitions, sprites, panels, sounds and strings, built into one world pack; the retro art set |
| [spec/SCRIPTING.md](SCRIPTING.md) | Custom enemies and items with behaviour scripts compiled to bytecode, the step budget, the behaviour editor and debugger |

## 1. Summary

The studio has four parts, three of which exist today in this folder:

1. **The builder language** (`packages/language`) — a parser, printer, edits helper, Rust exporter, overworld module and language docs. Built and tested: 76 `bun test` cases, and a Rust proof that the scripts for all 16 Episode 1 levels and the overworld rebuild the game's data exactly.
2. **The MCP server** (`packages/mcp`) — nine tools that let Claude read a level, render it as text, check it and write `paint`, `clear` and `place` lines to it, in a propose mode (the default) or a direct mode that only the person can turn on. Built and tested: 21 `bun test` cases including a real stdio round trip.
3. **The design prototype** (`design/project/Proto.dc.html`) — an interactive design of the editor: the Ultimate layout, tools, objects, the overworld designer, lenses, the script panel with completion, and the starter levels. It is a design, not the product: Claude's ideas are canned, nothing is saved and the playtest bot is a stand-in.
4. **The studio application** — not built. It is planned as a Tauri v2 desktop app whose domain logic is Rust and which links both games' crates natively; this spec describes it.

A fifth part is planned, and it is the more important target: **Lieutenant Fizz 2**. A Fizz 2 level belongs to a **world project** (its levels, overworld, shared definitions, sprites, parallax panels, sounds and strings, built into one world pack) and is written in a dialect of the Fizz 1 script (`script fizz2 0`): a map grid, exact positions, objects with ids, **named states that doors, lights and panels bind to and rules change** (with `lock` as sugar for a key and a door), placed lights, raised floating words and sounds, and custom enemies and items with **behaviour scripts** compiled to bytecode. It lowers to `LEVL` version 2. A level's target is **fixed when it is created**; a Fizz 1 level can be converted up to Fizz 2, and a Fizz 2 level exported down with a lossy check. Fizz 2 levels are drawn in the game's oblique look, Fizz 1's art can be used as a retro set, and the studio has a pixel editor for panels and sprites. The design is the owner's (2026-11-04), and much of it needs Fizz 2 work, recorded as change requests F1 to F23. None of it is built; see §6.1, `spec/LANGUAGE.md`, `spec/WORLD.md`, `spec/SCRIPTING.md`, `spec/EDITOR.md` sections 13 to 15 and `docs/FIZZ2-COVERAGE.md`.

What has been proven, exactly:

- All 16 levels of Episode 1, rebuilt from their scripts through the exporter, equal the game's levels exactly, including each level's fingerprint (`scripts/prove-all.sh`). The studio's rasteriser agrees with the game on every tile, item, enemy and start of all 16.
- The overworld script rebuilds `build_overworld()` exactly: 2,640 tiles including 200 trees and 32 rocks, 27 points, five areas and the start.
- The language gained platform `size=` and `dwell=` and `channel LIST on|off` because real levels use them (Zarg Lookout and Frosting Spire have sized lifts with rest times; Mirror Shafts starts channels 1, 2 and 3 on), and the edits block gained enemies, `hover`, `channel`, `room` and `secret-room`.

Gaps found by auditing the game:

- `MapPoint::req` is a `u16` and `SECRET_FOUND` is bit 15, so bits 0..15 are all used (15 levels plus the secret-found flag). Adding a level needs the requirement mask widened (see [ENGINE-CHANGES E4](../docs/ENGINE-CHANGES.md#e4-widen-the-progress-and-requirement-masks)).
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

Each goal is specific and testable. [spec/GOALS.md](GOALS.md) ranks them and gives each a measure.

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
6. **Add a new level.** Write a new script, register it (id, `LEVELS` row, overworld point), widen the mask if needed, export, and play it. This needs the engine changes in [docs/ENGINE-CHANGES.md](../docs/ENGINE-CHANGES.md).
7. **Open a Rust-written level.** A level written as procedural Rust opens in the studio from the game's data, read only for its procedural parts, with edits layered on top.
8. **Check a level is finishable.** Run the playtest bot from the studio (or Claude runs it over MCP) and see whether the exit was reached, through the game's own simulation.

## 5. The product

[spec/EDITOR.md](EDITOR.md) describes every screen. This section is the shape.

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

The next big feature. An overworld is a script (`overworld "Name" WxH id=...`), there can be more than one, and it compiles to Rust through an `OverworldBuilder`. The designer paints the map like a level and places points: level points (with **unlock rules**: the levels to clear first, or the secret), **teleporters** paired by name, signs and the saucer. The Links lens draws unlock lines and teleporter pairs; the Areas lens outlines the regions that decide the scatter. Later: **level sprites** on points, chosen from the game's sprite names. [spec/OVERWORLD.md](OVERWORLD.md) has the model.

### 5.5 Lenses

Lenses draw over the level without changing it. Level: Gaps, Ghosts, Reach, Hazards, Paths (Alt+1 to Alt+5). Overworld: Links, Areas, Ghosts. Ctrl+Shift+L hides them all. The Gaps rule: up to 3 wide "a jump clears it", exactly 4 "tight: a tenth of a second", 5 or more "needs a ledge". The Paths lens shows where walking enemies go; the real one asks the game host (see [ARCHITECTURE §5](ARCHITECTURE.md#5-the-game-host)).

### 5.6 Script panel and completion

The script is always in sync with the canvas. Claude's lines carry a purple `+`; pending lines are tinted. Clicking a line selects its thing; selecting a thing highlights its line and the script follows unless Following is off. A box under the script takes a typed line, applies it as one undo step, and explains a line it cannot read with a suggested fix and a "Use this fix" button. Completion offers statement words, then tile or item words after `paint` and `place`, then field names, then values for `req=` and `with=`, from `docs.ts`.

### 5.7 Starter levels

File, Open starter level lists 18 entries: the 16 Episode 1 levels rebuilt from the game's own data, the overworld, and a small sample draft. Crater Fields opens first. Each card shows the size, the counts of treats, enemies, lifts and rooms, the boss arena, and how many items the one-character grid hides.

### 5.8 Claude and MCP

Claude reaches the studio through an MCP server. Today's server ([spec/MCP.md](MCP.md)) works on one `.fizz` level file and a sidecar `<level>.studio.json`; the real studio adds the selection, objects, overworlds, paths, playtests and the language docs. **Propose** is the default: Claude's edit is a pending proposal shown as ghosts. **Direct** is a switch only the person can turn on; each direct edit is one undo step. **Accept and reject are never MCP tools**; today they exist only in the CLI that stands in for the studio's buttons.

## 6. The language

The language is specified in [spec/LANGUAGE.md](LANGUAGE.md). The essentials:

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

An overworld script has `overworld`, `start`, `area` lines, a `blocks` section (tile fills, `path from=.. to=..` routes and `scatter`), a `points` section (`level`, `tele`, `saucer`, `sign`) and an optional `edits` block. [spec/OVERWORLD.md](OVERWORLD.md) has its grammar.

Note: the "What v0 does not cover" list at the end of `spec/LANGUAGE.md` predates the overworld module and the 16-level proof; its "Overworld maps" and "Proof coverage" items are superseded by the overworld section above it and by `scripts/prove-all.sh`.

### 6.1 Fizz 2: the dialect, world projects and target profiles (planned)

- **A superset in text, not in meaning.** First line `script fizz2 0`, written when the level is created and fixed for life. Every Fizz 1 script still parses, so it can be converted; the games behave differently in places (the exit needs Up in Fizz 2, a door is bound to a state, Fizz 2 has the wall-kick as a core mechanic), and each difference is a row in the capability matrix with its own check.
- **World projects.** A world holds its levels, overworld, shared definitions (enemies, items, states, sounds, strings), sprites, parallax panels and theme, and builds through `fizz-bake` into one world pack ([spec/WORLD.md](WORLD.md)).
- **What a level holds** is `LEVL` version 2 (version 1 dropped): size, name, start, `floor_solid`, a state table, bindings, a tile map, objects (keys, snacks and cans, the chicken, switches, lights, custom enemies and items), rules and strings.
- **States and rules.** `state NAME START [values=...]`; `door ... state=NAME open=VALUE` and `state=` on lights and panels; `when INPUT [if CONDITION [and CONDITION]] [after=T] then ACTION[, ACTION] [repeat]` with inputs from keys, switches, areas, pick-ups, enemies and groups cleared, timers and state changes; `lock red-door key=red at=X,Y` as sugar. Rules and objects raise floating words and sounds from the world's library.
- **Behaviour scripting.** Custom enemies and items are defined in the world (sprite, hitbox, stats, modes and handlers, reactions, item effects), compiled to bytecode with a static worst-case step count, and run by the game's interpreter under a per-tick budget ([spec/SCRIPTING.md](SCRIPTING.md)).
- **The look.** The oblique ground is the Fizz 2 look and the canvas of a Fizz 2 level is the game's own drawing (the flat grid stays as an aid and as the Fizz 1 view); placed lights and bitmap parallax panels are authored; Fizz 1's sprites are a retro art set, art only.
- **Syntax.** The Fizz 2 repository has not written the grammar; this is the studio's proposal, and `fizz-script` wins where it differs. Errors reuse E001 to E016 and add E101 to E130 and E201 to E208; lints are W101 to W113 and W201 to W205.
- **Target profiles.** A profile (`fizz1`, `ep2`, later `ep3`) holds the dialect versions it accepts, the content tables, limits, budgets, physics parameters and a capability state per feature: built, accepted, reserved or absent. Later episodes are new profiles on a versioned dialect.
- **Fizz 1 export and conversion.** Export is a lowering plus the lossy check (E120 to E123, W103, W104, W110); Convert to Fizz 2 writes a new level with a conversion report.
- **What is not decided** is listed in [docs/DECISIONS.md](../docs/DECISIONS.md) and in [docs/QUESTIONS.md](../docs/QUESTIONS.md).

## 7. Architecture

[spec/ARCHITECTURE.md](ARCHITECTURE.md) has the detail. The layers, and which owns what:

| Layer | Owns | Today |
| --- | --- | --- |
| The game (Rust, `episodes/episode-1/game`, `crates/sim`) | The simulation, the `Builder`, the level and overworld tables, fingerprints, the playtest bot | In the game repository; copied into `scratch/rust/` for the proofs |
| Language package (`packages/language`) | Text ↔ AST, the edits rule, Rust export, the overworld model and rasteriser, the language docs | Built |
| Level rasteriser (`packages/mcp/src/world.ts`) | A picture of a level script, for drawing and structural checks | Built; agrees with the game on all 16 levels |
| MCP server (`packages/mcp`) | Claude's tools, proposals, modes, history, notes | Built for one level file |
| Studio app (`apps/studio`, Tauri v2) | The windows, the canvas and panels, the chrome; it renders and sends intents | Prototype only; planned in `spec/DESKTOP.md` |
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

Correctness rests on proofs against the game's own data, not on reading the code. [docs/TESTING.md](../docs/TESTING.md) lists every test.

| Proof | Command | Proves |
| --- | --- | --- |
| Language unit tests | `bun test packages/language` | Parser, printer round trip, edits rule, every error code, exporter output, overworld parsing and export, docs completeness (76 tests) |
| MCP tests | `bun test packages/mcp` | Propose, direct, accept, reject, undo, refusals, rendering, checks, a real stdio session (21 tests) |
| Crater and kitchen sink | `bash scripts/prove-crater.sh` | The hand-written `levels/crater.fizz` equals `crater()` field by field and by fingerprint; `scratch/kitchen-sink.fizz`, which uses each v0 statement once, compiles and runs |
| Every level and the overworld | `bash scripts/prove-all.sh` | All 16 scripts in `levels/real/` equal the game's levels (tiles, switches, spawns, items, platforms, start, arena, rooms, fingerprint); `overworlds/main.fizz` equals `build_overworld()`; the TypeScript rasterisers agree with the game's dumped data |
| Design harness | `tools/design-harness/*.cjs` | The prototype's behaviours in a real headless Chromium, with audio muted |

The proofs need Rust and the crates already in the local Cargo cache (`--offline`); they build only inside `scratch/rust/`, a copy of the game's `crates/sim` and `episodes/episode-1/game` that differs from the game only by the proof modules: four `#[cfg(test)]` declarations at the end of `levels.rs` and the files they include (checked with `diff` on 2026-10-18).

## 13. Milestones

[docs/ROADMAP.md](../docs/ROADMAP.md) has exit criteria and dependencies.

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
