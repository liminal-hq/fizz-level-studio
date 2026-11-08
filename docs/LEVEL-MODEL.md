# The level model: continuous pictures, overlays, and planes

A design note for what a Fizz 2 level can be in the studio. **Nothing in it is built.** The owner's direction and answers of 2026-11-07 are recorded as decision D73 in [DECISIONS.md](DECISIONS.md): planes and overlay layers go into `LEVL` 2 now, the size limit is a byte budget, and buildings fade while caves are cutaways. The answered questions are Q44, Q45, Q46, and Q48; Q47 and Q49 stay open, and Q50 to Q52 are new and proposed ([QUESTIONS.md](QUESTIONS.md)). The format is the Fizz 2 repository's to adopt: the studio asks for it through the change requests F26 to F28 in [ENGINE-CHANGES.md](ENGINE-CHANGES.md#fizz-2-planned), and F24 and F25 stay proposed.

Each claim is marked **verified** (read in the source named beside it) or **inferred** (reasoned from those sources, not checked against running code). The sources are this repository, the Fizz 2 repository (`~/source/experiments/fizz-2`, read on `origin/main` at `46afd6c`), the Fizz 1 game (`liminal-hq/lieutenant-fizz`, read on its checkout's branch `chore/google-play-deploy`), and the owner's design artefact "Fizz 2 levels, mazes and palette" (27 boards; the two sample levels, the maze concepts, and the solvability rules).

## Contents

- [Decided 2026-11-07](#decided-2026-11-07)
- [1. The principle](#1-the-principle)
- [2. The three concepts](#2-the-three-concepts)
- [3. Size](#3-size)
- [4. Solvability](#4-solvability)
- [5. What it means for the editor](#5-what-it-means-for-the-editor)
- [6. Schedule](#6-schedule)
- [7. Questions: answered and open](#7-questions-answered-and-open)

## Decided 2026-11-07

The owner answered four of the six questions on 2026-11-07. Each answer is the studio's direction and what the studio asks the Fizz 2 repository for; the bytes are the Fizz 2 repository's to specify in its `docs/FAP.md`, so every layout below is a request until it does.

| Question                                | The owner's answer                                                                                                    | Where                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Q44: a continuous picture, or planes?   | "Planes in the format now as well as the different layers for fading": planes and overlay layers go into `LEVL` 2 now | [2.3](#23-planes), [2.4](#24-the-format-in-levl-2)                    |
| Q45: how overlays are stored            | Accepted the recommended design: one level-wide grid, three header counts, three tables after the tiles, dense layers | [2.4](#24-the-format-in-levl-2)                                       |
| Q46: size as a byte budget              | Accepted the proposed defaults: the whole decoded section against the profile's limit, the meter, the presets         | [3](#3-size); the numbers are firmed up by measuring before Studio M2 |
| Q48: cutaway or hidden until entered    | Accepted the default rule: buildings, back rooms, and secret rooms fade; caves and underground are cutaways           | [2.5](#25-cutaway-or-hidden-q48)                                      |
| Q47: solvability errors and gates       | **Open**; can wait until F25 is designed                                                                              | [4](#4-solvability)                                                   |
| Q49: the data plane                     | **Open**; an idea, not scheduled                                                                                      | [2](#2-the-three-concepts)                                            |
| Q50 to Q52: dormancy, respawn, the fade | **New, proposed**, with the research's recommendations                                                                | [7](#7-questions-answered-and-open)                                   |

**Deferred by the same answers:** sparse storage of a layer, decals drawn from backdrop art, a flood-fill helper in the studio's Room tool, parallax on a layer, and the data plane. **Still to measure before Studio M2:** the compressed sizes of the real levels, the memory a 96 KB level uses on DOS, and the canvas's speed at about 90,000 cells ([section 3](#3-size)).

## 1. The principle

The level editor is a general tile-map editor that makes maps. An underground, a tower, a cave maze, a set of rooms, or a surface run over deep bands are all shapes of the same thing: a grid of tiles with objects, states, and rules on it. The editor handles every one of them without a mode or a level type for each (owner, 2026-11-07).

The owner's two sample levels already work this way (**verified**, the samples artefact):

| Sample           | Size (tiles) | What it is                                                                                                                                                                                                            |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse Point | 64 × 80      | An overworld night coast: a seven-floor tower (F0 to F6) climbed by ladders, a lift, and the grapple, with one-way falls of 8 and 9 rows to the jetty. One grid in which "y grows upwards, row 0 at the bottom".      |
| Siphon Works     | 96 × 76      | The underworld under the cocoa factory: Earth factory at the top (rows 46 and up), a stained transition (37 to 45), and Zarg overgrowth below. A hub and three spokes, a drop maze, and a secret office, in one grid. |

Every link between depths in the samples is a ladder, a drop hole, a balcony fall, or the grapple; there are no portals or doors to other spaces. The samples cite Keen 4 to 6 maps that "keep sky and depth in one frame" (K4-005, K4-003, K6-017).

## 2. The three concepts

The owner named three ways to build a back room or another space, and wants the editor to handle all of them:

| Concept                | What it is                                                                                                                                                                  | Status                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Continuous picture** | The level is one map, one picture; rooms and depths are places in it, reached by walking, climbing, or falling                                                              | The baseline (owner, 2026-11-07)                                                             |
| **Overlays**           | Art on its own layer over or under the map: (1) **draw layers** in front of or behind Ben, and (2) **rooms that fade** while Ben is inside, so the picture stays continuous | **Decided** (Q44, Q45): dense front and back layers and fade-room rectangles in `LEVL` 2 now |
| **Planes**             | Separate maps inside one level, joined by portals: walking through one takes Ben to a back room or another plane                                                            | **Decided** (Q44, Q45): up to 8 planes on one level-wide grid, in `LEVL` 2 now               |
| _Data plane_ (an idea) | A plane over the map that holds data, not art: triggers, spawn points, secrets, route hints, one-way marks (as Keen's info plane)                                           | **An idea, not a decision and not scheduled** ("haven't gotten there yet"; Q49 open)         |

### 2.1 Continuous picture

| Layer                   | Today                                                                                                                                                                                                                                  | What would have to grow                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LEVL` 2 (Fizz 2)       | One tile plane: `w` and `h` are each `u16` (at least 1), then `w * h` tile ids of one byte each, row 0 at the bottom; one spawn; states, bindings, objects, rules, and strings (**verified**, Fizz 2 `docs/FAP.md` "`LEVL`")           | Nothing for the shape. The mechanics that link depths (ladders, vines, lifts, the mantle) are not built (F24)                                                                  |
| `script fizz2 0`        | One `map` block, exactly `h` rows of `w` characters, one `start` (**verified**, [LANGUAGE.md](../spec/LANGUAGE.md#the-map-block)); ladders, vines, lifts, and rooms are Absent, E102 (**verified**, the capability matrix)             | Legend letters for the climbing tiles and objects for lifts, as rows in the profile's tables, never grammar (D35)                                                              |
| Studio                  | The canvas scrolls on both axes over one grid (`apps/studio/src/canvas/viewport.ts`); New level caps a level at 8 to 1024 wide and 8 to 128 high (`crates/fizz-studio-level/src/new.rs`, `WIDTH_RANGE`, `HEIGHT_RANGE`) (**verified**) | The caps are replaced by the byte budget of [section 3](#3-size) (decided; planned for Studio M2, not built); a depth band lens ([section 5](#5-what-it-means-for-the-editor)) |
| Change requests touched | F10 (`LEVL` 2), F11 (states and rules), F13 and D45 (the oblique look), F2 (legend letters in the content export), F6 (the step API for checks)                                                                                        | F24 (mechanics roster), F25 (solvability)                                                                                                                                      |

The Fizz 2 repository is already asking the question this note answers: "Does the level script language need extensions for vertical mazes, gadgets and the underworld?" (**verified**, Fizz 2 `docs/ARCHITECTURE.md`, open questions), and its proof of concept wants "a graph of data-driven levels with transitions" and "mazes and puzzles that climb and descend" (**verified**, `docs/POC-1-FINDINGS.md`).

### 2.2 Overlays

**What Fizz 1 does today (verified, `lieutenant-fizz`, `episodes/episode-1/game/src/`):**

- **Facade (painted flats).** `room(x0, y0, x1, y1)` in `levels.rs` (line 510) turns every empty cell of the rectangle into the tile `FACADE` (31) and records the rectangle in the level's `rooms` list: Fizz 1's rooms are **rectangles, not flood fills**. `secret_room` marks one as the secret, which sets the secret-found bit when Ben walks in. `tick_rooms` in `world.rs` moves each room's `room_alpha` towards `ROOM_SEEN_ALPHA` (0.22) while Ben's body overlaps it, and **things inside stay put while `room_alpha` is over `ROOM_DORMANT_ALPHA` (0.95)**, so in Fizz 1 the fade affects the simulation. `render.rs` draws the flats after Ben, and over murals in a room. Bonbon Playhouse is "a candy playhouse whose backstage rooms are hidden behind painted flats".
- **Wall-bg.** `wall_behind` paints `WALLBG` (30), a non-solid interior back wall, into empty cells.
- **In the studio's Fizz 1 language** these are `room`, `secret-room`, and `wall-behind` statements, and the Room tool (R) drags a rectangle whose facade fills its empty cells ([EDITOR.md](../spec/EDITOR.md#3-tools-and-keys) section 3, built in the prototype; Studio M10 for the real app).
- **Use in the fixtures** (**verified**, `fixtures/fizz1/levels/real-*.fizz`): only Bonbon Playhouse (4 rooms) and Sugar-Glass Gallery (5) use rooms, and none of the 16 real levels uses `wall-behind`. Bonbon's rooms are 12 to 14 × 6 cells.

So Fizz 1 keeps both kinds of overlay in its one tile plane, as tile ids, plus a list of rectangles. A cell holds a facade or a tile, never both.

**What Fizz 2 has today (verified):** `WALLBG` (30) is the legend letter `w`, "interior wall behind the rooms; not solid" (Fizz 2 `docs/SCRIPT.md`). The slice's draw order is ground and sky, night dressing, items, chickens, shots, puffs, `draw_ben`, then the light pass (`crates/fizz-slice-view/src/lib.rs`, the render function); the oblique draw order (`docs/OBLIQUE.md`) puts the background, the far-plane decoration, and the terrain before the actors. There is no facade tile and no front layer, and nothing is drawn after Ben except the light pass. The per-cell "door overlay" of Fizz 2 `docs/RULES.md` is an unrelated derived byte.

**Decided (Q45, 2026-11-07):**

| Kind of overlay                                  | How it is stored                                                                                                                                                           | Drawn                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Front layer** (trim, facades, building fronts) | A dense layer of non-solid tile ids, one byte a cell, over one plane                                                                                                       | After Ben (`draw_ben`) and before the light pass, so a night cover stays dark (**inferred**) |
| **Back layer** (back walls under ledges)         | The same record with the kind "back"                                                                                                                                       | After the background, before the terrain                                                     |
| **Rooms that fade**                              | A 16-byte rectangle record (Fizz 1's model): the rectangle, the layer it fades, `STAY` and `DORMANT` flags, the fade ticks, the seen level, and an optional state and mask | The room's front cells step towards the seen level while Ben is inside                       |
| **A map tile that draws over Ben**               | A tile property only (as Keen's tileinfo FRONT bit): for a map tile such as the front of a pillar, not a cover over another tile                                           | After Ben                                                                                    |

A secret room is a fade room with an `enter` rule on the same rectangle (the `enter` input is built, `docs/RULES.md`). Because `DORMANT` changes what the simulation does, the fade is kept in the sim, not the presenter: an inside bit and a `u8` counter per room, hashed only when the level has rooms, so every existing proof is unchanged (**inferred**; this replaces the earlier proposal to keep the fade outside the state hash). Fade rooms are a Fizz 2 mechanic specified by the Fizz 2 repository, as ladders are in `docs/CLIMBING.md`, not Fizz 1's carried in, so D49's non-goal is not touched; a Fizz 1 export drops the layers and rooms with a warning.

**How each is written and edited (proposed, Studio M2):**

- **Script.** A `front` block (one character a cell, `.` for none) or `paint front`, and `fade room x=45..56 y=10..15 cover=F [secret] [stay] [dormant] [open-when=STATE:VALUES]`, where the `cover=` letter fills the room's empty front cells exactly as Fizz 1's `room()` does. These are new grammar, so they need a new dialect version (D35).
- **Fizz 1 import.** `room` and `secret-room` become a fade room plus `FACADE` cells in the front layer; `secret` becomes an `enter` rule; `wall-behind` becomes `w` (`WALLBG` 30, already in Fizz 2).
- **Studio.** The Layers panel (D71) gains rows for Map, Front, Back, Rooms, and Objects, with the same eye (hides the view only) and padlock (locks by effect). Paint paints the selected layer. The front layer is drawn at a set opacity in the flat view.
- **Lenses.** Reach ignores overlays, because an overlay is never solid. The Budget window shows each layer as its own part of the size bar.

### 2.3 Planes

A plane is a second map in the same level: a back room, a basement, or another dimension reached through a portal, with the camera cutting to it.

**Decided (Q44 and Q45, 2026-11-07): planes on one level-wide grid.** Plane 0 is the map in the header, at (0, 0). An extra plane is a rectangle placed somewhere else on the same `u16` grid. Every coordinate in the level (the spawn, objects, binding and rule rectangles, raised events) is a level coordinate, and the plane is whichever rectangle the point falls in. So:

- **No record changes.** The object, rule, and binding records keep their bytes; none gains a plane field.
- **The spawn's plane follows from its position**, and so does the plane Ben is on in the sim: nothing new goes into the state hash for planes.
- **The solver needs no new state.** Cells are already unique across planes; a portal is just an edge ([section 4](#4-solvability)).
- **The cost:** all planes together must fit the `u16` grid, and may not overlap.

| Layer    | Today (**verified**, `docs/FAP.md`, `docs/RULES.md`)                                                                                                                                                                      | What grows (decided; requested as F26 and F27)                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEVL` 2 | One tile plane and one spawn. The rule actions are ops 1 to 9 (`set`, `toggle`, `next`, `spend`, `give`, `score`, `ammo`, `word`, `cue`); none moves Ben. Object kinds 1 to 10 are numbered and kinds over 10 are refused | Header byte 28 counts the extra planes; an 8-byte record places each; its tiles follow the main tiles (F27). A portal is object kind 11, with op 10 `move` reserved for teleports a rule triggers (F26) |
| Camera   | Fizz 1's camera with Tower mode is planned for Fizz 2 M3 (`roadmap.json`, `cam-fizz1`)                                                                                                                                    | The camera clamps to the plane Ben is in, and a portal cuts, fades, or slides it (**inferred**; Fizz 2 M3)                                                                                              |
| Dialect  | One `map` block per level                                                                                                                                                                                                 | `plane NAME at=X,Y` with its own `map` block, and a portal statement: new grammar, so a new dialect version (D35)                                                                                       |
| Studio   | One grid per level                                                                                                                                                                                                        | Plane tabs, the other planes ghosted, and portal pairs drawn as links ([section 5](#5-what-it-means-for-the-editor))                                                                                    |

**What carries across planes.** Everything: it is one level with one state table, so keys, switches, and states hold, and Q27 (world-scoped states) is not involved. A death resets the level and Ben respawns at the level's spawn (D33) until checkpoints are designed; whether that holds when he died on another plane is Q51.

### 2.4 The format in LEVL 2

What the studio asks the Fizz 2 repository for (F26 to F28). The header facts are **verified** against Fizz 2 `docs/FAP.md` "`LEVL`" and `crates/fizz-pack/src/level.rs` on `origin/main` at `46afd6c`: bytes 28 to 31 are "Reserved, zero", and `LevelView::new` refuses any non-zero byte there (`data[28..32]`, `BadField`); the reader accepts section version 2 only (`BadVersion`); the decoded length must equal the length formula exactly; the order is header, name, states, bindings, objects, rules, strings, then the tiles; object kinds over 10 and action ops over 9 are refused. The new fields are the request, not the format.

**The header's reserved bytes:**

| Byte | Today (**verified**) | Requested field                                                                    | Zero means          |
| ---- | -------------------- | ---------------------------------------------------------------------------------- | ------------------- |
| 28   | Reserved, zero       | `extra_planes`, `u8`, at most 7 (8 planes in all)                                  | One plane, as today |
| 29   | Reserved, zero       | `layer_count`, `u8`, at most 8                                                     | No overlay layers   |
| 30   | Reserved, zero       | `room_count`, `u8`, at most 32 (one inside bit each in a `u32`, as the rules have) | No fade rooms       |
| 31   | Reserved, zero       | Reserved, zero                                                                     | —                   |

**After the main tiles, in this order:**

| #   | Part          | Size                 | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Plane records | 8 bytes each         | `x0`, `y0`, `w`, `h` as `u16`: inside the `u16` grid, overlapping neither plane 0 nor another plane                                                                                                                                                                                                                                                                                                                                                                                     |
| 2   | Layer records | 8 bytes each         | 0 `plane`; 1 `kind` (1 front, 2 back); 2 `flags` (bit 0 `SPARSE`, reserved); 3 to 7 reserved (parallax, and a state and mask that show the layer, later)                                                                                                                                                                                                                                                                                                                                |
| 3   | Room records  | 16 bytes each        | 0 to 7 the rectangle `x0 y0 x1 y1` as `u16`, inside one plane; 8 `layer` (0xFF for every front layer of the plane); 9 `flags` (bit 0 `STAY` once revealed, bit 1 `DORMANT` (things inside wait), bit 2 `CUTAWAY_PREVIEW`, the rest reserved); 10 `fade_ticks` (default 26, about Fizz 1's 0.43 s); 11 `seen` (0 to 3, the dither step while inside; Fizz 1's 0.22 is about step 3); 12 `state` (0xFF for none); 13 `mask` (revealed while the state is in the mask); 14 and 15 reserved |
| 4   | Plane tiles   | Each plane's `w * h` | In plane order                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 5   | Layer tiles   | Its plane's `w * h`  | In layer order; non-solid tile ids only (checked in `fizz-ep2`), 0 for none                                                                                                                                                                                                                                                                                                                                                                                                             |

**The length formula** gains `+ 8 × extra_planes + 8 × layer_count + 16 × room_count + Σ plane areas + Σ layer areas`, and every new term is zero for today's levels. **The section version stays 2**, and a level with all three counts zero is byte-identical to today's, so the slice's `LEVL` bytes, their FNV 0x5D520A47, and their digest 0x1AC799A4B63D632D stay, as does the golden `FINAL TICK 1800 HASH ec9195c222b626f2`, provided the new parts are appended to the digest and the room block to the state hash only when their counts are not zero, the rule `docs/RULES.md` section 11 already uses for states (the pinned values are **verified**; that they stay is **inferred**). `LEVEL_HASH` (0x46FA651A), `SCHEMA_HASH` (0xA1BB8460), and the compatibility number (0x6365509C) move once, as planned, because new limits and kinds are fed in and `pack_content()` gains a `FACADE` tile id; that means updating `levl_hash.py` and `tools/levl2-slice.py`, re-pinning the hash tests, and changing every manifest's `abi` line (the Fizz 2 repository's work).

**Portals (F26).** Object kind 11 `portal`: `sub` is the transition (0 cut, 1 fade, 2 slide); `flags` are `USE` (Up, as at a switch), `TOUCH`, and `ONE_WAY`; `aux` is the index of the paired portal. Op 10 `move` (the action's existing `x` and `y` cell) is reserved for teleports a rule triggers. A pair of portals is an edge for the solver; `ONE_WAY` puts it in S6's list, and S2 catches a plane that can be entered but not left.

**DOS memory (inferred).** An extra plane costs its area twice, once in the `TileMap` and once in the door overlay (`docs/RULES.md` section 3); a layer costs its area once. A level that fills the 96 KB limit keeps about 180 KB resident and briefly about 300 KB while it decodes, against about 2 MB free on the floor machine. To be measured ([section 3](#3-size)).

**Worked example: a Bonbon Playhouse room (illustrative of the bytes).** Bonbon is 170 × 30 with four rooms; its first is `room x=45..56 y=10..15` (**verified**, `fixtures/fizz1/levels/real-bonbon-playhouse.fizz`), carried here in the Fizz 1 script's coordinates.

| Part        | Bytes                                                         | Meaning                                                                               |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Script      | `fade room x=45..56 y=10..15 cover=F dormant`                 | The dialect's proposed statement                                                      |
| Header      | 28 = `00`, 29 = `01`, 30 = `04`                               | No extra plane, one layer, four rooms                                                 |
| Layer 0     | `00 01 00 00 00 00 00 00`                                     | Plane 0, front, no flags                                                              |
| Room 0      | `2D 00 0A 00 38 00 0F 00` `FF` `02` `1A` `03` `FF 00` `00 00` | x 45 to 56, y 10 to 15; every front layer; `DORMANT`; 26 ticks; seen step 3; no state |
| Front tiles | `F` in each of the rectangle's (at most 72) empty cells       | The painted flat                                                                      |
| Size        | 5,100 + 8 + 4 × 16 = **5,172 bytes** decoded more             | The layer, its record, and the four rooms                                             |

**Worked example: Siphon Works' office (illustrative; the sample does not give the rectangle).** The secret is "Mildred's office", in the deck ceiling, reached by the grapple (**verified**, the samples artefact). Written `fade room x=40..49 y=58..62 cover=K secret stay` plus `on enter x=40..49 y=58..62 do word "Mildred's office"`; the ceiling's cracked tiles stay map tiles. The front layer adds 7,296 bytes, for about 14.6 KB of the 96 KB (15%).

### 2.5 Cutaway or hidden (Q48)

**Decided (Q48, 2026-11-07), the default rule:**

| Region                                           | Default                           | Why                                                                                                                                                                        |
| ------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Building interiors, back rooms, and secret rooms | **Fade**: hidden until entered    | Fizz 1's rooms are one screen or less (12 to 14 × 6), and all are buildings or backstage (the sizes **verified**, the fixtures)                                            |
| Caves and underground                            | **Cutaway**: visible in one frame | Keen's K4-003, K4-005, and K6-017 show sky and depth together; the oblique ground already darkens rock away from an opening; a cutaway costs nothing on DOS (**inferred**) |

- **The switch per region is the fade room itself:** a fade room over a band hides it, `stay` keeps it open once found, and `dormant` holds what is inside.
- **The solver is the same either way:** covers are never solid, S4 handles secrets, and `dormant` concerns only enemies, which the solver ignores.
- **Studio lint:** a fade room larger than the DOS view (20 × 12.5 tiles) is warned about, because a long dark cover hides the play.
- **Preview:** a switch offers "see everything", "as the player sees it", and "inside room N"; the Game view (Studio M5) draws the dither steps as DOS does (the DOS fade is Q52).

## 3. Size

**The facts (verified):**

- `w` and `h` in `LEVL` 2 are each `u16`, so the format allows up to 65,535 × 65,535. The decoded length today is `32 + pad8(name_len) + 8 × states + 16 × bindings + 32 × (objects + strings) + 48 × rules + w × h` (Fizz 2 `docs/FAP.md`, "Length"). Tiles are one byte each. The object count is a `u16`.
- The **96 KB** per-section limit is a policy default, not a format limit: `pub const SECTION_LIMIT: u32 = 96 * 1024;` in `crates/fizz-pack/src/pack.rs`, an owner decision of 2026-10-29 written for audio sections; "the baker takes the limit as a parameter", and a section over it is an error at bake time (`docs/FAP.md`, "Limit").
- The studio's 1024 × 128 creation caps are the studio's own choice (`crates/fizz-studio-level/src/new.rs`), still in the code; the byte budget below replaces them in Studio M2.
- The DOS floor is "a 4 MB machine with about 2 MB free" (DOSBox reads about 2,256 KB free at `memsize` 4); a decoded section, its stored bytes while decoding, and the decoder's tables must all fit; the tiles are copied into the `TileMap` and the section buffer is then freed (`docs/FAP.md`, "Memory limits"). The floppy budget is a provisional `BUDGET 1100000` bytes for `FIZZ2.EXE` and the packs together, "a tracked metric, not a design limit" (`docs/PLATFORM.md`), with `FIZZ2.EXE` at 374,272 bytes.

**Decided (Q46, 2026-11-07): the byte budget.** The numbers are the accepted defaults, to be firmed up by the measurements below before Studio M2.

| Item                   | Decided default                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The budget             | The level's whole decoded size (every plane, layer, and table, in its one `LEVL` section) against the profile's per-section limit: `SECTION_LIMIT`, 96 KB (98,304 bytes) by default. The baker takes the limit as a parameter, and it need not rise for levels. The studio reads it from the profile and never hard-codes 96 KB |
| Size meter             | Information at 32 KB (32,768 bytes); a warning at 75% (73,728); an error over 100%, which stops Build world and matches the bake error. An estimate until `fizz-bake` reports the real figure (G-TRUST-4)                                                                                                                       |
| New level and Resize   | Any `w` and `h` that fit, with a live readout of the bytes and the percentage: for one plane, cells × (1 + layers) + tables                                                                                                                                                                                                     |
| Presets                | **Run 192 × 28** (5,376 cells, the default), **Cave 96 × 76** (7,296), **Tower 64 × 160** (10,240), **Deep 128 × 160** (20,480), **Wide 256 × 64** (16,384)                                                                                                                                                                     |
| Planes, layers, rooms  | Each extra plane and each layer counts its full area; each room record counts 16 bytes, each plane and layer record 8                                                                                                                                                                                                           |
| The 1024 × 128 maximum | Goes: at 131,072 tile bytes it was already over 96 KB. With full tables and 100 objects one plane fits about 91,000 cells (1024 × 89, 301 × 301, or 64 × 1,424); one front layer halves that                                                                                                                                    |

**Worked numbers (arithmetic on the length formula):**

| Case                                            | Tiles and layers (bytes) | `LEVL` with full tables and 100 objects | Share of 96 KB (98,304)   |
| ----------------------------------------------- | ------------------------ | --------------------------------------- | ------------------------- |
| Run, 192 × 28 (`docs/FAP.md` says "about 6 KB") | 5,376                    | 12,496                                  | 13%                       |
| Lighthouse Point, 64 × 80                       | 5,120                    | 12,240                                  | 12%                       |
| Siphon Works, 96 × 76                           | 7,296                    | 14,416                                  | 15%                       |
| Siphon Works with a front layer                 | 14,592                   | 21,720                                  | 22%                       |
| Deep, 128 × 160, with a front layer             | 40,960                   | 48,088                                  | 49%                       |
| Today's largest new level, 1024 × 128           | 131,072                  | 138,192                                 | **141%: refused at bake** |

"Full tables" is every count at its limit: a 48-byte name, 32 states (256 bytes), 64 bindings (1,024), 32 rules (1,536), and 32 strings (1,024), 3,920 bytes with the header; 100 objects add 3,200. A layer row adds its 8-byte record.

**Why these numbers (inferred).** Packs and music have 1,100,000 − 374,272 = 725,728 bytes of the floppy. If Fizz 2 has 24 to 30 levels and levels take about 15% of that, a level has about 4 KB stored, which at an assumed deflate ratio of 15% to 25% for tile maps is about 16 to 27 KB decoded on average. So the floppy limits the average level, and the section limit the largest one. A second meter, the estimated stored bytes against a per-world share of the floppy, comes once `fizz-bake` reports real figures.

**Still to measure, before Studio M2 (a follow-up, not done):**

| #   | Measurement                                                                                                                                                       | Firms up                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Compressed sizes of the real levels: the 16 Fizz 1 fixtures and both samples baked as `LEVL` at deflate level 9, stored ÷ decoded, with and without a front layer | The deflate ratio, and the levels' floppy share    |
| 2   | The totals for music, sprites, and backdrops                                                                                                                      | The levels' share of the floppy                    |
| 3   | The memory a 96 KB level uses on DOS: the `HEAP` line after loading one on DOSBox at `memsize` 4                                                                  | The 180 KB and 300 KB estimates                    |
| 4   | The canvas's frame time at about 90,000 cells (R-PERF-01 is measured on Marshmallow Meadows, 220 × 32)                                                            | Whether the canvas keeps up with the largest level |
| 5   | The `/BENCH` cost of a front pass under a cover that fills the screen, solid and dithered                                                                         | The draw cost of a large fade room                 |

The first three are measurements in the Fizz 2 repository's tools, asked of it; the fourth is the studio's.

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

**Planes in the search (inferred).** On the level-wide grid every cell is already unique, so the search state stays (cell, keys, states) with no plane index. A portal is an edge from its cell to its pair's, taken with Up when it has `USE`. S2 then covers a plane that can be entered and not left, and S6 lists a one-way portal as it lists a one-way fall. A fade room changes nothing in the search: covers are never solid, and `dormant` concerns only enemies.

## 5. What it means for the editor

| Area                          | Proposal                                                                                                                                                                                                                                                                                                           | Status                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Size                          | The byte budget of [section 3](#3-size), shown in the New level dialog (with the presets), Resize, and the Budget window; the 1024 × 128 caps go                                                                                                                                                                   | Decided (Q46); Studio M2; numbers to measure |
| Overlay layers as layers      | The Layers panel (D71) lists a Fizz 1 level's script sections with an eye and a padlock, and says a Fizz 2 level has no layers yet. A Fizz 2 level's rows become Map, Front, Back, Rooms, and Objects, with the same hide (view only) and lock (by effect) rules                                                   | Decided (Q45); Studio M2; extends D71        |
| Painting a layer              | The Paint tool paints the layer chosen in Layers; the front layer is drawn over the map at a set opacity in the flat view, and in the Game view as the game draws it                                                                                                                                               | Decided (Q45); Studio M2 and M5              |
| Fade rooms                    | A Room tool for Fizz 2 levels (as Fizz 1's R) that drags a rectangle and fills its empty front cells; the preview switch "see everything", "as the player sees it", and "inside room N"; a lint for a room larger than the DOS view. A flood-fill helper that writes a rectangle is deferred                       | Decided (Q45, Q48); Studio M2                |
| Plane tabs                    | A tab per plane above the canvas, the other planes ghosted, the planes placed on the level-wide grid, and portal pairs drawn as links in the manner of the overworld's Links lens ([EDITOR.md](../spec/EDITOR.md#6-lenses) section 6)                                                                              | Decided (Q44); Studio M2                     |
| Depth bands and named regions | A lens that outlines named horizontal bands or rectangles ("Earth factory", "transition", "overgrowth") with their names, and a jump list to each. The samples propose a `region x= y= art=` word; until the dialect has it, the regions live in the level's `<level>.studio.json` as an editor aid (**inferred**) | Proposed                                     |
| Head room                     | Maze corridors are where head room matters: the Head room lens (W105) compares today's 0.7 × 1.4 body and the trial's 0.8 × 2.0 (Q19)                                                                                                                                                                              | Planned (Studio M2)                          |
| Reach and Checks              | [Section 4](#4-solvability)                                                                                                                                                                                                                                                                                        | Proposed; needs F6 and F25; Q47 open         |

## 6. Schedule

The Fizz 2 milestones are those of its `tools/progress-report/roadmap.json`; the Studio milestones are those of [ROADMAP.md](ROADMAP.md). With planes and layers in the format now, the cheapest moment for the bytes is before the Fizz 2 content pipeline (M2: `fizz-bake`, the pack loaders) reads and writes `LEVL` 2 everywhere, and before the studio's dialect work (Studio M2) builds the `map` block. The **Status** column says what is decided and what is still to measure or answer; the Fizz 2 work is the Fizz 2 repository's to accept through F24 to F28.

| By                             | What                                                                                                                                                                                              | Status                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Before Fizz 2 M2's `fizz-bake` | Header bytes 28 to 30, the table order, the level-wide coordinates, the layer and room records, object kind 11 and op 10 reserved, and the `FACADE` tile id: one `LEVEL_HASH` change (F26 to F28) | Decided for the studio; requested of the Fizz 2 repository |
| Before Studio M2               | The measurements of [section 3](#3-size): compressed sizes of the real levels, DOS memory for a 96 KB level, the canvas at about 90,000 cells                                                     | **To measure**; the budget's numbers are firmed up then    |
| Studio M2                      | The dialect version with `fade room`, `front`, and `plane`; the size meter, New level with presets, and Resize; Layers rows, painting a layer, the Fizz 2 Room tool, plane tabs                   | Decided (Q44, Q45, Q46, Q48); planned, not built           |
| Fizz 2 M3                      | The draw order (front after Ben, back after the background), the DOS fade, the camera clamp per plane, and the portal cut                                                                         | Decided, except the DOS fade's method (Q52)                |
| Fizz 2 M3.5                    | Portal mechanics (F26) and the mechanics roster (F24)                                                                                                                                             | F26 decided as a request; F24 proposed                     |
| Studio M3                      | The Checks window and the Reach lens through the game host (F25)                                                                                                                                  | Proposed; severities open (Q47)                            |
| Studio M5                      | The Game view draws the layers, the fade, and the dither steps; cost meters for layers and fades (F22)                                                                                            | Decided (Q48); planned                                     |
| Studio M10                     | Fizz 1 flats, facades, and wall-bg: the Room tool, `room`, `secret-room`, `wall-behind`                                                                                                           | Nothing to decide                                          |
| Later                          | Q47 (with F25), Q49 (the data plane), sparse storage, decals from backdrop art, parallax on a layer, the flood-fill helper                                                                        | Open or deferred                                           |

**Is the format still open? Yes (verified).** `LEVL` 2 is specified (Fizz 2 #149) and written and read (#167), but the gadget, built-in enemy, custom enemy, and custom item kinds (5, 7, 9, 10) and the platform and panel bindings (3, 4) are reserved, `fizz-bake` and the pack loaders do not exist, and `docs/FAP.md` lists open points for version 2. Header bytes 28 to 31 are reserved, zero, so the request fits without a new section version.

## 7. Questions: answered and open

Each is in [QUESTIONS.md](QUESTIONS.md) with its number.

| #   | Question                                                                         | Status                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q44 | Continuous picture only, or planes in `LEVL` 2 now?                              | **Answered 2026-11-07:** "planes in the format now as well as the different layers for fading" ([2.3](#23-planes))                                                                                      |
| Q45 | How are overlays stored?                                                         | **Answered 2026-11-07:** the recommended design is accepted: one level-wide grid, header counts in bytes 28 to 30, plane, layer, and room tables after the tiles ([2.4](#24-the-format-in-levl-2))      |
| Q46 | Width and height caps, or bytes?                                                 | **Answered 2026-11-07:** bytes, with the proposed defaults accepted; the numbers are firmed up by measuring before Studio M2 ([section 3](#3-size))                                                     |
| Q47 | Which solvability rules are errors, and which become gates?                      | **Open**, can wait until F25 is designed. Recommended: errors S1, S2, S4, S5, S8, S9 (they stop Build world, not saving); a `bake check` gate on S1 and S2 only, at first                               |
| Q48 | Is an underground a cutaway, or hidden until entered?                            | **Answered 2026-11-07:** the default rule is accepted: interiors, back rooms, and secret rooms fade; caves and underground are cutaways; the fade room is the switch ([2.5](#25-cutaway-or-hidden-q48)) |
| Q49 | The data plane: pursue it?                                                       | **Open**, an idea. Recommended: record what the samples' bot needed (enemy-carried keys, hook points, secrets, waypoints, and one-way marks) so its uses are listed when it is taken up                 |
| Q50 | Carry Fizz 1's dormancy as a fade-room flag?                                     | **Proposed.** Recommended: yes, the `DORMANT` flag, on by default when a room holds enemies                                                                                                             |
| Q51 | After a death on another plane, does Ben respawn at the level's spawn?           | **Proposed.** Recommended: yes, at the spawn (D33) until checkpoints exist                                                                                                                              |
| Q52 | On DOS, does a fade step through 4 dither levels or blend through a shade table? | **Proposed.** Recommended: the 4-step dither; it is cheaper, and it follows the lights, which step between banks on DOS rather than fade (**verified**, `docs/RULES.md` section 14)                     |
