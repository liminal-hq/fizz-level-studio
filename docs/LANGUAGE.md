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

Lieutenant Fizz 2 bakes its levels from `.fizz` sources, so the language gains a dialect. **None of this is built in `packages/language` yet**; it is the approved design, and the Fizz 2 repository's `fizz-script` crate and `fizz-bake` tool are where the rules are first implemented (see [the relationship to the baker](ARCHITECTURE.md#7-fizz-2-and-the-baker-planned)). Where this section and the Fizz 2 repository disagree, the Fizz 2 repository wins, and this page is corrected.

### A superset, not a fork

- The first line of a Fizz 2 file is `script fizz2 0`. A file without it is a Fizz 1 script, and everything above in this document still holds for it.
- **Every Fizz 1 script parses and prints in either target.** Only the Fizz 2 subset **lowers** to a level (the baker's `LEVL` record), so a Fizz 1 statement the game has no Fizz 2 equivalent for (`terrain`, `scatter`, `hover` and so on) is valid text and an error only when baking.
- The parse is lossless: bad lines stay in the AST, comments and blank lines are kept, and a parsed file prints back unchanged. `fizz-bake fmt` is the printer.
- The compile pipeline is parse (lossless AST), resolve, validate, lint, lower to `LEVL` v2, then re-read the result through the game's level view as a check.

### The map block

A level can be drawn as a grid instead of as fills. The example is illustrative; the exact header words and row-label spelling are fixed by the Fizz 2 `fizz-script` package, and this page follows it.

```text
script fizz2 0
level "Light Switch" 16x12 id=light-1
map
  |................|  11
  |..w.........#...|  10
  |..#B==^~E.......|   9
```

- Each row sits between `|` bars and has exactly `w` characters, with an optional row label giving its `y`. `y` still counts up from the bottom as everywhere else.
- A **legend** maps letters to tiles. The letters recorded so far are `. w # B = ^ ~ E / \ r R l L D b +`, which include the **slope** letters (`/` and `\`), and the legend also **reserves** letters for Fizz 1 tiles that have no Fizz 2 id, so a Fizz 1 level opens in Fizz 2 without losing them. Which letter means which tile is fixed by the Fizz 2 tile table and is not copied here until the editor needs it (open question 12 in [DECISIONS.md](DECISIONS.md)).
- It is the most complete legend on purpose: the editor's palette, completion and the printer all read one table.

### Positions: `x=`/`y=` and `at=`

- `x=`/`y=` name a cell, and the object sits at its **centre**, as in Fizz 1.
- `at=X,Y` is an **exact** position, in tile units, for an object that is not on a cell centre (for example one resting on a slope or a floor).
- **The printer rule:** the printer writes `x=`/`y=` only for an exact cell centre and `at=` for everything else, so the same position always prints the same way.

### Objects

- Objects include the Fizz 1 items and enemies that Fizz 2 has, plus `chicken`, `soda` and `floor`.
- **`id=` is required** on every object, and an object's index in the baked level is its position in the sorted order.
- Objects are **stably sorted by kind** (ties keep file order), so the printer groups them and the order a reader sees is the order the level is built in.
- Fizz 1's file-order rule still governs overlapping tile writes; it does not govern the object list.

### Channels, locks and rules

Doors are modelled as state, not as hard-wired colours:

- **Channels are state.** A switched tile reads a channel. `channel 1,2 on` sets the start state explicitly.
- **Keys and items are facts.** A pick-up or a stomp is something that happened, not a stored value.
- **Locks are on the door.** `lock red-door key=red` says that door opens when the player holds the red key (planner recommendation, not yet confirmed: the lock opens the door by turning its channel off, and fires only while the door is closed).
- **Rules** connect the two:

```text
channel 1 off                        // start state, explicit
lock red-door key=red                // the key opens it
allow W101                           // the door channel starts off on purpose
when enter x=1..14 y=5..5 then channel 1 on at=15,21, sound door, caption clunk
```

The shape of a rule is `when <trigger> [if channel N on|off] then <action>[, <action>...] [repeat]`:

| Part | Values |
| --- | --- |
| Trigger | `start`, `enter x= y=`, `take`, `shoot`, `stomp`, `stun`, `time` |
| Guard | `if channel N on` or `if channel N off`, optional |
| Channel action | `channel N on`, `channel N off` or `channel N toggle`, with an optional `at=` cell |
| Cue | `sound X` and `caption Y`, from the shared tables only |
| Flag | `repeat`, optional; without it a rule is expected to fire once |

- **Compiled at bake time into fixed 32-byte records.** There is no virtual machine on DOS and no rule text on the device: the baker lowers each `when` to one record (trigger, flags, guard channel, two parameters, a channel action and a cue) and the simulation runs them as table rows, in table order, after the player, the chickens and the shots have moved.
- **Limits:** 32 rules per level, one channel action and one cue per rule, no delayed actions and no repeating timers.
- **Lint W101** warns when a door's channel starts off. A level that means it says `allow W101` (with a comment saying why), and the baker's `check` fails on any warning without an `allow`. The slice's start-open-then-close red door puzzle is the model case.
- **Persistence.** Channels and which rules have fired are recommended to persist over a death; this is not yet confirmed (see the open questions).

### Errors and lints

- **E001 to E016** keep their meaning (the table above) and are reused as they are. Errors report `path:line:col`.
- **E1xx** are new, for the dialect. Named so far: **E119** (conflicting rules or locks), **E120** (a lock that Fizz 1 cannot say), **E121** (any `when` in a Fizz 1 export), **E122** (a solid `floor` in a Fizz 1 export). The E12x block belongs to the Fizz 1 export check; the rest of E1xx is assigned as the validator is written, and this table is extended in the same change as each test that produces a code.
- **W1xx** are lints: **W101** (door channel starts off) and **W104** (an `at=` position snapped to a cell centre in a Fizz 1 export). Others are assigned as lints are written.

### Lowering to Fizz 1

Exporting a Fizz 2 level to the Fizz 1 script is a lowering followed by a check:

- A `map` becomes `blocks` fills.
- `at=` positions snap to the nearest cell centre, with **W104** for each one that moved.
- `chicken` becomes `gloop`.
- A lock other than the standard keyed red and blue doors is **E120**.
- Any `when` rule is **E121**; Fizz 1 has no rule layer.
- A solid `floor` is **E122**.

The editor runs this check live when its Target is Fizz 1 ([EDITOR.md](EDITOR.md#13-the-fizz-2-target-planned)).

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
