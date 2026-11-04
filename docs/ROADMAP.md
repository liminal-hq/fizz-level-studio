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
| M6 Rust levels | M3, M5 |
| M7 Target profiles and the Fizz 2 dialect (planned) | M2 (and the Fizz 2 repository's level source, grammar and baker) |
| M8 Fizz 2 look and budgets (planned) | M7, M5's bridge pattern (and a draw export and theme format from the Fizz 2 repository) |
| M9 Sprites (planned) | M7 (and Fizz 2's sprite decisions); M1 for overworld point sprites |
| M10 Episode 3 profile (planned) | M7 (and an Episode 3 repository with its own tables) |

**Order.** Fizz 2 is the more important target (D32), so once M2's editor exists, M7 comes next and may run ahead of M3 to M6, which are Fizz 1 engine work. M1 and M2 build the shell both targets share. M8 and M9 can run alongside each other.

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

## M6 — Rust levels

**Delivers:** opening hand-written procedural Rust levels from `level_dump` at run time (R-RUST-02), with edits kept and exported on top of them (R-RUST-03, `SPEC.md` Q2); the full enemy docs (R-LANG-16). The sprite picker and level sprites on points moved to M9, so one sprite design serves both targets.

**Exit criteria:**

- A Rust-written level opens, takes a painted edit, exports, and the game shows the edit while the Rust function is unchanged.

**Depends on:** M5 (level data from WebAssembly), M3 (registry).

## M7 — Target profiles and the Fizz 2 dialect (planned)

Nothing here is started. It follows the Fizz 2 repository's own plan (the level source refactor, the dialect, `fizz-bake`, the pack loaders), and it can begin once M2's editor exists, with the dialect work behind the conformance corpus so the studio does not run ahead of `fizz-script` without a check.

**Delivers:**

- **Target profiles** (R-TGT-01 to R-TGT-05): `fizz1` and `ep2` as data, generated from each game's tables (ENGINE-CHANGES E11 and F2), with capability states, the Capabilities card, `studio.json` and the `target` line.
- **In `packages/language`:** the `script fizz2 0` header; `start`, `floor`, `channel`; the `map` block with the profile's legend; `at=` and the printer rule; the `objects` section with ids resolved to indices; `lock`, `when ... then ...`, `string` and `allow`; the reserved `theme`, `light` and `music`; E101 to E123 and W101 to W112, each with a test (R-F2-01 to R-F2-17).
- **The Fizz 1 export** (lowering and its check) and **Convert to Fizz 2**.
- **In the editor:** map painting, the Objects window with ids and indices, the Lock field, the Rules window with Strings and the cue pickers, snap to floor, close all doors, the Channels, Exit and Head room lenses, inline lints and the dump view (R-F2-06, R-F2-07, R-F2-18, R-F2-19).
- **MCP:** `get_target`, rule, lock, string and object tools, `check_export` and `get_dump` (`MCP.md` section 2, R-F2-23).

**Exit criteria:**

- Every script in the conformance corpus parses, prints back unchanged and reports the same codes and positions as `fizz-script`.
- The slice level, written as a script in the studio, bakes through `fizz-bake` to the digest of the `const` slice (R-F2-22), and the studio's object indices and rule records match `fizz-bake dump`.
- A Fizz 2 level that uses rules exports to Fizz 1 with the expected E121 errors, one that does not exports with only W104 and W110 warnings, and Crater Fields converts to Fizz 2 with exactly the expected E102 list.
- Every capability in the matrix has a test that shows its state in each profile, and changing one row of a profile's data changes the editor's behaviour with no code change.
- In a real Claude Code session, Claude proposes a lock and a rule over MCP and the person accepts them in the studio.

**Depends on:** M2 (the editor), and the Fizz 2 repository's level source (#137 to #140), grammar and baker. Whether the editor loads `fizz-script` as WebAssembly or keeps its own parser is not decided (`SPEC.md` Q10).

## M8 — Fizz 2 look and budgets (planned)

**Delivers:** the Game view drawn by the game's presenter in a Web Worker (the oblique ground, parallax, the Sky choice, Night and lights; R-F2-20), the Budget window with each meter's source (R-F2-21), and, once the Fizz 2 repository defines its level and theme format, the lowering of `theme`, `light` and `music` and the W111 light-budget lint.

**Exit criteria:**

- For the slice, the Game view's frames equal the game's pinned frame digests by day and at night.
- Every budget meter shows the number `fizz-bake` reports for the slice, or says "estimate" or "not run".
- With the Fizz 2 draw export absent, the Game view says "not available" and draws nothing.

**Depends on:** M7, the bridge pattern of M5, and from the Fizz 2 repository a draw export (ENGINE-CHANGES F5) and the theme format (F3).

## M9 — Sprites (planned)

**Delivers:** the target's sprites on the canvas by kind (R-SPR-01), the Sprites window with Ben's pose sets, pickups, HUD keys and the enemy roster as it lands (R-SPR-02), animation preview (R-SPR-03), canonical reading and writing of Fizz 2 sprite files (R-SPR-04), the pixel editor for `drawn` sets (R-SPR-05), the night-ambient preview (R-SPR-06), and level sprites on overworld points with the sprite picker (E10, R-OW-12).

**Exit criteria:**

- Every Fizz 2 sprite file opens and saves byte for byte unchanged, and `bun tools/sprites/roundtrip.ts` in the Fizz 2 repository passes on a file the studio edited.
- Every object kind in each profile draws with its sprite, or with a labelled placeholder where the target has none.
- A level point's sprite can be chosen from the game's sprite names and the map draws it.

**Depends on:** M7 (profiles map kinds to sprites), Fizz 2's sprite decisions (the `SPRT` layout, which Ben ships), and M1 for overworld points.

## M10 — Episode 3 profile (planned)

**Delivers:** an `ep3` profile on the `fizz2` dialect family, generated from Episode 3's own tables, and any dialect version it needs.

**Exit criteria:**

- A synthetic third profile (used by the tests from M7) and then the real one load with no change to the editor's code.
- Fizz 2 levels still open, check and export unchanged under `ep2`.

**Depends on:** M7, and an Episode 3 repository that publishes its tables.
