# The Fizz builder language, v0

A Fizz script is a plain text description of one level. It is meant to be read and written by the studio, by a person and by Claude. `toRust` turns it into a Rust `fn <name>() -> LevelData` that makes the same calls on the private `Builder` in `episodes/episode-1/game/src/levels.rs` that a hand-written level function makes.

The language is a thin, honest skin over the Builder. Where the original design sketch disagreed with the real Builder, the Builder won; the changes are listed in [Changes from the sketch](#changes-from-the-sketch).

## The one rule that matters: statements run in file order

The Builder is order-dependent. `fill` overwrites earlier tiles, `item` and `ent` append to ordered lists (a level's fingerprint hashes that order), and `crystal`, `ent` without `y=` and `pogo-cache` read the ground height that earlier `terrain` lines recorded. So a script executes top to bottom, exactly as written, and the exporter emits one Builder call per statement in that order (a list such as `x=10,26,60` becomes one call per value, in list order). Section headers group lines for readers; they never reorder anything. A section may appear more than once, so interleaving that matters can be kept.

The edits block is always last and runs after everything else.

## Lexical rules

- A script is lines of text. One line does one thing.
- `//` starts a comment that runs to the end of the line (not inside the quoted level name). Blank lines and comment lines are kept as written.
- Indentation is ignored by the parser. Two spaces under a section header is the convention, and the studio uses it for lines it adds.
- Words are lower-case, with digits and hyphens: `red-door`, `up22`.
- A field is `key=value` with no spaces around `=`. Spaces after commas in a list are allowed (`x=35, 62, 85`).
- Numbers are plain decimals (`7`, `88.5`, `-2`). Coordinates are tile units; `y` grows upwards and row 0 is the bottom of the world, as in the Builder.
- A range is `a..b`, inclusive on both ends, whole numbers, with `a <= b`. A single number `n` is the range `n..n`.

## Grammar

```ebnf
script      = { line } ;
line        = [ statement ] [ "//" text ] ;                  (* blank and comment-only lines are lines *)

statement   = header | section | body ;

header      = level | theme | area | start | arena | walls ;
level       = "level" '"' name '"' W "x" H "ground=" INT "id=" LEVELID ;
theme       = "theme" THEME ;                                (* optional; checked against the level table *)
area        = "area" AREA ;                                  (* optional; checked against the level table *)
start       = "start" NUM "," NUM ;
arena       = "arena" "x=" RANGE "floor=" NUM ;
walls       = "walls" ;

section     = "terrain" | "blocks" | "treats" | "enemies" | "edits" ;

body        = terrain-line | block-line | treat-line | enemy-line | edit-line ;   (* by current section *)

terrain-line = seg { "," seg } | "liquid" LIQUID ;
seg          = SEGMENT INT ;                                 (* count >= 1 *)

block-line  = TILE      "x=" RANGE "y=" RANGE
            | "plat"    "x=" RANGE "y=" INT
            | "hover"   "from=" NUM "," NUM "to=" NUM "," NUM "speed=" NUM [ "size=" NUM "x" NUM ] [ "dwell=" NUM ]
            | "channel" INTLIST ( "on" | "off" )
            | "crystal" "x=" RANGELIST
            | ( "room" | "secret-room" | "wall-behind" ) "x=" RANGE "y=" RANGE
            | "mural"   "x=" INT "y=" INT
            | "ladder"  "x=" INT "y=" RANGE
            | ( "stairs-right" | "stairs-left" ) "x=" INT "y=" INT "count=" INT
            | "vine-nook" "x=" INT "foot=" INT "shelf=" INT "dir=" ( "1" | "-1" ) "depth=" INT "h=" INT ;

treat-line  = ITEM "x=" RANGELIST "y=" INT
            | "row" ITEM "x=" RANGE "y=" INT [ "by=" INT ]
            | "pogo-cache" "x=" RANGE "rise=" INT ;

enemy-line  = KIND "x=" NUMLIST [ "y=" NUM ] [ "dir=" NUM ] [ "ride" ] ;

edit-line   = "paint" TILE "x=" RANGELIST "y=" RANGELIST
            | "clear" "x=" RANGELIST "y=" RANGELIST
            | "place" ITEM "x=" RANGELIST "y=" RANGELIST ;

RANGELIST   = RANGE { "," RANGE } ;
NUMLIST     = NUM { "," NUM } ;
```

Fields may come in any order after the keyword. Constraints the grammar cannot show:

- The first statement is `level`, exactly once. `start` is required. `theme`, `area`, `start` and `arena` appear at most once. `walls` may appear more than once, as `Builder::walls` may be called more than once.
- Top-level statements (`theme`, `area`, `start`, `arena`, `walls`) may appear anywhere before `edits`, including between sections. Section words (`terrain`, `blocks`, `treats`, `enemies`) decide what the lines below them mean until the next section header.
- `edits` appears at most once and is last. Only `paint`, `clear` and `place` may follow it.
- `crystal`, an enemy line without `y=` and `pogo-cache` read the ground height, so a `terrain` line must come earlier in the file.
- Enemy lines: `dir=` and `ride` need an explicit `y=`, and `ride` cannot be combined with `dir=` (the Builder has no spawn that is both).
- Coordinates must fall inside the level (`0..W-1`, `0..H-1`). The Builder silently ignores out-of-range tile writes; the parser rejects them so a typo does not vanish.
- `row` needs `(b - a) % by == 0`; the item count is `(b - a) / by + 1`.

## Statements and their Builder equivalents

| Script | Builder call |
| --- | --- |
| `level "Crater Fields" 192x28 ground=4 id=crater` | `Builder::new(192, 28, 4)`, and the id used by `b.out(CRATER, ...)` |
| `theme crater` / `area crater-fields` | nothing emitted; checked against the `LEVELS` table, which is where `Builder::out` takes them from |
| `start 3,4` | the `start` argument of `b.out(CRATER, (3.0, 4.0), ...)` |
| `arena x=118..147 floor=4` | `Some(Arena { x0: 118.0, x1: 147.0, floor: 4.0 })` as the last argument of `b.out` (`None` when absent) |
| `terrain` + `flat 14, up 2` | `b.run(&[(Seg::Flat, 14), (Seg::Up, 2)])`, one `run` per line |
| `liquid furnace` | `b.liquid = FURNACE;` (applies to `pool` segments on later lines) |
| `walls` | `b.walls()` |
| `block x=49..51 y=10` | `b.fill(49, 51, 10, 10, BLOCK)` — any tile word works the same way |
| `plat x=107..108 y=5` | `b.plat(107, 108, 5)` |
| `hover from=97,4.5 to=103,4.5 speed=0.3` | `b.hover(97.0, 4.5, 103.0, 4.5, 0.3)` |
| `hover from=18,47.5 to=18,56.5 speed=0.1 size=3x0.5 dwell=2` | `b.plats.push(Platform::new(18.0, 47.5, 18.0, 56.5, 0.1).sized(3.0, 0.5).with_dwell(2.0))` |
| `channel 1,2,3 on` | `b.map.set_switch(1, true)` and so on, one call per channel |
| `crystal x=10,26` | `b.crys(10); b.crys(26);` |
| `room x=1..5 y=22..25` | `b.room(1, 22, 5, 25)` (note the Builder's order: x0, y0, x1, y1) |
| `secret-room x=.. y=..` | `b.secret_room(x0, y0, x1, y1)` |
| `wall-behind x=1..9 y=1..9` | `b.wall_behind(1, 9, 1, 9)` (order: x0, x1, y0, y1) |
| `mural x=2 y=8` | `b.mural(2, 8)` |
| `ladder x=4 y=4..9` | `b.ladder(4, 4, 9)` (standing row 4, ledge at row 9) |
| `stairs-right x=30 y=4 count=3` | `b.stairs_right(30, 4, 3)`; `stairs-left` likewise |
| `vine-nook x=10 foot=21 shelf=24 dir=1 depth=3 h=3` | `b.vine_nook(10, 21, 24, 1, 3, 3)` |
| `soda x=36 y=5` | `b.item(ItemKind::Soda, 36, 5)`; a list `x=1,3` makes one call per value |
| `row cheezie x=17..20 y=7` | `b.row(ItemKind::Cheezie, 17, 4, 7, 1)` |
| `row choc x=46..52 y=8 by=3` | `b.row(ItemKind::Choc, 46, 3, 8, 3)` |
| `pogo-cache x=8..10 rise=7` | `b.pogo_cache(8, 10, 7)` |
| `gloop x=35,62,85` | `b.ent(Kind::Gloop, 35.0)` and so on; `y` comes from the ground height |
| `drone x=88.5 y=7.5` | `b.ent_at(Kind::Drone, 88.5, 7.5)` |
| `hopper x=9 y=5 ride` | `b.rider(Kind::Hopper, 9.0, 5.0)` |
| `mirror x=11 y=6 dir=1` | `b.ent_dir(Kind::Mirror, 11.0, 6.0, 1.0)` |

Item `x`, `y` are whole tile cells; the Builder stores the item at the cell centre (`x + 0.5`). Enemy `x` and `y` are tile units and may be fractional.

### `row`: the sketch fix

`Builder::row(kind, x0, n, y, step)` places `n` items at `x0, x0 + step, x0 + 2*step, ...` all on row `y`. The five numbers are therefore a start, a count, a row and a step, not two coordinate pairs. In the script it is `row KIND x=A..B y=N [by=S]`, where `A` is `x0`, `B` is the last item's cell, `by` is the step (default 1) and the count is derived. `row cheezie x=17..20 y=7` is four cheezies. If `B` is not reachable from `A` in whole steps the parser refuses (E012) and offers the nearest two ranges that work. A row of zero items cannot be written, which is no loss since it does nothing.

### Words

- **Terrain segments** (`terrain` section): `flat`, `up`, `down`, `up22`, `down22`, `gap`, `pool`, `spikes`, `belt-r`, `belt-l`.
- **Tiles** (`blocks` section and `paint`): `fill`, `block`, `one-way`, `spike`, `choc`, `slope-r45`, `slope-l45`, `slope-r22a`, `slope-r22b`, `slope-l22a`, `slope-l22b`, `red-door`, `blue-door`, `green-door`, `bridge`, `mural-origin`, `mural-part`, `crystal-tile`, `exit`, `grass`, `path`, `river`, `tree`, `rock`, `conveyor-l`, `conveyor-r`, `furnace`, `wall-bg`, `rung`, `rung-top`, `facade`, `gate`, `gate-2`, `gate-3`, `vine`, `cracked`, `house-a`, `house-b`, `shop`, `fountain`. (`empty` exists for `clear` but is not a `blocks` word.) `one-way` is `PLAT`.
- **Items**: `cheezie`, `choc`, `cookie`, `soda`, `key-red`, `key-blue`, `key-green`, `usb`.
- **Enemy and prop kinds**: `gloop`, `hopper`, `marsh`, `beetle`, `bat`, `pod`, `phantom`, `roller`, `sentry`, `drone`, `boss`, `switch`, `terminal`, `cage`, `mirror`, `swivel`, `crystal-switch`, `press`, `target`, `glyph`, `cameo`.
- **Level ids** for `id=`: `crater`, `caves`, `citadel`, `meteor-mesa`, `zarg-lookout`, `marshmallow-meadows`, `bonbon-playhouse`, `fudge-bog`, `mirror-shafts`, `sugar-glass-gallery`, `frosting-flats`, `frosting-spire`, `cocoa-foundry`, `gumdrop-isle`, `whisper-hollow`, `saucer`. Each is a constant in `levels.rs` (`crater` is `CRATER`) and a row in `LEVELS` that fixes its theme and area.
- **Themes**: `crater`, `caves`, `citadel`, `open-sky`, `building`, `theatre`, `shaft`, `foundry`. **Areas**: `crater-fields`, `marshmallow-meadows`, `rock-candy-reach`, `frosting-frontier`, `gumdrop-isle`.

All of these tables live in `packages/language/src/tables.ts`.

## The edits block

```text
edits   // painted in the studio, by you or Claude
  paint one-way x=26,28,30 y=9
  clear         x=12..14 y=8
  place cheezie x=26,28,30 y=10
```

The edits block is where the studio and Claude record changes made by hand on the canvas, so the hand-written script is never rewritten.

1. **Hand-written lines are never rewritten.** `appendEdits(ast, edits)` returns a new AST that shares every existing node untouched and only adds new nodes. A parsed line prints as the exact text it was read from, so appending leaves every earlier byte of the file as it was.
2. **Edits are appended.** New lines go after the last non-blank line of the file (so after the last line of an existing block). If there is no `edits` header yet, the studio adds one blank line and the bare header `edits` first. Blank lines at the end of the file stay at the end.
3. **Edits run last, in file order.** In the exported Rust they come after every other statement and before `b.out(...)`. A later line wins over an earlier one, and over anything the hand-written sections built.
4. **`paint TILE x=LIST y=LIST`** sets every cell in the x-list by y-list product to the tile, as `b.fill(x0, x1, y0, y1, TILE)` per pair of ranges. It is a tile word only (see below).
5. **`clear x=LIST y=LIST`** sets those cells to `EMPTY` (`b.fill(..., EMPTY)`). It clears tiles only: it does not remove items, enemies, platforms or rooms.
6. **`place ITEM x=LIST y=LIST`** appends items, one `b.item` call per cell, x first then y, after every hand-written item.
7. The block takes `paint`, `clear` and `place`, any enemy statement (such as `drone x=88.5 y=7.5`), `hover`, `channel`, `room` and `secret-room`. Anything else after the `edits` header is E008.
8. Edits are undone by deleting or editing their lines; the studio treats the block as an append-only log, and a person may tidy it.

Items are not tiles. Adding an enemy, a lift, a room or a switch channel is an edit. Removing a hand-written item, moving an enemy or changing terrain is not an edit in v0: change the hand-written line (that is a deliberate rewrite, made by a person or by Claude on request, not by the studio's append).

## Parse errors

`parse(text)` returns `{ ast, errors }` and never throws; it reports at most one error per line, and a bad line stays in the AST (as an `error` node) so the script still prints back unchanged. `parseOrThrow` and `toRust` throw `FizzErrors` instead. `formatError` renders `line N: CODE message (fix: ...)`. Line numbers are 1-based and refer to the text as given. A missing `level` header is reported on line 1; a missing `start` is reported on the `level` line.

| Code | Meaning | Message example | Suggested fix |
| --- | --- | --- | --- |
| E001 | Unknown statement word | ``unknown statement `plot` in `blocks` `` | ``did you mean `plat`?`` or the list of words the section takes |
| E002 | Unknown name (tile, item, kind, segment, level id, theme, area) | ``unknown tile `one-wy` `` | ``did you mean `one-way`?`` or the list of valid names |
| E003 | Missing field or word | ``missing field `y=` `` | ``add `y=10` `` |
| E004 | Malformed number, range, list or header | ``` `x=` must be a whole number or a range such as 3..7, found `a` ``` | write digits, `a..b` or a decimal |
| E005 | Range runs backwards | ``range 9..3 runs backwards`` | ``write it as 3..9`` |
| E006 | Duplicate (`level`, `start`, `theme`, `area`, `arena`, or a second `edits`) | ``a second `start` line`` | keep one |
| E007 | Statement before the `level` header, or no header at all | ``the script has no `level` header`` | start with `level "Name" 192x28 ground=4 id=crater` |
| E008 | Statement in the wrong place (under another section's header, before any section, or a non-edit after `edits`) | ``` `soda` belongs under `treats`, not `enemies` ``` | move it under the named header |
| E009 | Unknown field or stray word | ``unknown field `z=` `` | lists the fields the statement takes |
| E010 | No `start` line | ``the script has no `start` line`` | ``add `start 3,4` `` |
| E011 | A statement that reads the ground height has no `terrain` above it | ``` `crystal` reads the ground height, but no terrain line comes before it ``` | move it below the terrain lines |
| E012 | `row` range does not land on its step | ``x=46..53 does not end on a step of 3 from 46`` | ``write x=46..52 by=3 (3 items) or x=46..55 by=3`` |
| E013 | Coordinates outside the level | ``x 38..40 is outside the level (x runs 0..39)`` | keep within the bounds or resize the level |
| E014 | `theme` or `area` contradicts the level table for that id | ``theme `caves` contradicts id `crater`...`` | write the table's value or drop the line |
| E015 | A count or size that must be at least 1 (or a level under 3x3) | ``the count after `flat` must be at least 1, found 0`` | use 1 or more or delete the line |
| E016 | Enemy field combination the Builder cannot make | ``` `dir=` and `ride` need an explicit `y=` ``` | add `y=`, or drop one of `ride` and `dir=` |

A malformed `level` header is one error; later lines are still checked against the level size where it is known, so one typo does not bury the real problems.

## Changes from the sketch

Marked **(changed)**, with the reason.

1. **`row` (changed).** The sketch left the five numbers unexplained. `Builder::row(kind, x0, n, y, step)` is a horizontal run of `n` items, so the syntax is `row KIND x=A..B y=N [by=S]` (see above).
2. **`id=` on the `level` line (changed).** `Builder::out(id, ...)` takes a level id constant, and theme and area come from the `LEVELS` table by that id. The sketch's `theme crater` and `area crater-fields` therefore cannot drive anything. `id=` is required, and `theme`/`area` are optional lines the parser checks against the table (E014).
3. **`crystal` is not an enemy (changed).** `b.crys(x)` writes a decorative `CRYS` tile on the ground; it is not `Kind::CrystalSwitch`. `crystal` moved from `enemies` to `blocks`; the real enemy is `crystal-switch`. A crystal tile at a chosen height is `paint crystal-tile`.
4. **`paint cheezie` is invalid (changed).** A cheezie is an item, not a tile. Painting items is `place cheezie ...`; `paint` takes tile words only.
5. **`walls` is a statement, not a section (changed).** `Builder::walls()` takes no arguments, so `walls` is a single line with no body.
6. **Order is file order (changed, stated).** The sketch's sections implied a fixed order. The Builder is order-dependent, so sections are labels only, can repeat, and never reorder execution.
7. **`treats` and `enemies` accept lists.** `gloop x=35, 62, 85` and `drone x=88.5,165.5 y=7.5` expand to one call per value. A `terrain` line becomes one `b.run` call, so a long run can be split over several lines.
8. **Tile words for fills.** `block`, `red-door` and `exit` are three of the tile words, all of which become `fill`. Two tile names differ from the Rust constants to avoid clashing with statements: `mural-origin` (`MURAL`; `mural` is the 3-by-2 statement) and `crystal-tile` (`CRYS`).
9. **Added to cover more of the Builder:** `liquid`, `plat`, `hover`, `room`, `secret-room`, `wall-behind`, `mural`, `ladder`, `stairs-right`, `stairs-left`, `vine-nook`, `pogo-cache`, `arena`, `rider` (`ride`) and `ent_dir` (`dir=`) spawns, and `place` in the edits block. `pogo-cache` has to be expressible because `crater()` calls it.
10. **Comments.** `//` comments are part of the language, on their own line or after a statement.

Unchanged from the sketch: ranges as `x=a..b`, `block`/`red-door`/`exit` as tile fills, `soda x=36 y=5`, `drone x=88.5 y=7.5`, `start 3,4`, `paint`/`clear` in a trailing `edits` block.

## Overworld scripts

An overworld is a second kind of script, told apart by its header. A script holds one level or one overworld, so a game with several overworlds has several files.

```text
overworld "Overworld" 60x44 id=main
start 9.2,8.2
area gumdrop-isle x=20..29 y=18..27         // the first area to match a tile decides its area
blocks
  grass x=0..59 y=0..43                     // any tile word fills a rectangle, later fills win
  river x=24..25 y=0..43
  path from=8,9 to=14,6                     // a route: x first, then y
  scatter                                   // trees and rocks on free grass, by each area's rates
  house-a x=7 y=17
points
  saucer at=8,10
  level crater at=14,6
  level meteor-mesa at=16,14 req=crater     // req: levels to clear first, or `secret`
  tele crater-down at=12,19 with=meadows-up req=crater,meteor-mesa,zarg-lookout
  level citadel at=44,6 req=frosting-spire,cocoa-foundry big
  tele hidden-pad at=55,40 with=island-pad req=secret hidden
  sign 0 at=8,16
```

- **Sections.** `blocks` holds tile fills, `path` and `scatter`. `points` holds `level`, `tele`, `saucer` and `sign`. A later `edits` block works as it does in a level script.
- **`path` has two meanings.** `path x=.. y=..` fills the `path` tile, and `path from=.. to=..` draws a route between two points, running x first and then y. The `from=` tells them apart.
- **`scatter` and the points.** A scatter keeps clear of every point in the file and every path drawn before it, whatever the order of the sections, so moving a point or a path changes the trees near it and nowhere else. The roll for each tile is the game's `hashf`, so the preview is tile for tile what the game builds.
- **Teleporters are named.** The game pairs teleporters by their index in the point list. The script names each one and pairs by name with `with=`; the exporter works out the indices from file order.
- **Rust.** `overworldToRust` writes `fn <name>() -> MapData` against an `OverworldBuilder` (`fill`, `path`, `scatter`, `finish`, plus the `points` and `areas` lists). The builder has to sit in `levels.rs` beside `build_overworld`, which it mirrors; `scratch/rust/.../ow_builder.rs` is the proof's copy.
- **Proof.** `overworlds/main.fizz` rebuilds the game's overworld exactly: all 2,640 tiles including 200 trees and 32 rocks, all 27 points, the five areas and the start. `bun tools/verify-overworld.ts` checks the TypeScript rasteriser against the game's own data, and `scripts/prove-all.sh` runs the Rust comparison.

**Limits to know about.** The game builds one overworld, `build_overworld()`, so several overworlds need a registry like the level table. The cleared-levels mask is 16 bits and the game already uses all of them (15 levels and the secret-found flag), so adding a level also means widening that mask.

## The Fizz 2 dialect (planned)

Lieutenant Fizz 2 bakes its levels from `.fizz` sources, so the language gains a dialect. **None of this is built in `packages/language` yet.** The Fizz 2 repository has not written the dialect's grammar either: its `docs/FAP.md` ("The baker") says only that levels are written "in the Fizz 2 dialect of the Level Studio script, committed as `assets/levels/*.fizz`: a `map` grid of letters, `at=X,Y` for exact centres and `chicken` as an object kind", and that the grammar is not yet specified. There is no `fizz-script` crate, no `fizz-bake` tool, no `.fizz` file and no error code in that repository today (checked on `main` at `ba1ec8e` and on the open level pull requests #137, #138 and #140). What does exist there is a first form of the data a script produces: the `LEVL` section with object, rule and string records, read by `fizz-pack` and built into a world by `fizz-ep2`.

This section keeps three things apart:

- **What exists in Fizz 2 today,** cited. Where it comes from an unmerged pull request it is marked **provisional**.
- **The owner's design,** decided on 2026-11-04 (`DECISIONS.md` D42 to D53): states with rules, `LEVL` version 2, placed lights, the wall-kick, levels whose target is fixed, world projects, behaviour scripting, raised events and bitmap parallax panels. Each part that needs Fizz 2 work names its change request (F1 to F23 in [ENGINE-CHANGES.md](ENGINE-CHANGES.md#fizz-2-planned)).
- **The syntax,** which is this studio's proposal for the grammar the Fizz 2 repository has not written. When `fizz-script` and `fizz-bake` exist they are the authority: where this section and they disagree, they win, and this page is corrected in the same change.

A level belongs to a **world project** ([WORLD.md](WORLD.md)), which holds the shared definitions, sprites, panels, sounds and strings; custom enemies and items and their behaviour scripts are in [SCRIPTING.md](SCRIPTING.md). The editor's side is [EDITOR.md section 13](EDITOR.md#13-the-fizz-2-target-planned).

### A superset in text, not in meaning

- The first line of a Fizz 2 file is `script fizz2 0`: the dialect's name and its version. A file without it is a Fizz 1 script, and everything above in this document still holds for it.
- **The target is fixed when a level is created** (D46). The `script` line, written by New level, is the level's target for life; there is no setting that changes it. A Fizz 1 level can be **converted up** to a new Fizz 2 level; a Fizz 2 level can only be **exported down** with the lossy check.
- **Every Fizz 1 script still parses** under the Fizz 2 parser, so a Fizz 1 level can be read for conversion and a Fizz 1 word in a Fizz 2 file gets a precise error (E102) instead of a parse failure.
- **The games diverge in meaning.** The exit needs an Up press in Fizz 2 and a touch in Fizz 1; a door is a tile bound to a state in Fizz 2 and a tile the key rewrites in Fizz 1; Fizz 2 has states with rules, placed lights, custom enemies and the oblique look, and Fizz 1 has lifts, rooms, ladders and its own roster. The [capability matrix](#the-capability-matrix) lists every divergence the studio knows of, each with its check.
- The parse is lossless: bad lines stay in the AST, comments and blank lines are kept, and a parsed file prints back unchanged. The canonical printer is planned as `fizz-bake fmt` (`docs/FAP.md`), and the studio's printer must agree with it byte for byte.
- The compile pipeline is parse (lossless AST), resolve (names to indices, world definitions to their records), validate, lint, lower to a `LEVL` section, then re-read the result through `fizz-pack` and `fizz-ep2` as a check.

### What a Fizz 2 level holds

**`LEVL` version 2** carries the finished design (owner decision, D43; change request F10). Fizz 2 is in active development and no pack has shipped, so version 1 is dropped: no version 1 reader is kept, and the slice level is regenerated as version 2 with its golden hash re-pinned in the same Fizz 2 change. Today's records (#137, #138, #140) are the starting point, not a format the studio writes.

| Part | Version 2 (owner design; F10, F11, F12) | Today in Fizz 2 | Source |
| --- | --- | --- | --- |
| Size, name, start, floor | `w`, `h`, a name of up to 48 printable ASCII bytes, the spawn in tiles, `floor_solid` | The same, in version 1 (`docs/FAP.md`) | `level`, `start`, `floor` |
| States | A state table: each state's value count and start value | 32 on/off channel bits, `switches` (#140) | `state` lines |
| Bindings | Which tiles, lights, platforms and panels read which state and value | The door tiles' channels, fixed in `tiles.rs` | `door`, and `state=` on objects |
| Tiles | `w * h` tile ids, row 0 (the bottom) first | The same | `map` |
| Objects | Fixed-size records: keys, snacks and cans, the chicken, switches, lights, and instances of the world's custom enemies and items | Keys, snacks, cans and the chicken (`kind` 1 to 4) | The `objects` section |
| Rules | Fixed-size records: an input, up to two conditions, up to two actions | Lock records and refused triggers (#138, #140) | `when` and `lock` lines |
| Strings | Up to 32 level strings, 1 to 30 bytes, seven styles | The same, carried but not drawn (#138) | `string` lines |

The record sizes and the limits beyond those named are the Fizz 2 repository's to choose in F10 (Q23, Q24). Today's version 1 length formula, `32 + pad8(name_len) + 32 * (objects + rules + strings) + w * h` (1,968 bytes for the slice on #140), is the shape to expect, and the Budget window reads the real length from `fizz-bake`.

**Not level data:** music, the Sky and Night player settings (`FIZZ2.CFG`, #144, #146) and the exit rule (#145). The theme is the world's, with a per-level override ([Theme, look and lights](#theme-look-and-lights)).

### The header

```text
script fizz2 0
level "Lighthouse Point" 32x48 id=light-1
start 2,2                            // the lower-left corner of Ben's body
floor solid                          // or `floor open`; the default is open, as the slice is
theme lighthouse                     // optional: overrides the world's theme
```

- `level` keeps the Fizz 1 shape. `id=` is the level's slug, used for its file name and the world's manifest; the `LEVL` section stores no id. `ground=` is a Fizz 1 field (the terrain helpers' ground height): it is optional in a Fizz 2 file and ignored, with W112, when it is given.
- `start X,Y` is the spawn in tile units and may be fractional. Ben's start is the lower-left corner of his body, while an object's `at=` is its centre (see [Positions](#positions-xy-and-at)).
- `floor solid` sets `floor_solid`. The Fizz 1 script cannot say it, so a Fizz 1 export of `floor solid` is E122.
- Fizz 1's `channel LIST on|off` is accepted in a Fizz 2 file as sugar for two-valued states named `channel-N`, so a converted level keeps working; new levels use `state`.

### The map block

A Fizz 2 level's tiles are drawn as a grid, top row first, which is how the slice level itself is written (`ROWS` in `crates/fizz-ep2/src/level.rs`).

```text
map
  |......................b........B|  40
  |....................E.b........B|  39
  |#..............B===============#|  37
  |###############Bwwwwwwwwwwwwwww#|  36
```

- Each row sits between `|` bars and has exactly `w` characters, with an optional row label giving its `y`. There are exactly `h` rows. `y` still counts up from the bottom: the last row of the block is row 0.
- **The legend** maps a letter to a tile id. It comes from the target profile, not from the file, so the palette, completion, the printer and the baker read one table. The letters the slice uses, with their ids from `tiles.rs`:

| Letter | Tile | Id | Meaning |
| --- | --- | --- | --- |
| `.` | `EMPTY` | 0 | Open air: shows the parallax panels |
| `#` | `FILL` | 1 | Solid fill; drawn as stone, deep stone three tiles from any opening |
| `B` | `BLOCK` | 2 | A solid block; drawn as brick |
| `=` | `PLAT` | 3 | A one-way platform; drawn as planks |
| `^` | `SPIKE` | 4 | Spikes: lethal |
| `D` | `DOOR_R` | 12 | A red door: solid while the state it is bound to is closed |
| `b` | `DOOR_B` | 13 | A blue door, likewise |
| `E` | `EXIT` | 17 | The exit doorway |
| `w` | `WALLBG` | 30 | Interior back wall; not solid; drawn in the theme's back-wall material |

- Fizz 2's tile table also has `CHOC` (5) and the six slopes (6 to 11). They have ids and tile properties but no letter is fixed and the oblique renderer does not draw them yet (hills are specified in `docs/OBLIQUE.md` on #142, not built). The studio proposes `~` for `CHOC` and `/`, `\`, `r`, `R`, `l`, `L` for the slopes, provisional until the Fizz 2 repository fixes them (Q11).
- **Fizz 2 tile ids are Fizz 1's** (`EXIT` is 17 and `WALLBG` 30 in both), so the legend reserves a letter for each Fizz 1 tile that has no Fizz 2 meaning yet (`bridge`, `conveyor-l`, `gate`, `vine`, `rung` and the rest). A reserved letter parses and prints and is E102 when lowering. A tile id the target's table does not hold is E104.
- The texture a tile gets is chosen by its letter and its neighbours (`docs/OBLIQUE.md`, #142), so choosing `#` or `B` chooses how it looks as well as what it does.

### Positions: `x=`/`y=` and `at=`

- `x=`/`y=` name a cell, and the object sits at its **centre**, as in Fizz 1.
- `at=X,Y` is an **exact** position in tile units, for an object off a cell centre. The slice needs it: the red key is at (2.5, 11.7) and the hanging cheezies at y 40.2 (`level.rs`).
- **The printer rule:** the printer writes `x=`/`y=` only for an exact cell centre and `at=` for everything else, so the same position always prints the same way.
- **What the point means depends on the kind.** A key, snack or light's point is its centre. A chicken's or custom enemy's point is its spawn, feet and centre (`CHICKEN = (8.0, 11.0, -1.0)` stands on the ledge at `y = 11`). Ben's `start` is his body's lower-left corner. The Inspector says which one a field is.
- Every centre must lie in the map (`0 <= x < w` and `0 <= y < h`), as `LevelView::new` refuses otherwise (E108).

### Objects

```text
objects
  key-red     id=red-key     at=2.5,11.7
  key-blue    id=blue-key    at=24.5,42.7
  cheezie     id=hang-1      at=25.5,40.2
  soda        id=floor-can   at=28.5,38.7
  chicken     id=hen         at=8,11 dir=-1
  switch      id=lever-1     at=6,3 style=lever
  light       id=lamp-1      at=4,13 radius=7.5 colour=yellow falloff=soft state=lamps on=on
  light       id=hen-glow    radius=2 colour=green attach=hen
  beetle-bot  id=bot-1       at=12,3 dir=1 group=guards      // a custom enemy from the world's defs
  cookie-jar  id=jar-1       x=20 y=5                        // a custom item
```

| Word | Today | Notes |
| --- | --- | --- |
| `key-red`, `key-blue` | Built (`kind` 1, 2) | At most one per colour today (`SecondKey`, #137); more colours and named keys are F11 |
| `cheezie`, `choc`, `cookie`, `soda` | Built (`kind` 3, `sub` 0 to 3) | 1, 2 and 5 points; the can gives five shots |
| `chicken` | Built (`kind` 4) | Fizz 1's gloop; `dir=` -1 or 1 |
| `switch` | Not in Fizz 2 (kind 6 is reserved for it) | A rule input: hit by a shot or a stomp, or used with Up (F11, Q25) |
| `light` | Not level data in Fizz 2 (#146 lights are constants) | A placed light (D44, F12): `radius=` in tiles, `colour=` or `bank=`, `falloff=` (`soft`, `hard`, or a number), `flicker=` (`none`, `candle`, `pulse`, or a period in ticks), `state=` and `on=` to switch it, `attach=ID` to move with an enemy, item or `ben` |
| A custom enemy or item | Not in Fizz 2 | Defined in the world's `defs/` ([SCRIPTING.md](SCRIPTING.md)); `group=` names a set a rule can test (`cleared group=guards`) |
| `key-green`, `usb` | Not in Fizz 2 (the HUD has `hudkey_green` and `hudkey_gold`) | E102 until the profile has them |

- **`id=` is required** on every object. It is a source-level name only: the record holds no id, and the baker resolves each id to the object's **index**, which is what a rule's input or action holds. Because rules point at indices, the editor never lets a person reorder objects by hand, and renaming an id rewrites everything that names it in the same undo step.
- Objects are **stably sorted by kind**, ties keeping file order (`SourceError::KindOrder`, #137), because the state hash indexes snacks and chickens by position. The printer groups them by kind in the `objects` section.
- An attached light's `at=` is an offset from the thing it follows (default 0,0, its centre).

### States and rules

A level declares **named states**; things **bind** to a state; **rules** change states from **inputs**. A key is one input among many, and `lock` is short sugar for the common key-and-door case (owner decision, D42). This is the owner's design: in Fizz 2 today a lock is a record holding only a key colour, a channel fixed by the door's tile and a cell (#140), which is a gap in the Fizz 2 repository, not the plan. The state table, the bindings and the rule inputs are change request F11.

**States.**

```text
state red-door closed values=closed,open        // a state with a set of values; the first word is the start value
state alarm off                                 // the default set is off,on
state lift-mode low values=low,mid,high
```

- `state NAME START [values=V1,V2,...]`. The default value set is `off,on`. A state has at most 8 values (proposed; Q23) and a level at most 32 states (today's channel count).
- **A death resets every state to its start value**, as it resets the rest of the level (owner decision, 2026-10-30, D33). The world's shared state definitions (`defs/states.fizz`) can be named in a level; world-scoped states that span levels are open (Q27).

**Bindings.**

```text
door x=15 y=20..22 state=red-door open=open     // these door tiles are solid unless red-door is open
light id=lamp-1 at=4,13 radius=7.5 state=alarm on=on
```

- `door x=RANGE y=RANGE state=NAME open=VALUE` binds the switched tiles in the rectangle to a state; they are passable only while the state has that value. A door tile with no binding is E110.
- `state=NAME on=VALUE` on a light switches it; on a parallax panel (`WORLD.md`) shows it; on a platform, when Fizz 2 has them, chooses its path or stops it (reserved).
- Anything not bound is unaffected by states.

**Rules.**

```text
when take id=red-key then word "red key" style=red at=2,11, cue key at=2,11
when touch at=15,21 holding key-red if state red-door is closed then set red-door open, spend key-red
when hit id=lever-1 then toggle alarm, cue clunk at=6,3
when cleared group=guards then set lift-mode high, word "all clear" style=green at=12,3
when time at=60 every=120 repeat then next lift-mode
when state alarm becomes on then cue door at=15,21
when enter x=1..14 y=2..3 if state alarm is off and holding key-blue after=30 then set alarm on
```

The shape is `when INPUT [if CONDITION [and CONDITION]] [after=TICKS] then ACTION[, ACTION] [repeat]`:

| Part | Values |
| --- | --- |
| Input | `start`; `enter x=RANGE y=RANGE`; `take id=ID`; `touch id=ID` or `touch at=X,Y` (Ben in front of it at body height), with an optional `holding KEY`; `use id=ID` (Up pressed there, as at the exit; Q25); `hit id=ID` (a shot or a stomp on a switch); `stomp`, `stun` or `defeat` with `id=ID`, `kind=KIND` or `any`; `cleared group=NAME`; `time at=TICKS [every=TICKS]`; `state NAME becomes VALUE` |
| Condition | `state NAME is VALUE`, `state NAME is not VALUE`, `holding KEY` |
| Delay | `after=TICKS` |
| Action | `set NAME VALUE`, `toggle NAME` (two-valued), `next NAME` (the next value, wrapping); `spend KEY`, `give KEY`; `score N`, `ammo N`; `word STRING [style=S] at=X,Y` and `cue EFFECT at=X,Y` (raised events, below) |
| Repeat | `repeat`; without it a rule fires once per life |

- **Two conditions and two actions per rule** are proposed, so a record stays fixed-size (Q24). An event action (`word`, `cue`) counts as an action.
- **Time rules:** `at` is at least 1 tick; `every` is 0 or at least 6 ticks (today's `MIN_PERIOD`); `repeat` is written exactly when `every` is not 0 (E114).
- **Order.** Rules run as table rows, in table order, after the player, the enemies and the shots have moved; a `state ... becomes` rule sees changes made earlier in the same tick (F11 fixes the exact order; Q18).
- **Compiled at bake time into fixed records.** There is no virtual machine for rules and no rule text on DOS. (Custom enemies' behaviours are bytecode, which is a separate section; [SCRIPTING.md](SCRIPTING.md).)
- **Limits:** 32 rules per level (sugar expanded), 32 states, 32 strings (E111 to E113).

**`lock`, the sugar.**

```text
lock red-door key=red at=15,21
```

expands to exactly:

```text
state red-door closed values=closed,open
door x=15 y=20..22 state=red-door open=open          // the run of door tiles through 15,21
when touch at=15,21 holding key-red if state red-door is closed then set red-door open, spend key-red
```

with the door's own sound and caption raised by the game's door event, as today. The dump view shows the expansion; the printer keeps the `lock` line as written. A `lock` whose cell is not a door tile is E110.

**Raised events: floating words and sounds** (owner decision, D50). Rule actions and objects **raise events**: `word` shows a floating word, `cue` plays a sound. Words are level strings (`string NAME "text" [style=S]`), world strings or the shared captions (`fzzt`, `click`, `fizzled`, `bonk`, `whoa`, `tada`, `red`, `blue`, `green`, `clunk`, `boing`, `crunch`, `fsssht` in today's `cues.rs`, `eb9b1db` on #140); a quoted string in a `word` action is a level string the printer names for you. Sounds are chosen from the **world's sound library** in its pack (F18), whose names start from the game's effects (`cluck0` to `cluck3`, `fzzt`, `stun`, `bonk`, `hurt`, `win`, `key`, `clunk`, `plink`, `boing`, `jump`, `crunch`, `soda`, `door`). Strings are up to 32 per level, 1 to 30 bytes of ASCII plus the middle dot, en and em dashes, curly quotes and the ellipsis, in the styles `white`, `cyan`, `red`, `green`, `blue`, `yellow`, `grey`. An unknown word, caption or cue is E116; a word wider than the DOS frame at caption size is W107.

**Lint W101** warns when a door's bound state starts open. A level that means it says `allow W101` with a comment saying why. Planned: the baker's `check` fails on any warning without an `allow`.

**What runs today.** Fizz 2 runs only its two lock records; every other trigger is refused at load (`RuleError::Trigger`, #140). Until F11 is built the `ep2` profile marks states beyond doors, switches, inputs other than `touch ... holding` and every action but `set` as **accepted** (W106).

### Theme, look and lights

- **The oblique ground is the Fizz 2 look** for every Fizz 2 level (owner decision, D45): Fizz 2 draws the ground in an oblique projection with faces from each tile's class and neighbours (`docs/OBLIQUE.md`, #142 and #143). It is global, not a per-level choice. The flat look is kept only for Fizz 1 levels. Making the oblique ground the look of every Fizz 2 level, not only the slice, is F13.
- **The theme** chooses the back-wall material, the parallax panel stack, the horizon and the night ambient (`docs/OBLIQUE.md` "Backgrounds and parallax", #144). It is the world's (`world.fizz`), with an optional `theme` line per level. Today the only theme is the slice's Lighthouse night, written as constants in `crates/fizz-slice-view/src/oblique.rs`; the format is F3, and until it exists `theme` is accepted and shown, not baked (W109).
- **Parallax panels** are world art: bitmap panels with a scroll factor, repeat, vertical position and open-air rule, imported from a PNG or painted in the studio ([EDITOR.md section 15](EDITOR.md#15-art-the-pixel-editor-planned)), packed in the world's `BDRP` section (F19). Today's Fizz 2 layers (`Stars`, `Clouds`, `Band` in `crates/fizz-view/src/parallax.rs`) are procedural; a bitmap panel is a new layer kind.
- **Lights are placed objects** (D44, F12; see Objects). Lights that follow the game's own things (the door badges, the exit glow, Ben's lantern, the shots, #146) stay derived and need no authoring. The game lights at most 16 at once, nearest first, from a pool of 32 (`MAX_ACTIVE`, `POOL`, #146), and night at Full detail does not fit the 486 frame today (17.1 ms on average); light count and cost feed the Budget window (W111).
- **Night and Sky** stay player settings (#144, #146), not level words. `music NAME` is reserved (W109); there is no per-level music field.

### Errors and lints

- **E001 to E016** keep their meaning (the table above) and are reused. Fizz 2 errors report `path:line:col` and a stable code, as `docs/FAP.md` requires of the baker.
- **E1xx** are the dialect's, **E2xx** the behaviour scripts' ([SCRIPTING.md](SCRIPTING.md#63-lints-and-errors)). The numbering is the studio's proposal; if `fizz-script` numbers them differently its numbers are used and this table is corrected (D40). E119 to E122, W101 and W104 are the numbers the approved plan named.

| Code | Meaning | Example |
| --- | --- | --- |
| E101 | The `script` line names a dialect or version no installed target profile accepts | `script fizz2 7` |
| E102 | The word has no equivalent in the level's target and cannot be lowered | `hover from=...`: Fizz 2 has no lifts yet |
| E103 | A `map` row's width differs from `w`, or the row count from `h` | row 37 has 31 characters |
| E104 | A map letter, or a tile id, that the target's legend does not hold | unknown map letter `Q` |
| E105 | An object without `id=`, or two objects with one id | `cheezie at=3,4` |
| E106 | A reference names no object, or one of the wrong kind | `take id=hen`: a chicken cannot be taken |
| E107 | More keys of a colour than the target allows | a second `key-red` |
| E108 | A start or object centre outside the map | `at=32.5,4` in a 32-wide level |
| E109 | A field value the record cannot hold | `dir=0`; a name over 48 bytes; `radius=-1` |
| E110 | A door tile with no binding, a `door` rectangle with no door tile, or a `lock` whose cell is not a door | `lock red-door at=3,4` on a block |
| E111 | More than 32 rules, sugar expanded | the 33rd rule |
| E112 | A string problem: over 32 strings, length outside 1 to 30, a character the game cannot draw, an unknown style | a string of 31 bytes |
| E113 | A state problem: over 32 states, over 8 values, a start value not in the set, a value a rule or binding names that the state lacks | `set alarm maybe` |
| E114 | A time rule out of range | `every=3`, or `every=` without `repeat` |
| E115 | More than two conditions or two actions in a rule | a third action |
| E116 | An unknown effect, caption or string | `cue squeak` |
| E117 | A rule's cell or rectangle outside the map | `enter x=30..40` in a 32-wide level |
| E118 | An action that needs a cell without one | `cue clunk` with no `at=` |
| E119 | Conflicting rules or locks | two locks on one door with different keys |
| E120 | A state or rule the Fizz 1 export cannot say | a door that starts open; a state with three values |
| E121 | A `when` rule or a `string` the Fizz 1 export cannot say | any rule that is not a standard lock |
| E122 | `floor solid` in a Fizz 1 export | the Fizz 1 script cannot set `floor_solid` |
| E123 | A Fizz 2-only object in a Fizz 1 export | a placed `light`, a `switch`, a custom enemy or item |
| E124 | A `toggle` on a state with more than two values | `toggle lift-mode` |
| E125 | An `attach=` to something that cannot carry a light | `attach=lamp-1` (a light) |
| E126 | A `group=` that no rule names, or a `cleared group=` no object belongs to | `cleared group=gaurds` |
| E130 | A level definition whose name a world definition already uses | `state alarm` defined twice |

| Code | Lint | Why |
| --- | --- | --- |
| W101 | A door's bound state starts open | Usually a mistake; sometimes a puzzle (`allow W101`) |
| W102 | An exit cell with nowhere to stand in front of it | The exit takes a fresh Up press while Ben stands on the ground (#145, provisional) |
| W103 | A Fizz 1 level that needs a wall-kick | The owner's rule: Fizz 1 target levels are made without the kick (D47, Q26); a design rule, not physics |
| W104 | An `at=` position snapped to a cell centre in a Fizz 1 export | The export moved something |
| W105 | Head room: a passage, jump or under-shelf pick-up that a different body height changes | Ben's body is 0.7 by 1.4 tiles today and 0.8 by 2.0 on the pose-workshop trial (`7b948ae`) |
| W106 | A feature the current game build cannot run yet | Fizz 2 runs only locks today (#140) |
| W107 | A word wider than the DOS frame at caption size | The game does not check a caption's width (#138) |
| W108 | A state nothing binds to or tests, or a state no rule changes | Dead state |
| W109 | A reserved word that is shown but not baked | `theme` until F3, `music` |
| W110 | A Fizz 1 export changes behaviour without losing data | The exit enters on touch in Fizz 1; Fizz 2's look is replaced by the Fizz 1 level table's theme |
| W111 | More lights could be in view than the game lights, or the lights' frame cost is over the DOS budget | 16 active from a pool of 32 (#146) |
| W112 | A Fizz 1 field ignored in a Fizz 2 file | `ground=` |
| W113 | A rule that can never fire: its input names an object a condition rules out, or a state value nothing sets | `when state alarm becomes on` with no rule that sets it |

Every code has a test that produces it, added in the same change as the code (`TESTING.md` section 7).

### Lowering to Fizz 1

Exporting a Fizz 2 level to the Fizz 1 script is a lowering followed by the lossy check. It is never a conversion: the Fizz 2 level stays the source.

| Fizz 2 | Fizz 1 | Check |
| --- | --- | --- |
| `map` | `blocks` fills, one per run of a letter in a row | Exact: tile ids are shared |
| `at=` off a cell centre | The nearest cell centre | W104 for each moved object |
| `key-red`, `key-blue`, snacks, `soda` | The same item words | Exact at a cell centre |
| `chicken ... dir=D` | `gloop x=X y=Y dir=D` | Exact; Fizz 1 has no cluck, which is presentation |
| `lock red-door key=red` or `lock blue-door key=blue`, or its exact expansion, on that colour's door | Nothing: Fizz 1's red and blue doors open with their keys on their own | Exact |
| A two-valued state with no rules, bound to nothing Fizz 1 has | `channel N on\|off` for its start value | Exact, for the channels Fizz 1 has |
| Any other state, binding or rule | — | E120 or E121: Fizz 1 has on/off channels and three key colours, not states with rules. Which Fizz 1 props (`switch`, `press`, `target`) could carry a simple switch rule is open (Q25) |
| A door whose state starts open | — | E120 |
| `string`, `word`, `cue` | — | E121 |
| `floor solid` | — | E122 |
| `light`, `switch`, a custom enemy or item | — | E123 |
| Death resets the level | Fizz 1 reloads the level on a death | Same outcome |
| The exit needs Up | The exit is entered on touch | W110 |
| The theme, panels, the oblique look, night | The look the Fizz 1 `LEVELS` row gives the `id=` | W110; dropped |
| A climb that needs a wall-kick | Fizz 1 target levels are made without it | W103 |

The editor runs this check before every export and shows it in the Checks window ([EDITOR.md](EDITOR.md#13-the-fizz-2-target-planned)).

### Converting a Fizz 1 level to Fizz 2

**Convert to Fizz 2** writes a new `script fizz2 0` level into a chosen world project from a Fizz 1 script, and opens it with a **conversion report**. The Fizz 1 file is never changed.

- The tiles come from the level rasteriser, which agrees with the game on every tile of all 16 Episode 1 levels, written as a `map` block. Tiles with no Fizz 2 meaning keep their reserved letters and are listed.
- Items become objects with generated ids and `at=` at their cell centres; `gloop` becomes `chicken`. Every other enemy and prop kind is listed as dropped, with the suggestion of a custom definition where one would do ([SCRIPTING.md](SCRIPTING.md)).
- The red and blue doors become `lock` lines; Fizz 1 `channel` lines become two-valued states.
- `hover`, `room`, `secret-room`, `arena`, ladders and vines are listed as dropped (Fizz 2 has not ported lifts, rooms, ladders, vines or mantles).
- The report has four lists (carried over exactly, approximated, dropped, and to check) and runs W102 (exits reached by a jump) and W105 (head room). The wall-kick needs no check: Fizz 2 has it (D47).
- With **Use Fizz 1 art**, the new level draws with the world's retro art set ([WORLD.md](WORLD.md#5-the-retro-art-set)); it still plays by Fizz 2's rules and physics.

### Targets and capabilities

A **target profile** describes one game the studio can build for, as data, and a level is bound to one for life:

| Part | Fizz 1 profile (`fizz1`) | Fizz 2 profile (`ep2`) |
| --- | --- | --- |
| Dialect | The Fizz 1 script (no `script` line) | `script fizz2 0` |
| Project | A folder of Fizz 1 scripts | A world project ([WORLD.md](WORLD.md)) |
| Lowering | `toRust`: `Builder` calls in `levels.rs` | `LEVL` 2 and the world pack, through `fizz-bake` |
| Content tables | `tables.ts` (tiles, items, kinds, segments, level ids, themes, areas), `SPRITE_NAMES` | The legend, object kinds, snack kinds, keys, effects, captions, styles, themes, sprite sets, plus the world's own definitions |
| Limits | The Builder's (bounds, E013) | 32 rules, 32 states of up to 8 values, 32 strings, a 48-byte name, `u16` sizes, the behaviour step budgets |
| Physics parameters for lints | Fizz 1's body and jump; the wall-kick treated as unavailable for new levels (D47) | Ben's body (0.7 by 1.4 today), the jump (about 3.5 tiles), the pogo (6.6 tiles held), the wall-kick |
| Views | The flat grid | The oblique Game view, with the flat grid as an editing aid |
| Budgets | None checked | The floppy budget, the section limit, lights, behaviour cost ([EDITOR.md](EDITOR.md#budgets)) |
| Capabilities | One state per feature | One state per feature |

Each **capability** has one of four states in a profile: **built** (lowers and runs), **accepted** (lowers, but the current game refuses or ignores it: W106 or W109), **reserved** (parses and shows, not lowered) or **absent** (E102). A profile is generated from the game's own tables wherever the game publishes them (F2), so a feature that lands in the game changes one row of data and no studio code. Because a level's target is fixed, the editor offers only the target's capabilities; it does not grey out the other game's.

**Later episodes.** Episode 3 reuses Fizz 2's simulation (the Fizz 2 repository's `CLAUDE.md`), so it is planned as a third profile, `ep3`, on the `fizz2` dialect family, with Episode 3's own content tables published by its repository:

1. The `script` line names the **dialect** and its **version**. A new version adds words; it never changes what an old word means. A profile lists the dialect versions it accepts, and an unknown version is E101.
2. Content is a **profile's tables and the world's definitions**, never grammar: a new tile, enemy, effect or theme is a table row or a definition, not a new statement.
3. A world project names its profile (`target=` in `world.fizz`), fixed at creation; an Episode 3 world is a new world, and moving a Fizz 2 level into it is a conversion with a report, as converting up from Fizz 1 is.
4. A word whose meaning differs between profiles is a row in the capability matrix with its own check.

#### The capability matrix

Built means built in that game today; a change request number means the owner's design, waiting on that Fizz 2 change; a pull request number means provisional on an unmerged change.

| Feature | Fizz 1 | Fizz 2 | Studio check |
| --- | --- | --- | --- |
| Terrain runs, `crystal`, `pogo-cache`, stairs, `vine-nook`, `scatter` | Built | Absent | E102 |
| Tile fills (`blocks`, `paint`) | Built | Absent; the `map` replaces them | E102; Convert to Fizz 2 writes a map |
| `map` grid | Absent (lowered to fills) | Built | Lowered on export |
| Tiles: empty, fill, block, one-way, spike, choc, slopes, red and blue doors, exit, back wall | Built | Built (choc and slopes have no letter or drawing yet) | Legend |
| Tiles: green door, bridge, conveyors, gates, vine, rungs, cracked, murals, crystal tile, overworld tiles | Built | Absent (reserved letters) | E102 |
| Items: cheezie, choc, cookie, soda, red and blue keys | Built | Built | — |
| Items: green key, USB | Built | Absent (HUD sprites exist) | E102 |
| `chicken` (Fizz 1's gloop) | Built as `gloop` | Built | Lowered |
| Fizz 1's other enemies and props | Built | Absent; custom definitions instead | E102 |
| Custom enemies and items with behaviour scripts | Absent (Fizz 1 roster only) | F16, F17 | E208, E123 |
| Lifts (`hover`), rooms, secret rooms, the boss arena | Built | Absent | E102 |
| Ladders, vines, mantle | Built | Absent (not ported) | E102 |
| Wall-kick | Built in the game; not relied on by new Fizz 1 levels (D47) | Core, always on: F9 (today's Fizz 2 leaves it out) | W103 for Fizz 1 |
| `at=` exact positions | Absent (snapped) | Built | W104 |
| `floor solid` | Absent from the script | Built | E122 |
| States with value sets, bindings, rule inputs | On/off channels and keys only | F11 (today: two lock records, #140) | E120, E121, W106 |
| `lock` | Hard-wired red and blue doors | Sugar for a state, a binding and a rule | Exact for the standard doors |
| Switches | Built (`switch` and other props) | F11 (kind 6 reserved) | E123 |
| Level strings, floating words, cues raised by rules and objects | Absent | Records exist (#138); F11, F18 | E121, W106 |
| Placed lights | Absent | F12 (today: constants, #146) | E123, W111 |
| Death | Reloads the level | Resets the level (#140) | — |
| Exit | Touch | Up press while standing (#145) | W102, W110 |
| Ben's body | 0.7 by 1.4 | 0.7 by 1.4; 0.8 by 2.0 on the trial (`7b948ae`) | W105 |
| Theme | From the `LEVELS` row by `id=` | The world's; F3 (today: constants) | W109 |
| Oblique ground | Absent (flat) | The default look: F13 (built for the slice, #143) | Game view |
| Parallax | Per theme in the renderer | Bitmap panels: F19 (today: procedural layers, #144) | Game view |
| Night | A player option | A player option (#146) | Game view |
| Retro art (Fizz 1 sprites in a Fizz 2 world) | — | F20 | Art only |
| Overworld | Built (scripts, points, unlocks) | Absent | E102 |
| Level sprites on overworld points | Planned (ENGINE-CHANGES E10) | Absent | — |

## What v0 does not cover

- **Arbitrary Rust.** Levels in `levels.rs` that use loops over computed positions, closures such as `let y = |k| ...`, constants, `if` or `.find(...)`, or `b.ground_at(...)` to place things, cannot be written. Skimming the rest of `levels.rs` finds these in several levels (closures that compute a crystal row from `k`, `.find(...)` over the map, `b.ground_at(...)` as an argument); a v0 script is a flat list of literal calls. (Plain `for x in [..] { b.crys(x) }` loops are covered by lists.)
- **Direct field and map access.** `b.map.set(...)` on its own (a single tile is `paint`), `b.map.floor_solid`, a platform's phase `ph`, direct writes to `b.x`, `b.ground`, `b.h_at`, and the low-level `col` and `set_h`.
- **Computed placement.** `pogo_cache` is covered, but nothing that derives a position from the ground at run time except `crystal` and ground-based enemies.
- **Ground-based items.** `Builder::item` takes explicit cells only.
- **Overworld registry.** Overworlds are scripts (see above), but the game builds one overworld, so several need a registry like the level table.
- **Registering a new level.** The exporter writes the function only. A new level still needs its id constant, `LEVELS` row (theme, area, icon), `LEVEL_COUNT` and the function pointer by hand; `id=` must name an existing constant.
- **Removing or moving things as edits.** `clear` clears tiles; there is no edit that deletes an item or an enemy.
- **Reordering by section.** If a level depends on the order of overlapping map writes you must write the statements in that order.
- **Fractional or computed item cells, zero-item rows, negative `by`, reversed fills.** All rejected or inexpressible.
- **Whitespace-insensitive layout, includes, macros, variables.** None in v0.
- **Proof coverage.** All 16 levels and the overworld, written as scripts, rebuild the game's data exactly, including each level's fingerprint (`scripts/prove-all.sh`). That shows the language can say them, not that the scripts read well: only Crater Fields is hand-written, and the other 15 are fills written by `tools/decompile-level.ts`. Statements no real level uses (for example `walls` with `terrain` helpers beyond Crater Fields, `vine-nook`, `belt-r`) are covered by unit tests and one compile-and-run smoke test.
