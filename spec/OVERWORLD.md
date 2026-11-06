# Overworlds

The overworld model, its script, the exporter and `OverworldBuilder`, unlock rules and the mask limit, several overworlds, level registration, sprites, the steps that make adding a level real, and what carries over to Fizz 2 and later episodes. The overworld designer is `ROADMAP.md` M9, after the Fizz 2 milestones. Sections 1 to 9 are about Lieutenant Fizz 1, the only game with an overworld today; section 10 covers Fizz 2 and later episodes.

## 1. The model in the game

`build_overworld()` in `episodes/episode-1/game/src/levels.rs` returns a `MapData`:

| Field    | Type            | Meaning                                                                                                            |
| -------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `map`    | `TileMap`       | The tiles, with `floor_solid = true`                                                                               |
| `points` | `Vec<MapPoint>` | The places on the map                                                                                              |
| `areas`  | `Vec<AreaRect>` | Rectangles that give a tile its area; the first match wins, and a tile no rectangle covers is `AREA_CRATER_FIELDS` |
| `start`  | `(f64, f64)`    | Where Ben stands when the map first opens                                                                          |

A `MapPoint` is `{ kind: PtKind, level: u8, x: f64, y: f64, to: usize, req: u16, big: bool, hidden: bool }`:

- `kind` is `Saucer`, `Level`, `Tele` or `Sign`.
- `level` is the level id for a `Level` (and `SAUCER` for the saucer), or the sign's text number for a `Sign` (the text lives in `SIGNS` in the shell).
- `to` is the index in `points` of a teleporter's partner.
- `req` is a mask of `level_bit(id) as u16` values that must all be cleared, plus `SECRET_FOUND` for the secret; 0 means no requirement.
- `big` draws the point larger; `hidden` keeps it off the map, and unreachable, until `req` is met.

An area decides the look and the scatter rates through `area_theme(area)`: tree and rock chances per free grass tile of 0.16 and 0.02 for Crater Fields, 0.14 and 0.03 for Marshmallow Meadows, 0.17 and 0.03 for Rock Candy Reach, 0.13 and 0.04 for Frosting Frontier, and none for Gumdrop Isle.

## 2. The script

An overworld script is told apart from a level script by its first statement (`isOverworld`). A file holds one overworld.

```ebnf
script     = { line } ;
header     = "overworld" '"' name '"' W "x" H "id=" NAME ;     (* first statement, once *)
start      = "start" NUM "," NUM ;                              (* required, once; fractions allowed *)
area       = "area" AREA "x=" RANGE "y=" RANGE ;                (* anywhere after the header; first match wins *)
section    = "blocks" | "points" | "edits" ;                    (* edits at most once, last *)

block-line = TILE "x=" RANGE "y=" RANGE                         (* any tile word except empty *)
           | "path" "from=" INT "," INT "to=" INT "," INT       (* a route, x first then y *)
           | "scatter" ;

point-line = "level" LEVELID "at=" NUM "," NUM [ "req=" REQLIST ] [ "big" ] [ "hidden" ]
           | "tele" NAME "at=" NUM "," NUM "with=" NAME [ "req=" REQLIST ] [ "hidden" ]
           | "saucer" "at=" NUM "," NUM
           | "sign" INT "at=" NUM "," NUM ;

REQLIST    = ( LEVELID | "secret" ) { "," ( LEVELID | "secret" ) } ;
```

Rules the grammar cannot show:

- `blocks` lines may not appear under `points` and the other way round (E008). The `edits` block takes both kinds. `paint` and `clear` are not overworld words (E001): write the tile word first, such as `river x=24..25 y=0..43`.
- `path` is also a tile word: `path x=.. y=..` fills path tiles, `path from=.. to=..` draws a route. The `from=` tells them apart. A route runs between whole tiles.
- A teleporter's name must be unique (E006), and `with=` must name a teleporter in the file (E002, reported after the whole file is read).
- `req=` names must be level ids or `secret` (E002). Coordinates must be inside the map (E013).
- The map must be at least 3 × 3 (E015).

What the parser does not check yet: that each level has one point, that pairs point both ways, that `hidden` comes with a `req`, that a sign number has text, that `req` does not name the point's own level, or that unlock rules have no cycle. These belong in an overworld check (`MCP.md`, `check_overworld`).

### Order and the scatter

Fills and routes run in file order; a later fill wins. `scatter` visits every tile with 2 ≤ x < w − 2 and 2 ≤ y < h − 2 that is grass at that moment, skips it if any point lies within 3 tiles on both axes (|dx| < 3 and |dy| < 3) or any of its eight neighbours or itself is a path tile, and otherwise rolls `q = hashf(x + 7919, y + 104729)`: a tree if `q` is below the area's tree rate, a rock if below the tree rate plus the rock rate. Points are collected before anything is drawn, so a scatter keeps clear of every point in the file whatever the order of the sections; it keeps clear only of paths drawn before it. Moving a point or a path therefore changes the trees near it and nowhere else.

### Example

From `overworlds/main.fizz`:

```text
overworld "Overworld" 60x44 id=main
start 9.2,8.2
area gumdrop-isle x=20..29 y=18..27         // listed first: the first match wins
area crater-fields x=0..24 y=0..22

blocks
  grass x=0..59 y=0..43
  river x=24..25 y=0..43
  path from=8,9 to=14,6
  scatter
  house-a x=7 y=17

points
  saucer at=8,10
  level crater at=14,6
  level meteor-mesa at=16,14 req=crater
  tele crater-down at=12,19 with=meadows-up req=crater,meteor-mesa,zarg-lookout
  tele meadows-up at=12,26 with=crater-down req=crater,meteor-mesa,zarg-lookout
  level citadel at=44,6 req=frosting-spire,cocoa-foundry big
  tele island-pad at=26,22 with=hidden-pad req=secret
  tele hidden-pad at=55,40 with=island-pad req=secret hidden
  sign 0 at=8,16
```

## 3. The exporter and `OverworldBuilder`

`overworldToRust(ast, fnName)` writes `fn <fnName>() -> MapData`. It emits, in this order:

1. Every point, in file order, as `b.points.push(MapPoint { ... })`. A teleporter's `to` is its partner's index in this list; `req` becomes `level_bit(CRATER) as u16 | ...` and `secret` becomes `crate::world::SECRET_FOUND as u16`.
2. Every area, in file order, as `b.areas.push(AreaRect { ... })`.
3. Every fill, route and scatter, in file order, as `b.fill(x0, x1, y0, y1, TILE)`, `b.path(x0, y0, x1, y1)` and `b.scatter()`.
4. `b.finish((start_x, start_y))`.

Points go first because `scatter` reads them, which matches the rasteriser's rule that a scatter keeps clear of every point.

```rust
/// Overworld: generated from an overworld script; edit the script, not this function.
fn overworld_fizz() -> MapData {
    let mut b = OverworldBuilder::new(60, 44);
    b.points.push(MapPoint { kind: PtKind::Saucer, level: SAUCER, x: 8.0, y: 10.0, to: 0, req: 0, big: false, hidden: false });
    b.points.push(MapPoint { kind: PtKind::Level, level: CRATER, x: 14.0, y: 6.0, to: 0, req: 0, big: false, hidden: false });
    b.points.push(MapPoint { kind: PtKind::Level, level: METEOR_MESA, x: 16.0, y: 14.0, to: 0, req: level_bit(CRATER) as u16, big: false, hidden: false });
    // ... the other 24 points, then the five areas, then the fills
    b.fill(0, 59, 0, 43, GRASS);
    // ...
    b.path(8, 9, 14, 6);
    // ...
    b.scatter();
    // ...
    b.finish((9.2, 8.2))
}
```

`OverworldBuilder` (`scratch/rust/episodes/episode-1/game/src/ow_builder.rs`, about 100 lines) holds a `TileMap` with `floor_solid = true`, a `points` list and an `areas` list, and has `new(w, h)`, `fill`, `path` (x first, then y), `scatter` and `finish(start) -> MapData`. It mirrors what `build_overworld` does inline. It has to be added to `levels.rs` beside `build_overworld` (ENGINE-CHANGES E1).

**Proven:** `overworlds/main.fizz` exported this way equals `build_overworld()`: the size, `floor_solid`, all 2,640 tiles (including 200 trees and 32 rocks), all 27 points, the five areas and the start (`ow_proof.rs`, run by `scripts/prove-all.sh`). The TypeScript rasteriser agrees too (`tools/verify-overworld.ts`).

## 4. Unlock rules

- A point's `req` is **all-of**: every listed level must be cleared (`World::met(req)` is `done & req == req`).
- `secret` is the secret-found flag, set once when Ben walks into a `secret-room`.
- `hidden` points are not drawn or reachable until their `req` is met; a teleporter whose requirement includes the secret and is unmet behaves specially in `world.rs`.
- The game names the first unmet level (`first_unmet`: the lowest-numbered missing bit) when a locked point is used.
- In the designer, the **Unlocks** chips edit `req`, and the **Links** lens draws a line from each required level's point to the point it unlocks.

Episode 1's rules, read from `main.fizz`: Crater Fields → Meteor Mesa → Zarg Lookout; all three open the teleporters down to the Meadows; Marshmallow Meadows and Bonbon Playhouse open the way east to Rock Candy Reach; Caves and Mirror Shafts open the way south to Frosting Frontier; the Citadel needs Frosting Spire and Cocoa Foundry; the island pad and its hidden partner need the secret.

## 5. The mask limit

- `Game::done` is a `u32`, but `MapPoint::req` is a `u16`, `World::met` and `first_unmet` take a `u16`, and the exporter writes `as u16`.
- Level ids `0..LEVEL_COUNT` (15 levels, ids 0 to 14) are bit positions; `SECRET_FOUND` is `1 << 15`; `PROGRESS_BITS` keeps exactly bits 0 to 15 when a save loads.
- So all 16 bits of `req` are in use. A 16th level would take bit 15, which is the secret flag.
- `SAUCER` is id 15, equal to `LEVEL_COUNT`, with no cleared bit; a new level with id 15 would also collide with the saucer's id.

Adding a level therefore needs `req` widened to `u32`, the secret moved to a high bit, a save migration, and the saucer renumbered or given an id outside the cleared range (ENGINE-CHANGES E3, E4).

## 6. Several overworlds

The language already allows it: each overworld is its own file with its own `id=`. The game does not: `build_overworld()` is the one map, `World::enter_map()` calls it directly, the `area_of(x, y)` export reads `overworld_areas()` (a hand-kept copy of the same rectangles), and `overworld_thumb()` (the save-slot thumbnail) rebuilds it. A registry is needed (ENGINE-CHANGES E5):

- An overworld table indexed by id, each entry with its build function.
- `World` remembers which overworld is current; `enter_map` takes an id; `area_of` and the thumbnail read the current one's areas.
- Each level records which overworld it belongs to (for returning to the map after a level).

Open: how Ben moves between overworlds (a point kind that opens another map, a teleporter whose partner is on another map, or the saucer), and whether the save stores the current overworld (`Game::map_pos` is one position today).

## 7. Registering a level

The exporter writes a function only. A new level also needs, in `levels.rs`: an id constant, a row in `LEVELS` (`id`, `build`, `theme`, `area`, `icon`), `LEVEL_COUNT` and `TABLE_LEN` raised, and, in the language, a row in `LEVEL_IDS` in `tables.ts` (the `id=` on the `level` line must name an existing constant, or the parser reports E002). Then the overworld needs a point for it.

## 8. Sprites

Today a level point's look comes from the level table, not from the overworld: `LevelDef::icon` is a `Spr` such as `Spr::OwLmCrater` (`owLmCrater` in `SPRITE_NAMES`), with `Spr::OwCastle` for the Citadel and `Spr::Saucer` for the saucer. The overworld script has no sprite field, and the studio has no sprite picker. The plan (ENGINE-CHANGES E10): the studio reads the sprite names from the game's name table 0, offers the overworld landmark sprites (`OwLm*`, `OwCastle`, `Saucer`) in a picker, and writes the choice where the registry keeps it (the `LEVELS` row, or a new `sprite=` field on the `level` point; open question Q8 in `docs/QUESTIONS.md`). The picker is the one described in `EDITOR.md` section 14 for every target, and it is delivered in `ROADMAP.md` M9.

## 9. Steps to make adding a level real

1. **Widen the masks** (E4): `MapPoint::req` and `met`/`first_unmet` to `u32`; `SECRET_FOUND` to a high bit; `PROGRESS_BITS` from the registry; a save migration that moves an old bit 15 to the new secret bit; the exporter writes `u32`.
2. **Free the saucer's id** (E3): give `SAUCER` an id that is not a cleared-level id, and check what stores level ids (saves, recordings, `level_hash`).
3. **Add `OverworldBuilder`** to `levels.rs` (E1) and generate `build_overworld()` from `overworlds/main.fizz`, with the proof test in the game repository.
4. **Make the level table data the exporter can write** (E3): generated level functions in a child module of `levels.rs`; a generated `LEVELS` table (or a generated row per level) with id, build function, theme, area and icon.
5. **Generate or check the name tables** (E11) so `LEVEL_IDS`, `THEMES` and `AREAS` in `tables.ts` follow the game.
6. **Add a "new level" flow** in the studio: name, size, theme, area, icon; it writes the script, the registry row and a point on the chosen overworld, as one reviewable change.
7. **Add the overworld checks** (`check_overworld`): one point per level, pairs both ways, no cycles, reachable from the saucer, mask room left.
8. **Prove it**: a test level added through the flow exports, compiles, appears on the map behind its unlock rule, can be entered and finished by the playtest bot, and its cleared bit survives a save and load.

## 10. Fizz 2 and later episodes

- **Fizz 2 has no overworld.** Its repository has no map, points, unlocks or progress mask; the slice is one level. Overworld scripts are therefore absent from the `ep2` profile, and their words are E102 there (`LANGUAGE.md`, the capability matrix).
- **Nothing here is assumed to carry over.** If Fizz 2 or Episode 3 gains an overworld, its model comes from that game (`docs/QUESTIONS.md` Q22): the point kinds, how a level is unlocked, the progress storage and the look (Fizz 2 draws its ground in an oblique projection, `docs/OBLIQUE.md` in that repository, which Fizz 1's top-down map does not).
- **The designer is profile-driven.** When a second game has an overworld, the designer takes its tile words, point kinds, unlock words and sprites from that game's profile, as the level editor does, so the Fizz 1 overworld stays exactly as proven while the other is added as data.
- **Level sprites on points** use the same Sprites window and picker for every target (`EDITOR.md` section 14), filtered to the sprites the profile marks as landmarks.
