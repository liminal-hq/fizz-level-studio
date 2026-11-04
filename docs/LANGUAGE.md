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

Lieutenant Fizz 2 bakes its levels from `.fizz` sources, so the language gains a dialect. **None of this is built in `packages/language` yet.** The Fizz 2 repository has not written the dialect's grammar either: its `docs/FAP.md` ("The baker") says only that levels are written "in the Fizz 2 dialect of the Level Studio script, committed as `assets/levels/*.fizz`: a `map` grid of letters, `at=X,Y` for exact centres and `chicken` as an object kind", and that the grammar is not yet specified. There is no `fizz-script` crate, no `fizz-bake` tool, no `.fizz` file and no error code in that repository today (checked on `main` at `ba1ec8e` and on the open level pull requests #137, #138 and #140). What does exist there is the data a script must produce: the `LEVL` section and its object, rule and string records, read by `fizz-pack` and built into a world by `fizz-ep2`.

So this section is two things, kept apart:

- **The data model,** taken from the Fizz 2 repository and cited. Where it comes from an unmerged pull request it is marked **provisional**.
- **The syntax,** which is this studio's proposal for the grammar the Fizz 2 repository has not written. When `fizz-script` and `fizz-bake` exist, they are the authority: where this section and they disagree, they win, and this page is corrected in the same change.

The target and capability model that decides which words a level may use is in [Targets and capabilities](#targets-and-capabilities) below; the editor's side is in [EDITOR.md section 13](EDITOR.md#13-the-fizz-2-target-planned).

### A superset in text, not in meaning

- The first line of a Fizz 2 file is `script fizz2 0`: the dialect's name and its version. A file without it is a Fizz 1 script, and everything above in this document still holds for it.
- **Every Fizz 1 script parses and prints in either target.** Only the words the chosen target can build **lower** to a level, so a Fizz 1 statement that Fizz 2 has no equivalent for (`terrain`, `scatter`, `hover`, `room` and so on) is valid text and an error (E102) only when lowering for Fizz 2.
- **The games diverge in meaning.** Fizz 2 is not Fizz 1 with more words: the same word can behave differently (the exit needs an Up press in Fizz 2 and a touch in Fizz 1; a door is a channel in Fizz 2 and a tile the key rewrites in Fizz 1; Fizz 2 has no wall-kick), and each game has content the other lacks. The [capability matrix](#the-capability-matrix) lists every divergence the studio knows of, and each one has a check.
- The parse is lossless: bad lines stay in the AST, comments and blank lines are kept, and a parsed file prints back unchanged. The canonical printer is planned as `fizz-bake fmt` (`docs/FAP.md`), and the studio's printer must agree with it byte for byte.
- The compile pipeline is parse (lossless AST), resolve (names to indices), validate, lint, lower to a `LEVL` section, then re-read the result through `fizz-pack`'s `LevelView` and `fizz-ep2`'s `world_from_view` as a check.

### What a Fizz 2 level holds

This is the whole of what a baked Fizz 2 level can say today. Every field below is something the author sets, directly or through the map.

| Part | Data (`LEVL`, `crates/fizz-pack/src/level.rs`) | Source | Status |
| --- | --- | --- | --- |
| Size | `w`, `h` (`u16`, at least 1) | `level "Name" WxH` | Main |
| Name | Up to 48 bytes of printable ASCII; for banners and the manifest, never read by the rules | The quoted name on `level` | Main |
| Start | `spawn_x`, `spawn_y` (`f64`): the lower-left corner of Ben's body, in tiles | `start X,Y` | Main |
| Floor | `floor_solid` (0 or 1): whether the bottom edge of the map is solid | `floor solid` or `floor open` | Main |
| Start state of the channels | `switches` (`u32`): a set bit means the channel is on, which for a door means closed | `channel LIST on\|off` | Main; the start state is level data from #140 (`fa1872c`, provisional) |
| Tiles | `w * h` tile ids, row 0 (the bottom) first | The `map` block | Main |
| Objects | 32-byte records: `kind`, `sub`, `flags`, `channel`, `x`, `y`, `p` | Object lines | Main (`kind` 1 to 4) |
| Rules | Up to 32 records of 32 bytes | `lock` and `when` lines | Records from #138 (`c64c103`), locks from #140; provisional |
| Strings | Up to 32 records of 32 bytes: length 1 to 30, a style, UTF-8 text | `string` lines | #138; carried but not yet drawn; provisional |

The section's decoded length is exactly `32 + pad8(name_len) + 32 * (objects + rules + strings) + w * h` (`docs/FAP.md` on #138). The slice level is 1,968 bytes with its two lock rules (#140).

**Not level data today.** The theme and its background (back-wall material, parallax stack, horizon), the oblique projection, the night look and its lamps and lanterns, the music, the sky and night settings and the exit rule are all constants in the Fizz 2 code or player settings (#142 to #146). Both `docs/OBLIQUE.md` and `docs/LIGHTS.md` say "a later level and theme format will carry them; nothing here defines one". The dialect reserves the words for them (see [Theme, look and lights](#theme-look-and-lights)) and lowers nothing until that format exists.

### The header

```text
script fizz2 0
level "Lighthouse Point" 32x48 id=light-1
theme lighthouse                     // reserved: checked against the target's theme table once it has one
start 2,2                            // the lower-left corner of Ben's body
floor solid                          // or `floor open`; the default is open, as the slice is
channel 1,2 on                       // the start state: both doors closed
```

- `level` keeps the Fizz 1 shape. `id=` is the level's slug, used for its file name and for the pack's manifest; the `LEVL` section stores no id. `ground=` is a Fizz 1 field (the terrain helpers' ground height): it is optional in a Fizz 2 file and ignored, with W112, when it is given.
- `start X,Y` is the spawn in tile units and may be fractional. Note the different reference points: Ben's start is the lower-left corner of his body, while an item's `at=` is its centre (see [Positions](#positions-xy-and-at)).
- `floor solid` sets `floor_solid`. It is a header word, not an object (an earlier draft of this page listed `floor` among the objects). The Fizz 1 script cannot say it, so a Fizz 1 export of `floor solid` is E122.
- `channel LIST on|off` sets the start state, as in Fizz 1. Channels are 0 to 31 (`MAX_CHANNELS`, #138); only channels 1 and 2 have tiles that respond today (the red and blue doors, fixed in the tile property table of `crates/fizz-ep2/src/tiles.rs`), so a channel no tile or rule reads gets W108.

### The map block

A Fizz 2 level's tiles are drawn as a grid, top row first, which is how the slice level itself is written (`ROWS` in `crates/fizz-ep2/src/level.rs`).

```text
map
  |......................b........B|  40
  |....................E.b........B|  39
  |#..............B===============#|  37
  |###############Bwwwwwwwwwwwwwww#|  36
```

- Each row sits between `|` bars and has exactly `w` characters, with an optional row label giving its `y`. There are exactly `h` rows. `y` still counts up from the bottom as everywhere else: the last row of the block is row 0.
- **The legend** maps a letter to a tile id. It comes from the target profile, not from the file, so the palette, completion, the printer and the baker read one table. The letters the slice uses, with their ids from `tiles.rs`:

| Letter | Tile | Id | Meaning |
| --- | --- | --- | --- |
| `.` | `EMPTY` | 0 | Open air: shows the theme's sky and parallax |
| `#` | `FILL` | 1 | Solid fill; drawn as stone, deep stone three tiles from any opening |
| `B` | `BLOCK` | 2 | A solid block; drawn as brick |
| `=` | `PLAT` | 3 | A one-way platform; drawn as planks |
| `^` | `SPIKE` | 4 | Spikes: lethal |
| `D` | `DOOR_R` | 12 | The red door, switched on channel 1 |
| `b` | `DOOR_B` | 13 | The blue door, switched on channel 2 |
| `E` | `EXIT` | 17 | The exit doorway |
| `w` | `WALLBG` | 30 | Interior back wall; not solid; drawn in the theme's back-wall material |

- Fizz 2's tile table also has `CHOC` (5) and the six slopes `R45`, `L45`, `R22A`, `R22B`, `L22A`, `L22B` (6 to 11). They have ids and tile properties, but no letter is fixed for them in the Fizz 2 repository, and the oblique renderer draws only the letters above (its `CLASS` table in `crates/fizz-slice-view/src/oblique.rs` on #143; hills are specified in `docs/OBLIQUE.md` on #142 but not built). The studio proposes `~` for `CHOC` and `/`, `\`, `r`, `R`, `l`, `L` for the slopes, as the earlier plan recorded; they stay provisional until the Fizz 2 repository fixes them (open question Q11).
- **Fizz 2 tile ids are Fizz 1's.** Every id above has the same number in Fizz 1's `tiles.rs` (`EXIT` is 17 and `WALLBG` 30 in both), so the legend can reserve a letter for every Fizz 1 tile that has no Fizz 2 meaning yet (`bridge`, `conveyor-l`, `gate`, `vine`, `rung` and the rest). A reserved letter parses and prints, shows in the palette greyed out, and is E102 when lowering for Fizz 2. A tile id the target's table does not hold is E104.
- The texture a tile gets is chosen by its letter and its neighbours, not by authored flags (`docs/OBLIQUE.md`, "Faces come from tile class and neighbours", #142). An author therefore chooses `#` or `B` for how it looks as well as for what it does.

### Positions: `x=`/`y=` and `at=`

- `x=`/`y=` name a cell, and the object sits at its **centre**, as in Fizz 1.
- `at=X,Y` is an **exact** position in tile units, for an object off a cell centre. The slice needs it: the red key is at (2.5, 11.7) and the hanging cheezies at y 40.2 (`level.rs`), so a key can rest on a plank's fascia rather than float at a cell centre.
- **The printer rule:** the printer writes `x=`/`y=` only for an exact cell centre and `at=` for everything else, so the same position always prints the same way.
- **What the point means depends on the kind.** A key or a snack's point is its centre. A chicken's point is the spawn Fizz 1's builder takes (`CHICKEN = (8.0, 11.0, -1.0)` is its x and its feet on the ledge at `y = 11`). Ben's `start` is his body's lower-left corner. The Inspector says which one a field is.
- Every centre must lie in the map (`0 <= x < w` and `0 <= y < h`), as `LevelView::new` refuses otherwise (E108).

### Objects

```text
objects
  key-red  id=red-key   at=2.5,11.7
  key-blue id=blue-key  at=24.5,42.7
  cheezie  id=hang-1    at=25.5,40.2
  choc     id=shelf-choc at=26.5,42.7
  soda     id=floor-can at=28.5,38.7
  chicken  id=hen       at=8,11 dir=-1
```

| Word | `kind` | `sub` | Notes |
| --- | --- | --- | --- |
| `key-red` | 1 | 0 | At most one red key per level (`SecondKey`, #137) |
| `key-blue` | 2 | 0 | At most one blue key per level |
| `cheezie`, `choc`, `cookie` | 3 | 0, 1, 2 | Snacks: 1, 2 and 5 points |
| `soda` | 3 | 3 | The soda can: five more shots, no points (`SODA_AMMO`) |
| `chicken` | 4 | 0 | Fizz 1's gloop, with `dir=` -1 or 1 stored as `p` |

- The words are Fizz 1's item words where the thing is the same (`key-red`, `cheezie`, `soda`), so a Fizz 1 reader knows them. `key-green` and `usb` are Fizz 1 items with no Fizz 2 object yet: a green key is refused by `fizz-ep2` (#140), although the HUD has its sprite (`hudkey_green`, `hudkey_gold`). Kinds 5 to 7 are reserved in `fizz-pack` for a gadget, a switch and a generic enemy and refused by `fizz-ep2`; the enemy roster with its animation states is planned (`enemy-roster` in the Fizz 2 roadmap).
- **`id=` is required** on every object. It is a source-level name only: the `LEVL` record has no id field. The baker resolves each id to the object's **index**, which is what a rule's `subject` holds (a `take` names a key or snack by index, a `stomp` a chicken by index). Because rules point at indices, the editor never lets a person reorder objects by hand, and renaming an id rewrites the rules that name it in the same undo step.
- Objects are **stably sorted by kind**, ties keeping file order (`SourceError::KindOrder`, #137), because the state hash indexes snacks and chickens by position. The printer groups them by kind in the `objects` section, so the order a reader sees is the order the level is built in.
- `flags` and `channel` are zero on every object today; the game refuses anything else.
- Fizz 1's file-order rule still governs overlapping tile writes in a Fizz 1 script; a Fizz 2 map has no overlapping writes.

### Locks

A door is a tile, not an object. `DOOR_R` reads channel 1 and `DOOR_B` channel 2, fixed by the tile property table, and a door is solid while its channel is on. A **lock** is the rule that opens one (trigger 1 in the rule table, #140, provisional):

```text
lock red-door key=red at=15,21       // the red key opens the door whose tile is at 15,21
lock blue-door key=blue at=22,39
```

- The baker writes a lock record with the key colour as its `subject`, the channel read from the tile at `at=` and the event cell `at=`. `at=` must be a cell of a switched tile whose channel the lock can turn off (E110).
- It fires when Ben holds the key, the tile in front of him at body height is a switched tile on that channel, and the channel is on: the channel goes off, the key is spent and `DoorOpen` is raised. Locks run in table order.
- Only `key=red` and `key=blue` can be built; `key=green` is E102 for the current Fizz 2 profile.
- A lock has no guard, delay, repeat, rectangle or cue of its own; the door's sound and caption come from the game's event table.

### Rules

The other triggers share the rule table with locks. **None of them runs yet**: `fizz-ep2` refuses every trigger but the lock (`RuleError::Trigger`, #140), so a level that uses one is valid in the dialect and gets W106 ("the current Fizz 2 build cannot run this rule") until the game enables it.

```text
string welcome "Mind the spikes" style=yellow
when enter x=1..14 y=2..3 then channel 3 on at=15,21, cue clunk caption=clunk at=15,21
when take id=floor-can then cue soda caption=welcome at=28,38
when time at=60 every=120 repeat then channel 4 toggle at=10,10
when stomp id=any if channel 3 on then channel 3 off at=15,21
```

The shape is `when <trigger> [if channel N on|off] [after=TICKS] then <action>[, <action>] [repeat]`:

| Part | Values | Record field (#138) |
| --- | --- | --- |
| Trigger | `start`; `enter x=RANGE y=RANGE`; `take id=ID` (a key or snack); `shoot x=RANGE y=RANGE`; `stomp id=ID\|any`; `stun id=ID\|any`; `time at=TICKS [every=TICKS]` | `trigger` 2 to 8, `subject` (an object index, a key colour, or 0xFF for any), the rectangle or `at` and `every` |
| Guard | `if channel N on` or `if channel N off` | `flags` `GUARD`, `GUARD_ON`; `guard_ch` |
| Delay | `after=TICKS` | `delay` (`u16` ticks) |
| Channel action (slot A) | `channel N on\|off\|toggle at=X,Y` | `op`, `channel`, the event cell |
| Cue (slot B) | `cue EFFECT [caption=CAPTION] at=X,Y`, or `caption=CAPTION at=X,Y` alone | `effect` (0xFF for none), the caption code, the cue cell |
| Repeat | `repeat` | `flags` `REPEAT` |

- **At most one channel action and one cue per rule.** A cue is an effect and a caption together. A used slot needs its cell (E118), and every cell and rectangle must lie in the map (E117).
- **Time rules:** `at` is at least 1 tick; `every` is 0 or at least 6 (`MIN_PERIOD`); `repeat` is written exactly when `every` is not 0 (E114).
- **Effects** are the game's effect ids by name: `cluck0` to `cluck3`, `fzzt`, `stun`, `bonk`, `hurt`, `win`, `key`, `clunk`, `plink`, `boing`, `jump`, `crunch`, `soda` and `door` (0 to 14, 17 and 19 in `crates/fizz-ep2/src/cues.rs`, `eb9b1db` on #140; 15, 16 and 18 are alternates no event plays and are not offered). **Shared captions:** `fzzt`, `click`, `fizzled`, `bonk`, `whoa`, `tada`, `red`, `blue`, `green`, `clunk`, `boing`, `crunch`, `fsssht` (0 to 12). Anything else names one of the level's own strings. An unknown name is E116.
- **Strings:** `string NAME "text" [style=STYLE]`, up to 32 per level (E112), 1 to 30 bytes of ASCII plus the few typographic marks the game allows (the middle dot, the en and em dashes, curly quotes and the ellipsis), in one of seven styles: `white`, `cyan`, `red`, `green`, `blue`, `yellow`, `grey`. A caption's width on screen is not checked by the game; the editor shows it at the game's caption size (W107 when it would not fit the 320-pixel DOS frame).
- **Compiled at bake time into fixed 32-byte records.** There is no virtual machine on DOS and no rule text on the device. The planned order of evaluation is after the player, the chickens and the shots have moved, in table order.
- **Limits:** 32 rules per level, counting locks (E111); 32 strings; channels 0 to 31 (E113).
- **Lint W101** warns when a door's channel starts off, that is, when a door starts open. A level that means it says `allow W101` with a comment saying why. Planned: the baker's `check` fails on any warning without an `allow`.
- **What a death resets.** A death resets the level exactly as starting it does: channels go back to the `channel` start state, keys come back and leave Ben's hands, snacks and cans come back, ammo returns to five, chickens and shots start over; only the death count and the tick go on (owner decision, 2026-10-30, built in #140 and recorded in Fizz 2's `docs/FIZZ1-DIFFERENCES.md`). Start and time rules re-arm. This settles the earlier planner question of channels persisting over a death: they do not.

### Theme, look and lights

The Fizz 2 look is chosen per level by its theme: interior `w` cells take the theme's back-wall material, open-air `.` cells its parallax stack, and at night the theme's ambient and lamps (`docs/OBLIQUE.md` "Backgrounds and parallax", #144; `docs/LIGHTS.md`, #146; provisional). Today the only theme is the slice's Lighthouse night, written as constants in `crates/fizz-slice-view/src/oblique.rs` (four parallax layers at factors 10, 15, 31 and 46 out of 256, the horizon row, lantern and lamp cells, a night ambient of 6, the beam). The projection itself (a 26-pixel ground strip, a depth of 10 pixels, the feet line on the collision top) is global, not per level.

The dialect therefore **reserves** these words and lowers none of them until the Fizz 2 repository defines the level and theme format:

| Word | Means | Until the format exists |
| --- | --- | --- |
| `theme NAME` | The level's theme: back wall, parallax stack, horizon, night ambient | Accepted when `NAME` is in the target's theme table (only `lighthouse` today), drawn in the preview, not baked (W109) |
| `light KIND at=X,Y` | A placed lamp or lantern | Parsed and shown, not baked (W109); the slice's lamps sit on fixed cells in code |
| `music NAME` | The level's song | Parsed, not baked (W109); there is no per-level music field |

Night, the Sky detail and Up-to-enter are not level words: Night and Sky are player settings (`FIZZ2.CFG`, `/NIGHT`, `/SKY:AUTO|FULL|LIGHT`, #144 and #146), and the exit rule is global (#145). Lights that follow objects (the door badges, the exit glow, Ben's lantern, the shots) are derived by the game and need no authoring.

### Errors and lints

- **E001 to E016** keep their meaning (the table above) and are reused. Fizz 2 errors report `path:line:col` and a stable code, as `docs/FAP.md` requires of the baker.
- **E1xx** are the dialect's. The table below is the studio's proposed numbering for the checks a Fizz 2 level needs; the Fizz 2 repository has assigned none yet, and if `fizz-script` numbers them differently its numbers are used and this table is corrected. E119 to E122 and W101 and W104 are the numbers the approved plan named.

| Code | Meaning | Example |
| --- | --- | --- |
| E101 | The `script` line names a dialect or version no installed target profile accepts | `script fizz2 7`: no profile accepts dialect version 7 |
| E102 | The word has no equivalent in the target and cannot be lowered | `hover from=...`: Fizz 2 has no lifts yet |
| E103 | A `map` row's width differs from `w`, or the row count from `h` | row 37 has 31 characters, the level is 32 wide |
| E104 | A map letter, or a tile id, that the target's legend does not hold | unknown map letter `Q` |
| E105 | An object without `id=`, or two objects with one id | `cheezie at=3,4` has no `id=` |
| E106 | A reference names no object, or one of the wrong kind | `take id=hen`: a chicken cannot be taken |
| E107 | A second key of one colour | a second `key-red` |
| E108 | A start or object centre outside the map | `at=32.5,4` in a 32-wide level |
| E109 | A field value the record cannot hold | `chicken ... dir=0` (must be -1 or 1); a name over 48 bytes |
| E110 | A lock's `at=` is not a door tile on a channel the lock can open | `lock red-door at=3,4` on a block |
| E111 | More than 32 rules, locks included | the 33rd rule |
| E112 | A string or name problem: over 32 strings, length outside 1 to 30, a character the game cannot draw, an unknown style | a string of 31 bytes |
| E113 | A channel outside 0 to 31 | `channel 32 on` |
| E114 | A time rule out of range | `every=3` (at least 6), or `every=` without `repeat` |
| E115 | More than one channel action or more than one cue in a rule | two `channel` actions |
| E116 | An unknown effect, caption or string name | `cue squeak` |
| E117 | A rule's cell or rectangle outside the map | `enter x=30..40` in a 32-wide level |
| E118 | A used action slot without its cell | `channel 3 on` with no `at=` |
| E119 | Conflicting rules or locks | two locks on one door with different keys |
| E120 | A lock the Fizz 1 export cannot say | a lock on a channel other than the door's own |
| E121 | A `when` rule or a `string` in a Fizz 1 export | Fizz 1 has no rule layer |
| E122 | `floor solid` in a Fizz 1 export | the Fizz 1 script cannot set `floor_solid` |
| E123 | A Fizz 2-only object kind in a Fizz 1 export with no Fizz 1 kind | none yet; reserved for the enemy roster |

| Code | Lint | Why |
| --- | --- | --- |
| W101 | A door channel starts off (the door starts open) | Usually a mistake; sometimes a puzzle (`allow W101`) |
| W102 | An exit cell with nowhere to stand in front of it | The exit takes a fresh Up press while Ben stands on the ground (#145, provisional), so an exit reached only by a jump or a bounce cannot be used |
| W103 | A climb that only a wall-kick could make: a shaft taller than the target's jump and pogo reach with no ledge | Fizz 2 has no wall-kick (owner decision, 2026-10-30). A design rule like the gap rule, not physics; the real answer is the playtest bot |
| W104 | An `at=` position snapped to a cell centre in a Fizz 1 export | The export moved something |
| W105 | Head room: a passage, jump or under-shelf pick-up planned for one body height that a different body height changes | Ben's body is 0.7 by 1.4 tiles today and 0.8 by 2.0 on the pose-workshop trial (`7b948ae`); a 2.0-tile body covers three rows at any fractional height, so a two-high passage over a slope blocks and a jump in a two-high tunnel bumps at once |
| W106 | A rule the current Fizz 2 build cannot run | Only locks run (#140); the rest are refused at load |
| W107 | A caption wider than the DOS frame at the game's caption size | The game does not check a caption's width (#138) |
| W108 | A channel no tile and no rule reads | Only channels 1 and 2 have tiles today |
| W109 | A reserved word that is shown but not baked | `theme`, `light` and `music` wait for the Fizz 2 level and theme format |
| W110 | A Fizz 1 export changes behaviour without losing data | The exit enters on touch in Fizz 1; Fizz 2's look (theme, night lights) is replaced by the Fizz 1 level table's theme for the `id=` |
| W111 | A light-budget breach: more than 15 lights could be in view at once | The game lights at most 16, nearest first, from a pool of 32 (`MAX_ACTIVE`, `POOL`, #146); only meaningful once lights are level data |
| W112 | A Fizz 1 field ignored by the Fizz 2 target | `ground=` on the `level` line |

Every code has a test that produces it, added in the same change as the code (`TESTING.md` section 7).

### Lowering to Fizz 1

Exporting a Fizz 2 level to the Fizz 1 script is a lowering followed by a check. What maps, what changes and what is lost:

| Fizz 2 | Fizz 1 | Check |
| --- | --- | --- |
| `map` | `blocks` fills, one per run of a letter in a row | Exact: tile ids are shared |
| `at=` off a cell centre | The nearest cell centre | W104 for each moved object |
| `key-red`, `key-blue`, snacks, `soda` | The same item words | Exact at a cell centre |
| `chicken ... dir=D` | `gloop x=X y=Y dir=D` | Exact; Fizz 1 has no cluck, which is presentation |
| `lock red-door key=red` and `lock blue-door key=blue` on their own doors | Nothing: Fizz 1's red and blue doors open with their keys on their own | Exact |
| Any other lock | — | E120 |
| `when`, `string` | — | E121; Fizz 1 has no rule layer and no level strings |
| `floor solid` | — | E122 |
| `channel` start state of a door channel (1 or 2) | Nothing: a Fizz 1 door is closed until its key rewrites the tile, and Fizz 1's channels drive gates, not doors | Exact when the door starts closed; a door that starts open (`allow W101`) is E120 |
| `channel` start state of any other channel | `channel LIST on` | Exact; Fizz 2 has no tile that reads it yet |
| Death resets the level | Fizz 1 reloads the level on a death | Same outcome; no check |
| The exit needs Up | The exit is entered on touch | W110 |
| `theme`, `light`, `music`, the oblique look, night | The look the Fizz 1 `LEVELS` row gives the `id=` | W110; dropped |
| Ben's body and the missing wall-kick | Fizz 1's body and wall-kick | None: a level that works without a kick still works with one |

The editor runs this check live when the target is Fizz 1 ([EDITOR.md](EDITOR.md#13-the-fizz-2-target-planned)).

### Converting a Fizz 1 level to Fizz 2

The other direction is a command, not a lowering: **Convert to Fizz 2** writes a new `script fizz2 0` file from a Fizz 1 script, so the person reviews the result as one change.

- The tiles come from the level rasteriser, which agrees with the game on every tile of all 16 Episode 1 levels, written as a `map` block. Tiles with no Fizz 2 meaning keep their reserved letters, and each is listed as E102.
- Items become objects with generated ids and `at=` at their cell centres; `gloop` becomes `chicken`; every other enemy and prop kind (`hopper`, `drone`, `switch` and the rest) is E102.
- `hover`, `room`, `secret-room`, `arena`, ladders and vines are E102 (Fizz 2 has not ported lifts, rooms, ladders, vines or mantles).
- The convert adds `channel` start lines for the doors and a `lock` for each standard door, then runs W102, W103 and W105, because Fizz 1 levels may rely on a wall-kick (Whisper Hollow is built around one) or exit on a jump.
- The Fizz 1 file is never changed.

### Targets and capabilities

The Target is not a two-way switch. A **target profile** describes one game the studio can build for, as data:

| Part | Fizz 1 profile (`fizz1`) | Fizz 2 profile (`ep2`) |
| --- | --- | --- |
| Dialect | The Fizz 1 script (no `script` line) | `script fizz2 0` |
| Lowering | `toRust`: `Builder` calls in `levels.rs` | A `LEVL` section, through `fizz-bake` |
| Content tables | `tables.ts` (tiles, items, kinds, segments, level ids, themes, areas), `SPRITE_NAMES` | The legend, object kinds and snack kinds, key colours, effects, captions, styles, themes, sprite sets (`assets/sprites/*.json`) |
| Limits | The Builder's (bounds, E013) | 32 rules, 32 strings, channels 0 to 31, a 48-byte name, `u16` sizes |
| Physics parameters for lints | Fizz 1's body, jump, wall-kick and the gap rule | Ben's body (0.7 by 1.4 today), the jump (about 3.5 tiles), the pogo (6.6 tiles held), no wall-kick |
| Budgets | None checked | The floppy budget and the section limit (see [EDITOR.md](EDITOR.md#budgets)) |
| Capabilities | One state per feature (below) | One state per feature (below) |

Each **capability** has one of four states in a profile: **built** (lowers and runs), **accepted** (lowers, but the current game refuses or ignores it, so W106 or W109), **reserved** (parses and shows, not lowered) or **absent** (E102). A profile is generated from the game's own tables wherever the game publishes them (`ENGINE-CHANGES.md`, Fizz 2), so a feature that lands in the game changes one row of data and no studio code.

**Later episodes.** Episode 3 reuses Fizz 2's simulation (the Fizz 2 repository's `CLAUDE.md`), so it is planned as a third profile, `ep3`, on the `fizz2` dialect family: the same grammar at a later version (`script fizz2 1`, when the grammar needs to change), with Episode 3's own content tables (its tiles, enemies, cues, themes and sprites) published by its repository. The rules for growing the dialect:

1. The `script` line names the **dialect** and its **version**. A new version adds words; it never changes what an old word means. A profile lists the dialect versions it accepts, and an unknown version is E101.
2. Content is a **profile's tables**, never grammar: a new tile, enemy, effect or theme is a new table row, not a new statement.
3. Which profile a file is checked against is the project's setting (`studio.json`, proposed), with an optional `target ep3` line in the header for a file that differs from its project. Changing the target never rewrites the script.
4. A word whose meaning differs between profiles is a row in the capability matrix with its own check, as the exit does today.

#### The capability matrix

Built means built in that game today; a pull request number means provisional on an unmerged change.

| Feature | Fizz 1 | Fizz 2 | Studio check |
| --- | --- | --- | --- |
| Terrain runs, `crystal`, `pogo-cache`, stairs, `vine-nook`, `scatter` | Built | Absent | E102 |
| Tile fills (`blocks`, `paint`) | Built | Absent; the `map` replaces them | E102 for Fizz 2; Convert to Fizz 2 writes a map |
| `map` grid | Absent (lowered to fills) | Built | Lowered on export |
| Tiles: empty, fill, block, one-way, spike, choc, slopes, red and blue doors, exit, back wall | Built | Built (the oblique renderer draws the slice's letters; choc and slopes have no letter or drawing yet) | Legend |
| Tiles: green door, bridge, conveyors, gates, vine, rungs, cracked, murals, crystal tile, overworld tiles | Built | Absent (reserved letters) | E102 |
| Items: cheezie, choc, cookie, soda, red and blue keys | Built | Built | — |
| Items: green key, USB | Built | Absent (HUD sprites exist) | E102 |
| `chicken` (Fizz 1's gloop) | Built as `gloop` | Built | Lowered |
| Other enemies and props (hopper, marsh, drone, beetle, bat, pod, phantom, roller, sentry, boss, switch, terminal, cage, mirror, swivel, crystal switch, press, target, glyph, cameo) | Built | Absent; kinds 5 to 7 reserved; roster planned | E102 |
| Lifts (`hover`), rooms, secret rooms, the boss arena | Built | Absent | E102 |
| Ladders, vines, mantle | Built | Absent (not ported) | E102 |
| Wall-kick | Built | Absent (owner decision) | W103 |
| `at=` exact positions | Absent (snapped) | Built | W104 |
| `floor solid` | Absent from the script | Built | E122 |
| Channel start state | Built | Built (level data, #140) | — |
| Locks | Hard-wired red and blue doors | Rule records (#140) | E120 |
| `when` rules | Absent | Accepted (records exist, #138; refused at load, #140) | E121, W106 |
| Level strings | Absent | Accepted (carried, not drawn, #138) | E121, W106 |
| Death | Reloads the level | Resets the level (#140) | — |
| Exit | Touch | Up press while standing (#145) | W102, W110 |
| Ben's body | 0.7 by 1.4 | 0.7 by 1.4; 0.8 by 2.0 on the trial (`7b948ae`) | W105 |
| Theme | From the `LEVELS` row by `id=` | Constants; the format is not defined (#144) | W109 |
| Oblique ground | Absent | Global (#143) | Preview only |
| Parallax | Per theme in the renderer | The theme's stack (#144) | Preview only |
| Night and lights | A player option, derived lights | A player option (#146), theme lamps in code, derived lights | Preview only; W111 later |
| Overworld | Built (scripts, points, unlocks) | Absent | Overworld words are E102 for Fizz 2 |
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
