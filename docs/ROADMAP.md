# Roadmap

The milestones in order, each with what it delivers, its exit criteria and what it depends on. Requirement ids refer to `spec/REQUIREMENTS.md`; engine change ids (E for Fizz 1, F for the Fizz 2 change requests) to `ENGINE-CHANGES.md`.

**Order.** Fizz 2 is the more important target (D32), so its milestones come first, and making Fizz 1 levels stays a goal (M9 to M12). The milestones were renumbered on 2026-11-04; the old numbers are in the table. The studio is a Tauri v2 desktop app to the Liminal HQ standards ([DESKTOP.md](../spec/DESKTOP.md), D54), so there is no WebAssembly bridge milestone: the games are linked natively (D59).

| Milestone | Depends on | Formerly |
| --- | --- | --- |
| M0 Spec | — | M0 |
| M1 Desktop walking skeleton | M0; F23 | Part of M1 and M2 |
| M2 World projects and Fizz 2 levels | M1; F1, F2, F4, F10, F15 | Part of M7 and M9 |
| M3 States and rules | M2; F6, F11, F18 | New |
| M4 Claude in the studio | M2, M3 | M4 |
| M5 Lights, panels and the Game view | M2; F3, F5, F12, F13, F19, F22 | M8 |
| M6 Pixel editor | M2 (M5 for panels in place) | New |
| M7 Behaviour scripting | M3, M5; F16, F17, F21, F22 | New |
| M8 Retro art and Fizz 1 conversion | M2, M6; F20; E11 | Part of M7 and M9 |
| M9 Fizz 1 overworld designer | M1; E1, E2, E10 | M1 |
| M10 Fizz 1 level editing | M1 | M2 |
| M11 Fizz 1 registry and progress | M9 (alongside M10) | M3 |
| M12 Fizz 1 native host and Rust levels | M10, M11; E6 to E9 | M5 and M6 (merged: the WebAssembly bridge became native host work) |
| M13 Episode 3 profile | M2 (and an Episode 3 repository) | M10 |

M5 and M6 can run alongside each other, and M9 to M13 can run alongside the Fizz 2 milestones when there are hands for both.

## M0 — Spec

**Delivers:** the spec in `spec/` and the documents in `docs/`.

**Exit criteria:** every requirement has an id and a status; every status is backed by a file, a test or a proof in this folder; the open questions and risks are listed.

**Depends on:** nothing.

## M1 — Desktop walking skeleton

The studio as a Liminal HQ Tauri v2 desktop app, meeting the standards from the first commit, and the editor shell every target shares.

**Delivers:**

- The standard layout and tooling ([DESKTOP.md](../spec/DESKTOP.md) sections 2 to 4 and 11): `apps/studio` with a thin `src-tauri`, the Cargo and Bun workspaces, the pinned toolchain, `packages/chrome` copied from Waypoint with the studio's tokens, `packages/protocol` with `ts-rs` and the drift check, `bun run validate`, the CI container jobs, Dependabot, licence headers and third-party notices (R-APP-01 to R-APP-04).
- Windows created in Rust with the labels and per-concern capabilities of `DESKTOP.md` section 6, tear-off copied from Waypoint, system appearance, the settings plugin and recent worlds with no browser storage, the i18n catalogue, logging, single instance (R-APP-05 to R-APP-08).
- The session in Rust: intents, patches, revisions, named undo and redo; native files with atomic canonical writes, file watching, autosave and recovery (R-APP-09, R-APP-10).
- The editor shell on it: the canvas, the Ultimate panels, Paint, Erase, Pick, Select and Stamp, the Palette, the Objects window, History, the Script panel with completion, the Ghosts lens, and New level and New world fixing a level's target (R-WLD-02).
- The game crates linked as pinned git dependencies (F23, D58) and the Fizz 1 dialect's Rust port started against its corpus (D56).
- The debug-only MCP bridge and the first `tauri-mcp-server` checks (D60).

**Exit criteria:**

- The app builds and packages on Linux (deb, rpm, AppImage) and Windows 11 (msi, nsis) from CI, and `bun run validate` passes.
- It opens a Fizz 1 level (`levels/crater.fizz`) and a Fizz 2 world (a world project holding the slice level as a script), shows each on the canvas, takes a paint stroke and an undo, and saves files that differ from the originals only in the lines the studio owns.
- An edit made to an open file in a text editor appears in the studio within a second, and a crash leaves a recovery copy that Restore brings back.
- A paint stroke updates the canvas and the script within 16 ms at the 95th percentile on Marshmallow Meadows (R-PERF-01); every level opens in under a second (R-PERF-02).
- `tauri-mcp-server` drives the running debug build through those steps in CI on Linux.

**Depends on:** M0, and F23 from the Fizz 2 repository (its crates usable from outside it).

## M2 — World projects and Fizz 2 levels

Nothing here is started, and much of it waits on the Fizz 2 repository: its grammar (F1), content export (F2), baker (F4), `LEVL` 2 (F10) and world packs (F15). The dialect work runs behind the conformance corpus so the studio never runs ahead of `fizz-script` without a check.

**Delivers:**

- **World projects** ([WORLD.md](../spec/WORLD.md)): `world.fizz`, the folder, shared definitions by name, Build world and Check world through `fizz-bake`, and the Budget window's size meters (R-WLD-01, R-WLD-03, R-WLD-04).
- **Target profiles** as data, generated from each game's tables, with capability states and the Capabilities card (R-TGT-01 to R-TGT-05).
- **In the Fizz 2 dialect crate, on `fizz-script`:** the `script fizz2 0` header, `start`, `floor`, the `map` block with the profile's legend, `at=` and the printer rule, the `objects` section with ids resolved to indices, `string`, the reserved words, and the dialect's errors and lints (R-F2-01, R-F2-02, R-F2-04, R-F2-09, R-F2-10, R-F2-15).
- **In the editor:** map painting, the Objects window with ids and indices, snap to floor, the Exit and Head room lenses, the dump view, the Sprites window and objects drawn with their sprites (R-F2-06, R-F2-07, R-F2-14, R-F2-18, R-SPR-01 to R-SPR-04), and the Game view as the canvas once F5 exists, drawn natively by the game host and streamed over a `Channel`, with the flat fallback until then (R-F2-20).
- **The Fizz 1 export** with its lossy check (R-F2-05, R-F2-16).
- **MCP:** `get_target`, the Fizz 2 object tools, `check_export`, `get_budget`, `get_dump`, the read-only sprite tools (R-F2-23).

**Exit criteria:**

- Every script in the conformance corpus parses, prints back unchanged and reports the same codes and positions as `fizz-script`.
- The slice level, written as a Fizz 2 script in a world project, builds through `fizz-bake` into a world pack whose `LEVL` 2 section gives the digest the Fizz 2 repository pins for the regenerated slice (R-F2-22).
- A Fizz 2 level exports to Fizz 1 with exactly the expected errors and warnings, and a level without Fizz 2-only content exports with only W104 and W110.
- Every capability in the matrix has a test that shows its state in each profile, and a synthetic profile changes the editor's behaviour with no code change.

**Depends on:** M1, and F1, F2, F4, F10, F15 and F23 from the Fizz 2 repository. Because the studio links `fizz-script` natively (D55), the corpus checks the studio's owned-line rewrites and completion, not a second parser.

## M3 — States and rules

**Delivers:** `state`, bindings (`door`, and `state=` on lights and panels), `when` rules with every input, condition and action, `lock` as sugar with its exact expansion, raised events (`word`, `cue`) with the world's sound library and the string checks, the States and Rules windows with their Words and Sounds tabs, the States lens, rule previews run in the game host (F6), the Fizz 1 export of states, and the MCP tools for states, rules and strings (R-ST-01 to R-ST-08, R-F2-03, R-F2-11 to R-F2-13, R-F2-19).

**Exit criteria:**

- For every corpus level, the studio's states, bindings and rule records equal `fizz-bake dump` field for field, and every `lock` expands exactly as `LANGUAGE.md` says.
- A rule fixture for each input runs in the game host and changes its state on the expected tick; a death resets every state.
- A level whose states the Fizz 1 export cannot say reports E120 or E121 for each, and a standard-lock level exports exactly.

**Depends on:** M2, and F6, F11 and F18 from the Fizz 2 repository. Until F11 is built, the inputs and actions beyond today's locks are "accepted" (W106).

## M4 — Claude in the studio

**Delivers:** the MCP server attached to the live studio, for Fizz 2 levels first: `get_selection`, Accept and Reject as studio buttons (the CLI retired or kept for scripts), ghosts drawn from the sidecar's pending proposals, the object tools (`list_objects`, `add_object`, `set_object`, `remove_object`), `edit_level` taking the whole `edits` vocabulary (R-AI-10), `describe_word` and `check_lines`, and a single writer for the sidecar.

**Exit criteria:**

- In a real Claude Code session, Claude reads the selection on a Fizz 2 level, proposes a new state with a rule and an object move, the person accepts one and rejects the other in the studio, and `get_changes` reports both with the reasons.
- In propose mode the level file is byte-identical until an accept; no tool can change the mode.
- A proposal made before a conflicting hand edit is shown as a conflict, not applied.

**Depends on:** M2 (objects in Fizz 2 levels), M3 (states and rules). The overworld tools follow with M9 and the Fizz 1 object tools with M10.

## M5 — Lights, panels and the Game view

**Delivers:** the Game view as the canvas of every Fizz 2 level, drawn by the game's presenter (the oblique ground, F13; panels; Night and Sky), placed lights with the Light tool and the light meters (R-F2-24), bitmap parallax panels with their properties (R-ART-03), the theme from the world with a per-level override (F3), and the frame-cost meters for lights and panels (F22).

**Exit criteria:**

- For the slice, the Game view's frames equal the game's pinned frame digests by day and at night; with the draw export absent, the canvas shows the flat fallback and says so.
- A placed light switched by a state turns on and off in the Game view when its rule fires, and an attached light follows its enemy.
- The light and panel meters show the game's own cost figures, or say "not run".

**Depends on:** M2, and F3, F5, F12, F13, F19 and F22.

## M6 — Pixel editor

**Delivers:** the pixel editor of `EDITOR.md` section 15 for parallax panels and `drawn` sprite sets: the tools, the EGA constraints, PNG import quantised to the 16 colours with a preview, panel properties, the night-ambient preview, canonical files (R-ART-01 to R-ART-04, R-SPR-05, R-SPR-06). Tile textures wait for F14 (R-ART-05).

**Exit criteria:**

- Every Fizz 2 sprite file opens and saves byte for byte unchanged, and `bun tools/sprites/roundtrip.ts` in the Fizz 2 repository passes on a file the studio edited.
- A PNG imported twice with the same settings gives the same grid, and a generated or retro set cannot be edited.
- A panel painted in the studio appears in the Game view at its scroll factors after Build world.

**Depends on:** M2 (sprites and the world), M5 (panels in the Game view).

## M7 — Behaviour scripting

**Delivers:** custom enemies and items ([SCRIPTING.md](../spec/SCRIPTING.md)): the definition language, the compiler's checks and worst-case counts, the Definitions window and behaviour editor with its mode graph, the preview and debugger in the game host, the behaviour budget meters, the built-in roster beside custom kinds (F8), and the MCP tools (R-BHV-01 to R-BHV-08).

**Exit criteria:**

- Every definition in the behaviour corpus compiles to the same bytecode and worst-case counts in the studio and in the Fizz 2 compiler.
- Each determinism fixture gives equal state hashes natively, in WebAssembly and in headless DOSBox (in the Fizz 2 repository's parity gate).
- The debugger's registers and modes equal the native trace for each fixture, tick by tick.
- A Fizz 1 level refuses a custom definition (E208).

**Depends on:** M3 (states the behaviours change), M5 (drawing in the preview), and F8, F16, F17, F21 and F22.

## M8 — Retro art and Fizz 1 conversion

**Delivers:** Import Fizz 1 art into a world as the read-only retro set, packed in the world pack (F20); retro levels, art only (R-WLD-05); Convert to Fizz 2 with its conversion report (R-F2-17, R-WLD-06); the `fizz1` profile checked against the Fizz 1 game (E11).

**Exit criteria:**

- Crater Fields and Whisper Hollow convert to Fizz 2 with exactly the expected report, a map equal tile for tile to the rasteriser's output, and, with Use Fizz 1 art, objects drawn with Fizz 1 sprites.
- A world with the retro set builds, and the set is in the world pack and not in `SHARED.FAP`.

**Depends on:** M2, M6 (the Sprites window and art handling), F20, E11.

## M9 — Fizz 1 overworld designer

The Fizz 1 overworld, on the shell of M1. Its model is already proven (2,640 tiles, 27 points, five areas). It was the first milestone before Fizz 2 became the more important target.

**Delivers:**

- The Point tool, the Links, Areas and Ghosts lenses and the overworld palette on the M1 shell; level sprites on points with the sprite picker (E10, R-OW-12).
- In `packages/language`: an API that rewrites one owned object line in place (R-LANG-17), canonical printing for overworld nodes (R-OW-13), and overworld checks (R-OW-11).
- Points: add, move, remove; the Level field; Unlocks chips; Big and Hidden; teleporter pairing.
- MCP: `get_overworld`, `get_map_region`, the point tools, `set_unlock`, `check_overworld`, and `list_files` with a `file` argument (`MCP.md` §2).
- In the game: `OverworldBuilder` in `levels.rs` and a home for generated code (E1, E2), with the overworld proof running in the game's tests (E12 for the overworld).

**Exit criteria:**

- `overworlds/main.fizz` opens; moving a point, changing an unlock rule and re-pairing a teleporter each rewrite exactly one line, and every other line is byte-identical.
- The exported overworld still equals `build_overworld()` before any change, and after a change the game's map shows it.
- `check_overworld` reports every level with exactly one point, all pairs both ways, no cycles, every level reachable from the saucer, for `main.fizz`.
- Claude can propose a new point and an unlock change over MCP; in propose mode nothing changes until the person accepts in the studio.

**Depends on:** M1 (the shell). Adding a *new* level to the map waits for M11; M9 works with the 16 existing level ids.

## M10 — Fizz 1 level editing

**Delivers:** making and editing Fizz 1 levels, still a goal: the Fizz 1 tools on the M1 shell (Lift, Room, Arena), the objects in a level (lifts, rooms, the arena as a top-level line, channels) with every drag handle (R-OBJ-03), the Gaps, Ghosts, Reach and Hazards lenses, the starter-levels card with every item drawn (R-START-02), the language package's parser behind the typed line and the script panel (R-SCR-04), and the level rasteriser moved into `packages/language`.

**Exit criteria:**

- All 16 Episode 1 levels open from their scripts and every proof in `scripts/prove-all.sh` still passes after a round of open, edit, undo all, save.
- A paint stroke on Marshmallow Meadows (220 × 32) updates the canvas and the script within 16 ms at the 95th percentile (R-PERF-01); every level opens in under a second (R-PERF-02).
- `tauri-mcp-server` checks cover the Fizz 1 tools, objects and lenses in the running app, with audio muted; the prototype's Playwright suites stay design checks only.

**Depends on:** M1 (the shell, the object-line API).

## M11 — Fizz 1 registry and progress

**Delivers:** the engine changes that let a new level exist: the level registry and a free saucer id (E3), the wider masks with a save migration (E4), the overworld registry (E5), and name tables checked against the game (E11). In the studio: a New level flow that writes the script, the registry row and a point on the chosen overworld as one reviewable change (`OVERWORLD.md` §9).

**Exit criteria:**

- A sixteenth level made with the flow exports, compiles, appears on the overworld behind its unlock rule, can be entered, and its cleared bit survives a save and load; an old save keeps its secret.
- A test fails when any name in `tables.ts` or `overworld.ts` differs from the game.

**Depends on:** M9 (the overworld designer places the new point). Can run alongside M10.

## M12 — Fizz 1 native host and Rust levels

The Fizz 1 game linked natively in the game host, which replaces the planned WebAssembly bridge, and editing on top of Rust-written levels.

**Delivers:** a level's data from the game (E6), a level built from a script inside the sim (E7), enemy paths (E8) behind the Paths lens and `get_enemy_paths`, and the playtest bot (E9) behind Run playtest bot, the Checks window and `run_playtest`, all as public Rust APIs called on worker threads with progress over `Channel`s; opening hand-written procedural Rust levels from their data (R-RUST-02), with edits kept and exported on top of them (R-RUST-03, `docs/QUESTIONS.md` Q2); the full enemy docs (R-LANG-16).

**Exit criteria:**

- For all 16 levels, the op stream run in the sim gives the compiled level's fingerprint.
- The Paths lens draws the sim's trace; a Rust test confirms the traces for Crater Fields.
- The playtest routes from `playtest.rs` give the same outcomes through the API; `run_checks` reports a real playtest result instead of "not run".
- A Rust-written level opens, takes a painted edit, exports, and the game shows the edit while the Rust function is unchanged.

**Depends on:** M10, M11, and E6 to E9 in the Fizz 1 repository.

## M13 — Episode 3 profile

**Delivers:** an `ep3` profile on the `fizz2` dialect family, generated from Episode 3's own tables, its world projects, and any dialect version it needs.

**Exit criteria:**

- A synthetic third profile (used by the tests from M2) and then the real one load with no change to the editor's code.
- Fizz 2 worlds still open, check and build unchanged under `ep2`.

**Depends on:** M2, and an Episode 3 repository that publishes its tables.
