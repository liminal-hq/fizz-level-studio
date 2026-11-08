# The level model: continuous pictures, overlays, and planes

A design note for what a Fizz 2 level can be in the studio, and what is still to decide. **Nothing in it is built, and most of it is not decided.** The owner's direction of 2026-11-07 is recorded as the proposed decision D73 in [DECISIONS.md](DECISIONS.md); the questions it leaves open are Q44 to Q49 in [QUESTIONS.md](QUESTIONS.md), and the Fizz 2 change requests it proposes are F24 to F28 in [ENGINE-CHANGES.md](ENGINE-CHANGES.md#fizz-2-planned).

Each claim is marked **verified** (read in the source named beside it) or **inferred** (reasoned from those sources, not checked against running code). The sources are this repository, the Fizz 2 repository (`~/source/experiments/fizz-2`, read on `origin/main` at `46afd6c`), the Fizz 1 game (`liminal-hq/lieutenant-fizz`), and the owner's design artefact "Fizz 2 levels, mazes and palette" (27 boards; the two sample levels, the maze concepts, and the solvability rules).

## Contents

- [1. The principle](#1-the-principle)
- [2. The three concepts](#2-the-three-concepts)
- [3. Size](#3-size)
- [4. Solvability](#4-solvability)
- [5. What it means for the editor](#5-what-it-means-for-the-editor)
- [6. Proposed schedule](#6-proposed-schedule)
- [7. Open questions for the owner](#7-open-questions-for-the-owner)

## 1. The principle

The level editor is a general tile-map editor that makes maps. An underground, a tower, a cave maze, a set of rooms, or a surface run over deep bands are all shapes of the same thing: a grid of tiles with objects, states, and rules on it. The editor should handle every one of them without a mode or a level type for each; what has to be decided is how deep a level may be, how rooms and depth are drawn, whether a level may hold more than one plane, and how the editor proves a level can be finished (owner, 2026-11-07).

The owner's two sample levels already work this way (**verified**, the samples artefact):

| Sample           | Size (tiles) | What it is                                                                                                                                                                                                            |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse Point | 64 × 80      | An overworld night coast: a seven-floor tower (F0 to F6) climbed by ladders, a lift, and the grapple, with one-way falls of 8 and 9 rows to the jetty. One grid in which "y grows upwards, row 0 at the bottom".      |
| Siphon Works     | 96 × 76      | The underworld under the cocoa factory: Earth factory at the top (rows 46 and up), a stained transition (37 to 45), and Zarg overgrowth below. A hub and three spokes, a drop maze, and a secret office, in one grid. |

Every link between depths in the samples is a ladder, a drop hole, a balcony fall, or the grapple; there are no portals or doors to other spaces. The samples cite Keen 4 to 6 maps that "keep sky and depth in one frame" (K4-005, K4-003, K6-017).

## 2. The three concepts

The owner named three ways to build a back room or another space, and wants the editor to handle all of them:

| Concept                | What it is                                                                                                                                                                  | Status                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Continuous picture** | The level is one map, one picture; rooms and depths are places in it, reached by walking, climbing, or falling                                                              | The baseline (owner, 2026-11-07)                                                |
| **Overlays**           | Art on its own plane over or under the map: (1) **draw planes** in front of or behind Ben, and (2) **rooms that fade** while Ben is inside, so the picture stays continuous | Wanted: "a concept this game series has and should continue through the editor" |
| **Planes**             | Separate maps inside one level, joined by doors: walking through a door takes Ben to a back room or another plane                                                           | Acknowledged as a second concept; not decided                                   |
| _Data plane_ (an idea) | A plane over the map that holds data, not art: triggers, spawn points, secrets, route hints, one-way marks (as Keen's info plane)                                           | **An idea, not a decision and not scheduled** ("haven't gotten there yet")      |

### 2.1 Continuous picture

| Layer                   | Today                                                                                                                                                                                                                                  | What would have to grow                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEVL` 2 (Fizz 2)       | One tile plane: `w` and `h` are each `u16` (at least 1), then `w * h` tile ids of one byte each, row 0 at the bottom; one spawn; states, bindings, objects, rules, and strings (**verified**, Fizz 2 `docs/FAP.md` "`LEVL`")           | Nothing for the shape. The mechanics that link depths (ladders, vines, lifts, the mantle) are not built (F24)                                        |
| `script fizz2 0`        | One `map` block, exactly `h` rows of `w` characters, one `start` (**verified**, [LANGUAGE.md](../spec/LANGUAGE.md#the-map-block)); ladders, vines, lifts, and rooms are Absent, E102 (**verified**, the capability matrix)             | Legend letters for the climbing tiles and objects for lifts, as rows in the profile's tables, never grammar (D35)                                    |
| Studio                  | The canvas scrolls on both axes over one grid (`apps/studio/src/canvas/viewport.ts`); New level caps a level at 8 to 1024 wide and 8 to 128 high (`crates/fizz-studio-level/src/new.rs`, `WIDTH_RANGE`, `HEIGHT_RANGE`) (**verified**) | The size policy of [section 3](#3-size); a depth band or named-region overlay and a jump to each band ([section 5](#5-what-it-means-for-the-editor)) |
| Change requests touched | F10 (`LEVL` 2), F11 (states and rules), F13 and D45 (the oblique look), F2 (legend letters in the content export), F6 (the step API for checks)                                                                                        | F24 (mechanics roster), F25 (solvability)                                                                                                            |

The Fizz 2 repository is already asking the question this note answers: "Does the level script language need extensions for vertical mazes, gadgets and the underworld?" (**verified**, Fizz 2 `docs/ARCHITECTURE.md`, open questions), and its proof of concept wants "a graph of data-driven levels with transitions" and "mazes and puzzles that climb and descend" (**verified**, `docs/POC-1-FINDINGS.md`).

### 2.2 Overlays

**What Fizz 1 does today (verified, `lieutenant-fizz`, `episodes/episode-1/game/src/`):**

- **Facade (painted flats).** `room(x0, y0, x1, y1)` in `levels.rs` turns every empty cell of the rectangle into the tile `FACADE` (31) and records the rectangle in the level's `rooms` list; `secret_room` marks one as the secret, which sets the secret-found bit when Ben walks in. `render.rs` draws the flats "over everything, so a hidden room hides what is inside until it fades", each room with its own alpha. The tests check that a room fades while Ben is inside and recovers when he leaves, that only the room he is in fades, and that flats are drawn after Ben (`tests.rs`). Bonbon Playhouse is "a candy playhouse whose backstage rooms are hidden behind painted flats".
- **Wall-bg.** `wall_behind` paints `WALLBG` (30), a non-solid interior back wall, into empty cells.
- **In the studio's Fizz 1 language** these are `room`, `secret-room`, and `wall-behind` statements, and the Room tool (R) drags a rectangle whose facade fills its empty cells ([EDITOR.md](../spec/EDITOR.md#3-tools-and-keys) section 3, built in the prototype; Studio M10 for the real app).

So Fizz 1 keeps both kinds of overlay in its one tile plane, as tile ids, plus a list of rectangles. A cell holds a facade or a tile, never both.

**What Fizz 2 has today (verified):** `WALLBG` (30) is the legend letter `w`, "interior wall behind the rooms; not solid" (Fizz 2 `docs/SCRIPT.md`). The oblique draw order (Fizz 2 `docs/OBLIQUE.md`, "Draw order") is: the background (the back wall for `w` cells, the theme's parallax stack for open air), far-plane decoration (portholes, ledge shadows, railings, the exit doorway; ladders and vines are far-plane decoration too, `docs/CLIMBING.md` section 9), the terrain, spikes, items and actors, and then the night pass. A cell that is neither `w` nor open air takes its background from the cell above. There is no facade tile, no front plane, and nothing is drawn after the actors except the light pass. No feature called "overlay" exists in either repository; the per-cell "door overlay" of Fizz 2 `docs/RULES.md` is an unrelated derived byte.

| Kind of overlay                                | What it needs                                                                                                                                                                                                                                                | Change requests                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Draw plane behind Ben** (back walls)         | Mostly there: `w` cells and the far-plane decoration. A separate back plane is needed only where a cell needs a solid or foreground tile and its own back art at once, or a back wall under a ledge that the "cell above" rule would give sky (**inferred**) | F13 (the oblique look), F3 (the theme's back-wall material) |
| **Draw plane in front of Ben** (trim, facades) | A plane of non-solid tiles drawn after the actors, so it covers Ben. Not in `LEVL` 2, the dialect, the presenter, or the studio                                                                                                                              | Proposed F28                                                |
| **Rooms that fade**                            | A list of room rectangles whose front-plane cells fade while Ben's body is inside; a secret room is a fade room with an `enter` rule on the same rectangle (the `enter` input is built, `docs/RULES.md`)                                                     | Proposed F28; F11 for the rule                              |
| _Data plane_ (an idea)                         | Not designed. Would hold triggers, spawn points, secrets, route hints, and one-way marks; some of these are already level data in other forms (rule rectangles, objects)                                                                                     | None; not scheduled                                         |

**Proposed shape, for the owner to accept or change (inferred):** one optional **front plane** of `w * h` tile ids (0 for none) drawn after the actors, and a **fade room** list of rectangles. A fade room fades the front-plane cells inside it while Ben is inside, as Fizz 1's flats do, which covers both kinds of overlay with one plane and one list. The fade is presentation, a function of Ben's position over the last ticks, so it should not enter the state hash, as the death shake does not (**inferred** from Fizz 2's "view only" rule for the shake and the stars). A secret uses the existing `enter` input. The back plane stays the map's own `w` cells until a level shows the need. Fade rooms would be a Fizz 2 mechanic specified by the Fizz 2 repository, as ladders are in `docs/CLIMBING.md`, not Fizz 1's carried in, so the non-goal of D49 and Q31 is not touched; the owner should confirm that reading (Q45).

### 2.3 Planes

A plane is a second map in the same level: a back room, a basement, or another dimension reached through a door, with the camera cutting to it.

| Layer    | Today                                                                                                                                                                                          | What would have to grow                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEVL` 2 | One tile plane and one spawn. The rule actions are `set`, `toggle`, `next`, `spend`, `give`, `score`, `ammo`, `word`, and `cue`; none moves Ben (**verified**, `docs/FAP.md`, `docs/RULES.md`) | A plane count, and a `w`, an `h`, and a tile block for each (F27), and a portal: an object kind or a rule action that moves Ben to a plane and a cell (F26) |
| Camera   | Fizz 1's camera with Tower mode is planned for Fizz 2 M3 (**verified**, `roadmap.json`, `cam-fizz1`)                                                                                           | A cut on a portal, and a camera clamp per plane (**inferred**)                                                                                              |
| Dialect  | One `map` block per level                                                                                                                                                                      | `map NAME` and a portal statement: new grammar, so a new dialect version (D35)                                                                              |
| Studio   | One grid per level                                                                                                                                                                             | Plane tabs, the plane above ghosted, portal pairs drawn as links ([section 5](#5-what-it-means-for-the-editor))                                             |

**What must be decided if planes come (open, Q44):**

- **What carries across.** Inside one level every state, key, and switch already holds across planes, because they are the level's (**inferred**: a plane is part of the level, so its state table is the level's). If a plane were instead a separate level behind a door (Fizz 1's buildings, reached through the overworld), keys and switches would not carry: states are level-scoped and world-scoped states are open (Q27; `WORLD` is a reserved bit in the state record, **verified**, `docs/FAP.md` open point 4).
- **The camera cut.** A cut with a fade, or a hard cut; and whether the plane behind is drawn dimmed (a "depth" view) or not at all.
- **The death reset.** A death resets the level (D33). Ben would respawn at the level's start, not at the plane's door, unless a checkpoint per plane is added.
- **The solver.** A portal is an edge in the search over (plane, cell, keys, states) ([section 4](#4-solvability)).

## 3. Size

**The facts (verified):**

- `w` and `h` in `LEVL` 2 are each `u16`, so the format allows up to 65,535 × 65,535. The decoded length is `32 + pad8(name_len) + 8 × states + 16 × bindings + 32 × (objects + strings) + 48 × rules + w × h` (Fizz 2 `docs/FAP.md`, "Length"). Tiles are one byte each. The object count is a `u16`. The reader does not check the map's width in pixels (`docs/FAP.md`, "Rule checks").
- The **96 KB** per-section limit is a policy default, not a format limit: `pub const SECTION_LIMIT: u32 = 96 * 1024;` in `crates/fizz-pack/src/pack.rs`, an owner decision of 2026-10-29 written for audio sections; "the baker takes the limit as a parameter", and a section over it is an error at bake time (`docs/FAP.md`, "Limit").
- The studio's 1024 × 128 creation caps are the studio's own choice (`crates/fizz-studio-level/src/new.rs`).
- The real constraints are elsewhere: the DOS floor is "a 4 MB machine with about 2 MB free" (`docs/FAP.md`, "Machine floor"; DOSBox reads about 2,256 KB free at `memsize` 4); a decoded section, its stored bytes while decoding, and the decoder's tables must all fit; the tiles are copied into the `TileMap` and the section buffer is then freed (`docs/FAP.md`, "Levels"); the rules keep a one-byte door overlay per tile (`docs/RULES.md` section 14). The floppy budget is a provisional `BUDGET 1100000` bytes for `FIZZ2.EXE` and the packs together, "a tracked metric, not a design limit" (`docs/PLATFORM.md`, "Size budget"), with `FIZZ2.EXE` at 374,272 bytes (the Fizz 2 Progress Report, findings).

**Worked numbers (arithmetic on the formula above):**

| Case                                                     | Tiles (bytes) | `LEVL` with full tables and 100 objects | Share of 96 KB (98,304)   |
| -------------------------------------------------------- | ------------- | --------------------------------------- | ------------------------- |
| Fizz 1-sized, 192 × 28 (`docs/FAP.md` says "about 6 KB") | 5,376         | 12,496                                  | 13%                       |
| Lighthouse Point, 64 × 80                                | 5,120         | 12,240                                  | 12%                       |
| Siphon Works, 96 × 76                                    | 7,296         | 14,416                                  | 15%                       |
| Siphon Works with a front plane (two planes of tiles)    | 14,592        | 21,712                                  | 22%                       |
| The studio's largest new level, 1024 × 128               | 131,072       | 138,192                                 | **141%: refused at bake** |

"Full tables" is every count at its limit: a 48-byte name, 32 states (256 bytes), 64 bindings (1,024), 32 rules (1,536) and 32 strings (1,024), 3,920 bytes with the header; 100 objects add 3,200. That leaves 91,184 bytes, so one tile plane can cover about **91,000 cells** under the default limit, in any shape: 1024 × 89, 712 × 128, 301 × 301, 96 × 949, or 64 × 1,424. With a front plane the area halves, to about 45,500 cells.

So the studio's caps are wrong in both directions: 128 rows is far less than the budget allows for a tall, narrow level (a 64-wide tower could be 1,424 rows deep), and 1024 × 128 is more than a default section can hold.

**Memory and floppy (inferred):** a 91,000-cell level would keep about 180 KB resident (the `TileMap` and the door overlay) and briefly hold its decoded and stored section while loading, against about 2 MB free; it fits. The floppy leaves about 725,000 bytes for every pack once `FIZZ2.EXE` is counted, and a world pack's levels are stored deflated; how well a tile map deflates has not been measured. Drawing cost depends on the view, not the map: the oblique ground draws the cells in the camera's window and "indoor frames never ask a layer to draw" (`docs/OBLIQUE.md`), so a deeper level costs memory and bytes, not frame time (**inferred**).

**Recommendation.** Make the editor's limit a **byte budget**, not a width and a height:

- The New level dialog and Resize accept any `w` and `h` from 1 to 65,535 that fit the budget, and show the level's estimated `LEVL` size against the section limit as the person types; the hard 128-row cap goes.
- The **Budget window** ([EDITOR.md](../spec/EDITOR.md#budgets) section 13) already lists a "`LEVL` section size" meter and a "Section limit" row; that meter becomes the level's size meter, with the tiles, each plane, and the tables shown as parts of the bar, an estimate until `fizz-bake` reports the real figure (G-TRUST-4).
- The limit comes from the target profile (the `ep2` profile's `SECTION_LIMIT`, or a world's own if the baker is given one), so the studio never hard-codes 96 KB.
- A warning at 75% of the limit, and an error over it, matching the bake-time error.
- The canvas's speed on a large map is measured before the cap is lifted: R-PERF-01 is measured on Marshmallow Meadows, 220 × 32, and a 91,000-cell map has 13 times as many cells (**inferred**; not measured).

## 4. Solvability

The samples propose eleven rules a checker can run against a level, by a search over (cell, keys held, channels open, gadgets held), moving by Fizz 1's physics, with enemies ignored (**verified**, the samples' "Soft-lock and solvability rules" board):

| Rule | Checks                                                                                                 | Samples' severity | Lighthouse                     | Siphon       |
| ---- | ------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------ | ------------ |
| S1   | The exit is reachable from the start with every secret closed                                          | fail              | pass (1,233 states)            | pass (3,264) |
| S2   | No point of no return: from every reachable state the exit is still reachable                          | fail              | pass after a fix (the chimney) | pass (3,657) |
| S3   | Every lock is needed: removing any key, gadget, or switch makes S1 fail                                | warn              | pass                           | pass         |
| S4   | Secrets are optional                                                                                   | fail              | pass                           | pass         |
| S5   | A gadget comes before its gate on every winning path                                                   | fail              | pass                           | n/a          |
| S6   | Every one-way move (a fall of 8 rows or more) is listed, and each landing passes S2                    | info              | 2 drops                        | 12 drops     |
| S7   | Jump margins: no critical jump needs more than 90% of a limit                                          | warn              | pass                           | pass         |
| S8   | Switch safety: no toggle whose second press closes the only way back                                   | fail              | n/a                            | n/a          |
| S9   | Lift stops: both ends standable and reachable, or the lift cycles on its own                           | fail              | pass                           | n/a          |
| S10  | Placement: nothing inside a solid tile, rows the stated width, known tiles, no enemy near a ladder top | fail or warn      | pass                           | pass         |
| S11  | Keys and doors pair; at most three gate channels                                                       | warn              | pass                           | pass         |

S2 caught a real soft-lock in Lighthouse Point's first draft: chimney ledges four rows apart that only a mantle onto a one-way ledge could leave. The samples propose failing a pull request on S1, S2, S4, S5, S8, and S9 and warning on the rest.

**Where it must run.** The samples' bot runs on the studio's parser in Node. That is not allowed for the real checker: simulation rules come from the game's own code (G-GAME-2), so the search must move Ben by the Fizz 2 game's movement, reached in the native game host through the world-stepping API (F6) or a reach query the game exports. The checker is proposed change request **F25**: S1 to S9 in the Fizz 2 repository, exposed to the studio as a crate API, with S10 and S11 (counts and placement over the parsed level) allowed in the studio's checks because they read only the script.

**The editor's surface.**

- The **Reach lens**, today "a rough three-tile box around the selection, labelled a rough guide" ([EDITOR.md](../spec/EDITOR.md#6-lenses) section 6), draws the game's reachable set from the start or the selection, shaded by what is held.
- The **Checks window** lists each S result with links to the cells, states, and one-way edges it names, and reads "not run" until the game host provides F25.
- The S6 list is drawn on the canvas as arrows on the one-way edges, and the S1 path can be handed to the playtest bot as waypoints (Q7).
- MCP: `run_checks` returns the same results for Claude.

**Errors, warnings, and gates (open, Q47).** Recommended: in the studio, S1, S2, S4, S5, S8, and S9 as errors that do not stop saving but do stop Build world, S3, S7, S10's warnings, and S11 as lints, S6 as information; in the Fizz 2 repository, S1 and S2 as a gate in `bake check` once F25 exists, since a soft-lock is the one fault a player cannot recover from, and the rest as warnings until the rules have been run on more levels.

**Planes in the search (inferred).** A plane adds its index to the state: (plane, cell, keys, states). A portal is an edge from a door cell on one plane to its pair on the other, taken with Up as the exit is. S2 then covers a plane that can be entered and not left, and S6 lists a one-way portal as it lists a one-way fall.

## 5. What it means for the editor

| Area                          | Proposal                                                                                                                                                                                                                                                                                                           | Status                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Depth bands and named regions | A lens that outlines named horizontal bands or rectangles ("Earth factory", "transition", "overgrowth") with their names, and a jump list to each. The samples propose a `region x= y= art=` word; until the dialect has it, the regions live in the level's `<level>.studio.json` as an editor aid (**inferred**) | Proposed                   |
| Overlay planes as layers      | The Layers panel (D71) lists a Fizz 1 level's script sections with an eye and a padlock, and says a Fizz 2 level has no layers yet. A Fizz 2 level's rows would be the map, the front plane, the fade rooms, and the objects, with the same hide (view only) and lock (by effect) rules                            | Proposed; extends D71      |
| Painting a plane              | The Paint tool paints the plane chosen in Layers; the front plane is drawn over the map at a set opacity in the flat view, and in the Game view as the game draws it                                                                                                                                               | Proposed                   |
| Fade rooms                    | A Room tool for Fizz 2 levels (as Fizz 1's R) that drags a rectangle and fills its empty front-plane cells; a toggle shows the level as Ben sees it from outside and from inside each room                                                                                                                         | Proposed                   |
| Plane tabs                    | If planes come (Q44): a tab per plane above the canvas, the plane above or behind ghosted, and portal pairs drawn as links in the manner of the overworld's Links lens ([EDITOR.md](../spec/EDITOR.md#6-lenses) section 6)                                                                                         | Contingent on Q44          |
| Size                          | The byte budget of [section 3](#3-size), shown in the New level dialog, Resize, and the Budget window; the 128-row cap goes                                                                                                                                                                                        | Proposed                   |
| Head room                     | Maze corridors are where head room matters: the Head room lens (W105) compares today's 0.7 × 1.4 body and the trial's 0.8 × 2.0 (Q19)                                                                                                                                                                              | Planned (Studio M2)        |
| Reach and Checks              | [Section 4](#4-solvability)                                                                                                                                                                                                                                                                                        | Proposed; needs F6 and F25 |

## 6. Proposed schedule

Proposed, awaiting the owner. The Fizz 2 milestones are those of its `tools/progress-report/roadmap.json`; the Studio milestones are those of [ROADMAP.md](ROADMAP.md). The reasoning is in dependencies: the cheapest time to add a plane count or a front plane to `LEVL` 2 is before the Fizz 2 content pipeline (M2: `fizz-bake`, the pack loaders) reads and writes it everywhere, and before the studio's dialect work (Studio M2) builds the `map` block.

**Is the format still open? Yes (verified).** `LEVL` 2 is specified (Fizz 2 #149) and written and read (#167), and it already carries states, bindings, rules, strings, and light objects. But the gadget, built-in enemy, custom enemy, and custom item kinds (5, 7, 9, 10) and the platform and panel bindings (3, 4) are reserved, the rule phase refuses every input and action it has not built, `fizz-script` reserves lights, switches, platforms, and `world`, `fizz-bake` and the pack loaders do not exist, and `docs/FAP.md` lists seven open points for version 2. Header bytes 28 to 31 are reserved, zero (**verified**); whether a plane count could use them without a new section version is the Fizz 2 repository's choice (**inferred**).

| Piece                                                         | Decide by                                                              | Fizz 2 milestone                                           | Studio milestone                                                                   | Depends on                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------- |
| The principle, continuous picture as the baseline (D73)       | Now                                                                    | —                                                          | M0 docs (this note, D73)                                                           | —                             |
| Planes or not (Q44); F27 and F26 if yes                       | **Before Fizz 2 M2's `fizz-bake` and pack loaders**                    | M2 content pipeline (F27); M3 camera cut and M3.5 (F26)    | M2 (`map NAME` in the dialect, plane tabs)                                         | F1, F10                       |
| Overlay representation (Q45): front plane and fade rooms, F28 | **Before Fizz 2 M2's `fizz-bake`, and before Studio M2's `map` block** | M2 (the bytes); M3 scene intent (the draw order, the fade) | M2 (painting a plane, Layers rows); M5 (the Game view draws them)                  | F10, F13, F5                  |
| Cutaway or hidden underground (Q48)                           | Before Fizz 2 M3 scene intent                                          | M3 scene and camera                                        | M5 Game view                                                                       | Q45                           |
| Size policy (Q46): byte budget, caps lifted                   | **Before Studio M2**                                                   | —                                                          | M2 (New level, Resize, the size meter in the Budget window)                        | F2 (the limit in the profile) |
| Mechanics roster as level data (F24)                          | With Fizz 2's `docs/CLIMBING.md` questions                             | M3.5 mechanics roster                                      | M2 for legend letters as they reach the profile; M3 for lift and platform bindings | F2, F11                       |
| Solvability check (F25)                                       | Rules and severities (Q47) before F25 is built                         | After M3.5 (needs climbing); a gate in M5 CI gates         | M3 (Checks window, Reach lens through the game host)                               | F6, F24                       |
| Depth bands and named regions                                 | —                                                                      | —                                                          | M2 (a lens, in the level's studio sidecar)                                         | —                             |
| Cost meters for planes and fades                              | —                                                                      | M5 CI and the 486 budget                                   | M5 (with the light and panel meters)                                               | F22                           |
| Fizz 1 flats, facades, and wall-bg                            | Nothing to decide                                                      | —                                                          | M10 Fizz 1 level editing (the Room tool, `room`, `secret-room`, `wall-behind`)     | —                             |
| Data plane (Q49)                                              | Can wait                                                               | Not scheduled                                              | Not scheduled                                                                      | —                             |

**The earliest blockers**, in order:

1. **Q44 (planes now or not)** and **Q45 (how overlays are stored)** block Fizz 2 M2's baker and loaders and Studio M2's dialect work: each is cheap before them and a format change after.
2. **Q46 (size policy)** blocks Studio M2's New level and Budget window work.
3. **Q48 (cutaway or hidden)** blocks Fizz 2 M3's scene intent.

**These can wait:** Q47 (solvability severities and gates) until F25 is designed, after Fizz 2 M3.5; Q49 (the data plane) until the owner takes it up.

## 7. Open questions for the owner

Each is in [QUESTIONS.md](QUESTIONS.md) with its number.

| #   | Question                                                                                                                       | Recommendation                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q44 | Continuous picture only for now, or planes in `LEVL` 2 now while the format is still being filled in?                          | Continuous picture now, and ask the Fizz 2 repository to reserve room for planes (a plane count that must be 1, in a reserved header byte) so that planes can follow without a new section version. Both samples and the Keen maps they cite need nothing more; a reserved field is free today and dear later                                                                                          |
| Q45 | How are overlays represented: a second tile plane in `LEVL`, per-cell flags, a section of rectangles, or objects? Fizz 2 only? | One optional front plane of `w * h` tile ids drawn after the actors, plus a list of fade-room rectangles (F28); the back plane stays the map's `w` cells. Flags cannot hold art, objects cannot hold a rectangle's art, and Fizz 1's facade-in-empty-cells cannot cover a tile. Fizz 2 (and later episodes) only; Fizz 1 keeps its own rooms, and a Fizz 1 export drops the front plane with a warning |
| Q46 | The size policy: raise 1024 × 128, or make the limit bytes?                                                                    | Bytes: the profile's section limit, shown by a meter, with a warning at 75%; lift the 128-row cap once the canvas has been measured on a large map                                                                                                                                                                                                                                                     |
| Q47 | Which solvability rules are errors, and which become gates?                                                                    | Errors S1, S2, S4, S5, S8, S9 (they stop Build world, not saving); a Fizz 2 `bake check` gate on S1 and S2 only, at first; the rest as warnings                                                                                                                                                                                                                                                        |
| Q48 | Is an underground a cutaway (seen from the surface) or hidden until entered (a fade room over it)?                             | Both, per level: a cutaway is the plain map, and hidden is a fade room over the band. The engine needs only F28; the choice is the level designer's                                                                                                                                                                                                                                                    |
| Q49 | The data plane (triggers, spawns, secrets, route hints, one-way marks): pursue it?                                             | Keep it as an idea. Record what the samples' bot needed (enemy-carried keys, hook points, secrets, waypoints, and one-way marks) so the idea has its uses listed when it is taken up                                                                                                                                                                                                                   |
