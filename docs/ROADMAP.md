# Roadmap

The milestones in order, each with what it delivers, its exit criteria and what it depends on. Requirement ids refer to `SPEC.md` §10; engine change ids to `ENGINE-CHANGES.md`.

| Milestone | Depends on |
| --- | --- |
| M0 Spec | — |
| M1 Overworld designer | M0 |
| M2 Level editing | M1 |
| M3 Registry and progress | M1 (can run alongside M2) |
| M4 Claude in the studio | M1, M2 |
| M5 WebAssembly bridge | M2, M3 |
| M6 Sprites and Rust levels | M3, M5 |

## M0 — Spec

**Delivers:** `SPEC.md` and the documents in `docs/`.

**Exit criteria:** every requirement has an id and a status; every status is backed by a file, a test or a proof in this folder; the open questions and risks are listed.

**Depends on:** nothing.

## M1 — Overworld designer

The first slice of the real studio, built on the overworld because it is the next big feature and its model is already proven (2,640 tiles, 27 points, five areas).

**Delivers:**

- The studio shell, enough for one map: the canvas, the Ultimate window system, the tool rail with Paint, Erase, Pick, Select, Stamp and Point, the Palette, the Objects window, History with named undo and redo, the Script panel with the typed-line box and completion, the Links, Areas and Ghosts lenses, and saving to the `.fizz` file.
- In `packages/language`: an API that rewrites one owned object line in place (R-LANG-17), canonical printing for overworld nodes (R-OW-13), and overworld checks (R-OW-11).
- Points: add, move, remove; the Level field; Unlocks chips; Big and Hidden; teleporter pairing.
- MCP: `get_overworld`, `get_map_region`, the point tools, `set_unlock`, `check_overworld`, and `list_files` with a `file` argument (`MCP.md` §2).
- In the game: `OverworldBuilder` in `levels.rs` and a home for generated code (E1, E2), with the overworld proof running in the game's tests (E12 for the overworld).

**Exit criteria:**

- `overworlds/main.fizz` opens; moving a point, changing an unlock rule and re-pairing a teleporter each rewrite exactly one line, and every other line is byte-identical.
- The exported overworld still equals `build_overworld()` before any change, and after a change the game's map shows it.
- `check_overworld` reports every level with exactly one point, all pairs both ways, no cycles, every level reachable from the saucer, for `main.fizz`.
- Claude can propose a new point and an unlock change over MCP; in propose mode nothing changes until the person accepts in the studio.

**Depends on:** M0. Adding a *new* level to the map waits for M3; M1 works with the 16 existing level ids.

## M2 — Level editing

**Delivers:** the level tools (Paint, Erase, Pick, Select, Stamp, Lift, Room, Arena), the objects in a level (lifts, rooms, the arena as a top-level line, channels) with every drag handle (R-OBJ-03), the Gaps, Ghosts, Reach and Hazards lenses, the starter-levels card with every item drawn (R-START-02), the language package's parser behind the typed line and the script panel (R-SCR-04), and the level rasteriser moved into `packages/language`.

**Exit criteria:**

- All 16 Episode 1 levels open from their scripts and every proof in `scripts/prove-all.sh` still passes after a round of open, edit, undo all, save.
- A paint stroke on Marshmallow Meadows (220 × 32) updates the canvas and the script within 16 ms at the 95th percentile (R-PERF-01); every level opens in under a second (R-PERF-02).
- The Playwright suites are ported to the studio, run without machine-specific paths, mute audio, and pass.

**Depends on:** M1 (the shell, the object-line API).

## M3 — Registry and progress

**Delivers:** the engine changes that let a new level exist: the level registry and a free saucer id (E3), the wider masks with a save migration (E4), the overworld registry (E5), and name tables checked against the game (E11). In the studio: a New level flow that writes the script, the registry row and a point on the chosen overworld as one reviewable change (`OVERWORLD.md` §9).

**Exit criteria:**

- A sixteenth level made with the flow exports, compiles, appears on the overworld behind its unlock rule, can be entered, and its cleared bit survives a save and load; an old save keeps its secret.
- A test fails when any name in `tables.ts` or `overworld.ts` differs from the game.

**Depends on:** M1 (the overworld designer places the new point). Can run alongside M2.

## M4 — Claude in the studio

**Delivers:** the MCP server attached to the live studio: `get_selection`, Accept and Reject as studio buttons (the CLI retired or kept for scripts), ghosts drawn from the sidecar's pending proposals, the object tools (`list_objects`, `add_object`, `set_object`, `remove_object`), `edit_level` taking the whole `edits` vocabulary (R-AI-10), `describe_word` and `check_lines`, and a single writer for the sidecar.

**Exit criteria:**

- In a real Claude Code session, Claude reads the selection, proposes a lift move and an enemy, the person accepts one and rejects the other in the studio, and `get_changes` reports both with the reasons.
- In propose mode the level file is byte-identical until an accept; no tool can change the mode.
- A proposal made before a conflicting hand edit is shown as a conflict, not applied.

**Depends on:** M2 (objects in levels), M1 (overworld tools).

## M5 — WebAssembly bridge

**Delivers:** level data from the game (E6), a level built from a script inside the sim (E7), enemy paths (E8) behind the Paths lens and `get_enemy_paths`, and the playtest bot (E9) behind Run playtest bot, the Checks window and `run_playtest`, all in a Web Worker.

**Exit criteria:**

- For all 16 levels, the op stream run in the sim gives the compiled level's fingerprint.
- The Paths lens draws the sim's trace; a Rust test confirms the traces for Crater Fields.
- The playtest routes from `playtest.rs` give the same outcomes through the exports; `run_checks` reports a real playtest result instead of "not run".

**Depends on:** M2, M3 (a scripted level not yet compiled into the game must still be loadable).

## M6 — Sprites and Rust levels

**Delivers:** the sprite picker and level sprites on points (E10, R-OW-12); opening hand-written procedural Rust levels from `level_dump` at run time (R-RUST-02), with edits kept and exported on top of them (R-RUST-03, `SPEC.md` Q2); the full enemy docs (R-LANG-16).

**Exit criteria:**

- A level point's sprite can be chosen from the game's sprite names and the map draws it.
- A Rust-written level opens, takes a painted edit, exports, and the game shows the edit while the Rust function is unchanged.

**Depends on:** M5 (level data from WebAssembly), M3 (registry).
