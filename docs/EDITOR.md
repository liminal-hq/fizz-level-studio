# The editor

How Fizz Level Studio behaves, screen by screen, for Fizz 1 and, in sections 13 and 14, for Fizz 2 and the sprites. The source is the design prototype (`design/project/Proto.dc.html`) and its walkthrough (`design/project/Guide.dc.html`, twelve steps). Where the real studio must differ from the prototype, this document says so under **Real studio**. Each behaviour's build status is in `SPEC.md` §10.

## 1. The workspace

The **Ultimate** layout is home: the level is the canvas and fills the window; every other part is a window floating over it. The prototype's starting arrangement, at 1440 × 900:

| Window | Holds | Start position (x, y, w, h) | Minimum size |
| --- | --- | --- | --- |
| Tool rail | Paint, Erase, Pick, Select, Stamp; in a level also Lift, Room, Arena; on an overworld also Point; Pan shown muted | 8, 8, 60, 318 | — |
| Palette / Outliner (tabs) | Every tile, item and enemy kind, grouped terrain, hazards, treats, enemies, objects, then the start, exit and moving-platform markers | 76, 8, 252, 300 | 200 × 120 |
| Objects | The level's objects, or the overworld's points and areas, and the selected one's fields | 336, 196, 420, 300 | 240 × 120 |
| History | Who changed what, with Claude's pending ideas after a Now marker | 336, 8, 560, 120 | 380 × 96 |
| Checks | Start, exit and the playtest bot | 904, 8, 220, 120 | 190 × 96 |
| Lens bar | The lens toggles, the gap rule, and Run playtest bot | 336, 136, 788, 52 | — |
| Inspector | The selected thing: name, position, facing and patrol for enemies, its script line, Show in script, Delete | 1132, 8, 300, 328 | 270 × 220 |
| Review changes / Claude (tabs) | Pending hunks; the mode switch and Ask | 1132, 344, 300, 474 | 270 × 260 |
| Script / Playtest (tabs) | The script, the typed-line box | 76, 570, 600, 248 | 320 × 140 |
| Navigator | The whole level, a frame for what is visible, zoom buttons | 684, 570, 440, 248 | 380 × 200 |

Window behaviour:

- Drag a window by its header. Its edges snap within 8 px to the workspace edges, to an 8 px margin inside them and to the edges of other windows; orange guide lines show what it is locking to.
- Resize by the corner grip, down to the window's minimum size.
- The chevron collapses a window to its 46 px header. Window, Collapse all windows and Expand all windows do it for every window.
- Grabbing a window brings it to the front.
- Window, Reset window layout (Ctrl+Shift+0) restores the starting arrangement. Save layout for this session and Restore saved layout keep one arrangement in memory; nothing is written to disk.
- The script's pop-out button moves the script into its own window labelled **Display 2**. It drags and resizes, still follows the selection, and Dock back (or its close button) returns it; while it is out, the script tab offers Dock back.

**Real studio:** saved layouts persist per person (browser storage is enough: it is a per-viewer convenience). The title-bar window buttons, Pan and the Grid are built.

## 2. Menus

| Menu | Items |
| --- | --- |
| App menu (hamburger, far left) | New level…, Open starter level…; Save (Ctrl+S), Save as…, Export ▸; Lenses ▸ (each lens, Grid, Hide all lenses), Reset window layout; Preferences…, Keyboard shortcuts (?), About; Quit |
| File | New level…, Open starter level…; Save, Save as…, Export ▸; Quit |
| Edit | Undo: *step name* (Ctrl+Z), Redo: *step name* (Ctrl+Shift+Z); Cut, Copy (with the area size when an area is selected), Duplicate (Ctrl+D), Delete (Del) |
| View | Each lens with Alt+1 onwards; Grid, Hide all lenses (Ctrl+Shift+L), Centre the level; Zoom in (=), Zoom out (-) |
| Level | Run playtest bot, Level properties…; Go to start, Go to exit |
| Claude | Ask Claude for an idea (Ctrl+K), Check the gaps (rule-based); Propose changes, Edit directly; Accept all pending, Reject all pending, Show Review changes |
| Window | Reset window layout; Save layout for this session, Restore saved layout; Pop out the script / Dock the script; Collapse all windows, Expand all windows |
| Help | About this prototype, Keyboard shortcuts, Builder language reference |

Click a menu, then hover along the bar to move between menus. Items that are not built are shown muted.

The **right-click menu** on a cell shows the thing's name, position and script line, then: Inspect, Show in script (Ctrl+J), Ask Claude about this (Ctrl+K); Flip facing (F, enemies only), Patrol range ▸, Replace with ▸, Duplicate; Cut, Copy; Delete. Clicking (not dragging) onto a thing opens a **context ring** of eight buttons around it: Paint, Erase, Select, Ask Claude, Show in script, Stamp, Pick and Inspect.

Not built in the prototype: New level, Save as, Export, Preferences, Quit, Level properties, Grid, Patrol range, Replace with, Builder language reference. Save shows a message and writes nothing.

## 3. Tools and keys

Keys work while the studio has focus (click the level first) and pause while typing in a box. The prototype's root element owns the handler; nothing listens on the document.

| Key | Action |
| --- | --- |
| B, E, I, S, T | Paint, Erase, Pick, Select, Stamp |
| L, R, A | Lift, Room, Arena (in a level) |
| P | Point (on an overworld) |
| Ctrl+Z, Ctrl+Shift+Z (or Ctrl+Y) | Undo, redo |
| Ctrl+C, Ctrl+X | Copy, cut the selection (filled cells only) |
| Ctrl+D | Duplicate |
| Del or Backspace | Delete the selection, or the selected object |
| Arrows | Move the selected thing one tile; with an empty cell selected, move the cursor |
| F | Flip the selected enemy's facing |
| Ctrl+K | Ask Claude (about the selection when there is one) |
| Ctrl+J | Show the selection's line in the script |
| Alt+1 to Alt+5 | Toggle lenses one to five (the lenses on offer, in order) |
| Ctrl+Shift+L | Hide all lenses |
| = and - | Zoom in and out through 16, 24, 32 and 48 px |
| Ctrl+Shift+0 | Reset window layout |
| Ctrl+S | Save (writes nothing in the prototype) |
| Esc | Close menus, cards and the ring; then clear the object selection; then clear the selection |
| ? | Show or hide the shortcuts card |

Tool behaviour:

- **Paint** places the palette's chosen tile, item or enemy. Dragging paints a run; the whole stroke is one undo step.
- **Erase** clears cells. **Pick** copies a cell's thing into the palette and switches to Paint.
- **Select** selects a cell; dragging selects a rectangle, labelled with its size and "Ctrl+C to copy". With Select, objects can be dragged (see §4).
- **Stamp** pastes the copied cells with the top-left on the clicked cell, with a dashed preview that follows the pointer and says when part of it is past the edge. A stamp is one undo step; cells past the edge are skipped. With nothing copied, the preview says "Nothing to stamp: select an area, then Ctrl+C".
- **Lift** (L): drag from one end to the other. A click without a drag makes a lift 4 tiles long. New lifts start at speed 0.3, size 2 × 0.5, no rest.
- **Room** (R): drag a rectangle. The room's facade fills the empty cells of the rectangle.
- **Arena** (A): drag a width; a click makes it 10 tiles wide. Its floor is the row the drag started on.
- **Point** (P, overworld): see §8.

Zoom steps through 16, 24, 32 and 48 px from the Navigator's buttons or the keys; at 16 px the gap labels keep only the width.

## 4. Objects and the studio-owned-lines rule

Tiles are painted. **Objects** are placed, selected and tuned, and each is a single line in the script:

| Object | Script line | Fields in the Objects window | Drag handles |
| --- | --- | --- | --- |
| Lift | `hover from=X,Y to=X,Y speed=S [size=WxH] [dwell=S]` | From x, From y, To x, To y, Width, Speed, Rests (s) | The A and B ends |
| Room | `room x=A..B y=A..B` or `secret-room ...` | Left x, Right x, Bottom y, Top y; Secret toggle | The body |
| Boss arena | `arena x=A..B floor=N` | Left x, Right x, Floor y | None |
| Switch channels | `channel LIST on` | A chip per channel that starts on | — (no place on the map) |
| Level point | `level SLUG at=X,Y [req=LIST] [big] [hidden]` | Level (cycles through the levels), x, y; Big, Hidden; Unlocks chips | The point |
| Teleporter | `tele NAME at=X,Y with=NAME [req=LIST] [hidden]` | Pairs with (cycles through the teleporters), x, y; Hidden; Unlocks chips | The point |
| Saucer | `saucer at=X,Y` | x, y | The point |
| Sign | `sign N at=X,Y` | Sign, x, y | The point |
| Area | `area NAME x=A..B y=A..B` | Area (cycles through the five), Left x, Right x, Bottom y, Top y | None |

The rule, as the prototype implements it:

1. When a level opens, the studio reads every line that holds an object (`parseObjLine`). From then on **the studio owns those lines**.
2. When an object changes (a field, a drag, a toggle), the studio **rewrites its one line in place**, in canonical form (`objText`), keeping the line's indentation. Moving a lift never adds a second one.
3. An object the studio adds goes under `edits`.
4. An object the person deletes has its line replaced by `// removed in the studio: <original line>`; Undo brings it back.
5. A hand-written line the studio did not touch is never rewritten. Tile edits are never written into hand-written lines.
6. A drag is one undo step: the first move records the step, later moves of the same drag only update the object.

Moving a room moves its facade: the old facade cells go back to empty and the empty cells of the new rectangle take the facade.

**Real studio:**

- The rewrite must go through the language package (an API beside `appendEdits` that replaces one owned node and prints it with `formatNode`), so it is tested with the rest of the language. The language package has no such API yet.
- A new `arena` goes under `edits`, which the parser accepts for this one top-level word (a level still has at most one, and a second is E006).
- Objects are matched to lines by line number and original text; if the text changed outside the studio, the studio refuses to rewrite and asks.
- Every handle drags: a lift's whole path, a room's corners and edges, the arena's ends and floor.

## 5. History

- Every change is one step with a who (You, Claude) and a what ("Typed: paint block x=5 y=6", "Moved Lift 18,48 to 18,57", "Accepted: Stones over the pool").
- Undo and Redo name the step they would undo or redo, in the Edit menu and in a toast.
- The History window shows the steps, a **Now** marker, and Claude's pending ideas after Now until the person decides.
- A painted stroke, a stamp, a drag, a typed line, an accepted hunk and an object change are each one step. A direct edit from Claude joins the same history.

**Real studio:** history also records saves, and survives a reload by being kept beside the file (the MCP sidecar already keeps Claude's entries with ids `h1`, `h2`, …).

## 6. Lenses

Lenses draw over the level and change nothing. In a level the lens bar offers, in order (so Alt+1 to Alt+5):

| Lens | Shows |
| --- | --- |
| Gaps | Every gap, coloured by the rule: up to 3 wide green "a jump clears it", exactly 4 amber "tight: a tenth of a second", 5 or more rose "needs a ledge". A gap is a run of non-solid cells on a surface row, bounded by standing surfaces, with nothing to stand on below (a valley with a bare floor is not a gap). Paint a gap wider or narrower and the colour follows. |
| Ghosts | Claude's pending cells, dashed purple |
| Reach | A rough three-tile box around the selection, labelled a rough guide |
| Hazards | Outlines spikes and chocolate |
| Paths | Where walking enemies go: a solid bar for a gloop's walk with its length ("gloop: 12 tiles"), a dashed bar for a marshmallow ("marsh: turns only at walls"), a dashed oval 5.2 × 2.8 tiles for a drone ("drone: a fixed loop"), and a 20 × 8 tile box for a hopper ("hopper: jumps when Ben is behind it, inside this box") |

On an overworld: **Links** (cyan lines from each required level to the point it unlocks, and dashed purple lines between paired teleporters), **Areas** (dashed outlines of each `area` rectangle with its name), and **Ghosts**.

The same toggles are in the View menu and the app menu's Lenses submenu. The playtest button in the lens bar is a stand-in in the prototype: it says so and shows no results.

**Real studio:** the Paths lens draws positions from the game's WebAssembly (`ARCHITECTURE.md` §5); the prototype's JavaScript (`walkExtent`) is a reference and is approximate on slopes. The Gaps lens keeps its label as a design rule until it is checked against the jump physics.

## 7. Script panel and completion

- The script is always in sync with the canvas. The hand-written sections stay as written; every tile change becomes a line under `edits`.
- Lines Claude wrote carry a purple `+` in the gutter; lines still waiting for review are tinted.
- Clicking a line selects its thing on the level. Selecting something highlights its line and the script scrolls to follow it, unless **Following** is turned off. The scroll track has a marker for the selected line and for Claude's lines.
- **Show in script** (Inspector, ring, right-click menu, Ctrl+J) jumps to the line.
- The **typed-line box** under the script takes one line, such as `paint block x=3..5 y=9`, `clear x=2 y=11`, `place cheezie x=40..43 y=7`, an enemy line, or an object line (`hover`, `channel`, `room`, `secret-room`, `arena`; on an overworld `level`, `tele`, `saucer`, `sign`, `area`). Enter or Add applies it as one undo step. A line the editor cannot read gets a plain explanation and a suggested fix, and **Use this fix** fills the box. `paint cheezie ...` is answered with "A cheezie is an item, not a tile. Use place."
- **Completion** appears as the person types: statement words first; after `paint` the tile words, after `place` the item words; then the statement's fields (from `fields` in `docs.ts`, leaving out those already given; flags such as `ride`, `big`, `hidden` without `=`); then values for `req=` (every level slug except the saucer, and `secret`) and `with=` (the overworld's teleporter names). Up to eight suggestions show with the syntax and the note. Arrow keys move, Tab (or Enter on a highlighted row) accepts, Escape closes the list.

How the prototype builds the edits block: it compares the grid with the hand-written level and writes one line per tile word per row, grouped as `paint WORD x=LIST y=N` (or `place`, `clear`, or the enemy word). This is a picture of the difference, not an append-only log.

**Real studio:** the typed line, the script panel and file loading use `packages/language` (`parse`, `appendEdits`, `print`), so the errors are the language's (E001–E016) and the edits block follows the language's append rule. Whether to offer a person-run "tidy edits" that regroups the block is open (`SPEC.md` Q1). The panel is a real text editor: a person can edit any line, and the studio reparses.

## 8. The overworld designer

File, Open starter level, then Overworld opens the 60 × 44 map. It paints like a level (grass, path, river, tree, rock, houses, shop, fountain and the rest of the tile words), with the Point tool instead of Lift, Room and Arena.

- **Point** (P): choose the kind in the Objects window (level, teleporter, sign, saucer), then click the map.
  - A **level** point takes the first level in the level table that has no point yet; when every level has a point, the studio says so and suggests changing an existing point's level.
  - A **teleporter** is named `pad-N` (the first free number) and pairs with the most recent teleporter.
  - There is one **saucer**; a second is refused with "drag it to move it".
  - A **sign** takes the next sign number.
- Drag a point to move it (Select tool).
- The **Level** field swaps a level point's level with its arrows. **Unlocks** chips list every level (and "secret found") except the point's own; the chosen ones become `req=`. **Big** and **Hidden** are toggles.
- A teleporter's **Pairs with** cycles through the other teleporters.
- Each change rewrites the point's line in place, for example `level meteor-mesa at=16,14 req=crater` becoming `level zarg-lookout at=16,14 req=crater`; Undo puts it back.
- The **Links** and **Areas** lenses show the unlock graph, the teleporter pairs and the regions.

Next, for the real studio (see `OVERWORLD.md`): checks for the map (every level has exactly one point, every teleporter pair points both ways, no unlock cycles, every level reachable from the saucer), several overworlds, registering a new level, and **level sprites** on points from a sprite picker.

## 9. Starter levels

File, Open starter level opens a card of 18 entries, in level-table order: Crater Fields, Caves, Citadel, Meteor Mesa, Zarg Lookout, Marshmallow Meadows, Bonbon Playhouse, Fudge Bog, Mirror Shafts, Sugar Glass Gallery, Frosting Flats, Frosting Spire, Cocoa Foundry, Gumdrop Isle, Whisper Hollow, Saucer, then the Overworld and the Sample draft (40 × 16, the first walkthrough's level). Each entry shows the name, size, a description (from the `///` comment above the level function in `levels.rs`, or a written one for the three functions without one), and counts: treats, enemies and objects, lifts, rooms, boss arena, and items hidden by overlap. The open level's button reads "Open now"; Escape closes the card. Crater Fields opens first.

The 16 levels come from `levels-data.js`, written by `tools/gen-proto-levels.ts` from `levels/crater.fizz` and `levels/real/*.fizz` through the same rasteriser the MCP server uses. The one-character-per-cell grid hides an item that shares a block with an enemy or another item: 3 each in Meteor Mesa, Zarg Lookout and Mirror Shafts, 4 in Frosting Spire, 1 each in Cocoa Foundry, Gumdrop Isle and Whisper Hollow (16 in all). The real studio draws entities as a layer over tiles, so nothing is hidden.

## 10. Working with Claude in the editor

- The **Claude** tab has the mode switch: **Propose** (ideas arrive as dashed purple ghosts to accept or reject) or **Edit directly** (placed at once, with Undo, and joins the history). Propose is the default.
- Ask from the Claude tab, the ring (Ask), the Claude menu, Ctrl+K, or right-click, Ask Claude about this.
- **Review changes** lists each pending idea as hunks: a title, the script lines it would add (marked `+`), Accept, Reject, and an eye button that jumps to the ghosts. Accept both and Reject both deal with the whole idea. The tab shows how many hunks wait.
- **Check the gaps** is a fixed rule, labelled not AI: it proposes a one-way stone over the middle of every gap five or more tiles wide.

In the prototype there is no AI: Ask cycles through three canned ideas per level (for Crater Fields: stones over the first pool, a hopper past the three-wide gap, a ledge before the red door; for the overworld: a bridge over the river and one more house), and the window says so.

**Real studio:** the buttons reach Claude over MCP (`MCP.md`); Accept and Reject in Review changes are the person's controls that the CLI stands in for today.

## 11. What each screen shows

| Screen | Shows |
| --- | --- |
| Level canvas | Tiles, items and enemies as glyphs on coloured cells, objects as shapes (lift ends A and B with a dashed path, rooms as dashed rectangles labelled room or secret room, the arena as a dashed box nine tiles high), the selection, the dragged area, the stamp preview, ghosts and lenses |
| Overworld canvas | The map tiles, points as circles (level initials, ⇄ for teleporters, S for the saucer, sign numbers in squares; hidden points dashed; big level points larger), names under level points and teleporters from 24 px zoom, and the Links and Areas lenses |
| Inspector | The selected thing's name and kind, x and y with steppers, facing (Left, Right) and patrol for enemies, its script line with Show in script, Delete, and the last change's author |
| Checks | Has a start, has an exit, the playtest bot (stand-in) |
| Navigator | The whole level with an orange frame for what the canvas shows, shading under windows, the selection in white, and the zoom |
| History | Steps by You and Claude, Now, then proposed steps |
| Review changes | The pending idea's title and why, its hunks and lines, Accept and Reject per hunk and for all |
| Script | Line numbers, the `+` marks, tinted pending lines, the scroll track, Following, the typed-line box, errors with Use this fix, completion |
| Shortcuts card | The key table in §3 |
| Starter levels card | §9 |

## 12. What is canned or not built in the prototype

From the Guide's last step, checked against the code:

- **Canned:** Claude's ideas (a fixed list of three, no AI, no network); Check the gaps (a fixed rule); the playtest bot (plays nothing, shows no results); Save (a message only; the saved layout lasts the session); patrol and facing (stored, no effect).
- **Not built:** Pan; New, Save as, Export, Preferences and Quit; dragging a room's corners or a lift's whole path; Patrol range and Replace with; Grid; the title-bar window buttons.

The Guide's "Not built" list also says the editor does not show enemy walking paths; that line predates the Paths lens, which the same list's "Works" column and the prototype include (computed in JavaScript, approximate on slopes).

## 13. The Fizz 2 target (planned)

Nothing in this section is built. It says what the editor needs so that one editor builds levels for Fizz 1, Fizz 2 and the episodes after it. The dialect, the data a Fizz 2 level holds and the capability matrix are in [LANGUAGE.md](LANGUAGE.md#the-fizz-2-dialect-planned); [FIZZ2-COVERAGE.md](FIZZ2-COVERAGE.md) maps every Fizz 2 feature to the place it is handled. Fizz 2 is the more important target; Fizz 1 stays supported.

### The Target and its profile

- The **Target** names a target profile (`fizz1`, `ep2`, later `ep3`; [LANGUAGE.md](LANGUAGE.md#targets-and-capabilities)). It belongs to the project and shows in the title bar, with the profile's dialect version and the date or commit of the game tables it was made from. A file that starts `script fizz2 0` opens with the project's Fizz 2-family profile; any other opens with `fizz1`. A file's own `target` line overrides the project for that file. Changing the target never rewrites the script by itself.
- **Everything the editor offers comes from the profile:** the palette and its legend letters, the object kinds and their fields, completion, the Inspector's fields, the effect and caption lists, the themes, the sprite sets, the limits, the budgets and the lints' physics parameters. No list of words is written into the editor's code.
- **Capability states show in the UI.** A **built** capability is offered normally. An **accepted** one (a rule trigger the game refuses at load, a level string it does not draw yet) is offered with a small "not yet in the game" badge and its W106 or W109. A **reserved** one is shown and greyed, with a reason on hover. An **absent** one is greyed in the palette and its lines are E102, with the reason ("Fizz 2 has no lifts yet"). The **Target** menu has a Capabilities card that lists every row of the matrix for the current profile with its source (a file or a pull request in the game's repository).
- **Divergence is visible, never silent.** Where the same word means different things in two profiles (the exit, the door, the body size), the Inspector says what it does in the current target and the Checks window lists what would change in the other one.

### Checks per target

- With Target `fizz1`, the editor runs the **Fizz 1 export check** live and shows its findings inline and in the Checks window: E120 (a lock Fizz 1 cannot say, including a door that starts open), E121 (any `when` or `string`), E122 (`floor solid`), W104 (an `at=` position that will snap, drawn on the canvas as an arrow from the exact position to the cell it would take) and W110 (behaviour that changes without data loss). Exporting is refused while an error stands; warnings do not block it.
- With a Fizz 2-family target, the Fizz 2 checks run instead: required and unique `id=`, references, kind order, bounds, one key per colour, the lock shape, channels, the 32-rule and 32-string limits, conflicts (E119), the time-rule ranges, the W1xx lints and the budgets.
- Lints that stand in for physics are labelled as design rules, as the Gaps lens is. W103 (a wall-kick climb) and W105 (head room) take their numbers from the profile's physics parameters; whether a level can really be finished is the playtest bot's answer, run in the game's WebAssembly.
- **Convert to Fizz 2** (Level menu) writes a new Fizz 2 file from a Fizz 1 level as one reviewable change, then opens it with its E102 list in the Checks window ([LANGUAGE.md](LANGUAGE.md#converting-a-fizz-1-level-to-fizz-2)).

### Windows and tools

- **Map painting.** In a Fizz 2 level the Paint tool writes the `map` block, not `edits` lines: a stroke rewrites the touched rows of the map in place as one undo step. The map is studio-owned text in the sense of section 4 (the studio rewrites only the rows it changed and keeps the row labels), and the palette shows each tile's legend letter.
- **Objects window.** Keys, snacks, cans and chickens are objects with an `id=` field, kind, position (`at=` or `x=`/`y=`, by the printer rule) and kind fields (`dir=` for a chicken). Adding an object proposes an id (`cheezie-3`); renaming an id rewrites every rule that names it in the same undo step. The window shows each object's baked index, because rules point at indices, and refuses a drag that would reorder kinds.
- **Snap to floor.** A command (and a modifier while dragging) that drops the selected objects to the surface below them and writes the position as `at=`. The printer rule applies: a position that lands on an exact cell centre is written as `x=`/`y=`. For a snack or key, "on the floor" puts its centre half its sprite above the surface, as the game draws it.
- **Locks on the door.** Selecting a door tile shows a Lock field in the Inspector (none, red key, blue key; green greyed with its reason), which writes or rewrites that door's one `lock` line.
- **Close all doors.** One command that sets every door channel's start state to closed, so a level tested open is put back in one undo step. It rewrites the `channel` line and removes an `allow W101` that no longer applies.
- **Rules window.** Lists the `when` and `lock` lines as sentences ("When Ben enters the red box, if channel 3 is on, turn channel 3 off at 15,21 and play clunk"), each with its trigger, guard, delay, one channel action, one cue, the repeat flag, its baked record index and its lints. A trigger rectangle (`enter`, `shoot`) is dragged on the canvas; an action's cell is picked on the canvas; `take`, `stomp` and `stun` pick their object from a list of ids of the right kind (or "any"). A counter shows rules used out of 32. Rule, lock and string lines are studio-owned lines: the studio rewrites them in place and never touches a hand-written line beside them.
- **Strings.** The Rules window's Strings tab lists the level's strings with their style and byte count (out of 30), out of 32 strings, and previews each in the game's caption font and style colour at the DOS frame width (W107).
- **Cue pickers.** Effect and caption pickers list the profile's effects and shared captions by name, play an effect through the game's Web sound when the game module is loaded (the editor never synthesises a sound itself), and offer the level's strings after the shared captions.
- **Rule lints inline.** W101, W106, E111, E119 and the rest appear as squiggles in the script panel and badges on the door or the rule, with Use this fix where there is one (adding `allow W101` with a comment, flipping the channel, adding the missing `at=`).
- **Channels lens.** Draws each channel's doors, locks and rule cells and rectangles in one colour per channel, in the style of the Links lens, with the start state as a filled or hollow marker.
- **Exit and head-room lenses.** The Exit lens marks where Ben can stand in front of each exit cell to press Up (W102). The Head room lens shades passages and jump spaces by the clearance the profile's body leaves, and can be switched to compare two body sizes (today's 1.4 tiles and the trial's 2.0), so a level can be checked before a new Ben ships (W105).

### Previews: the game's look

The editing canvas stays the flat tile grid with glyphs and sprites, which is the fastest to edit on and shows every cell. The game's look is a separate **Game view** window (and a toggle on the canvas):

- **Oblique ground.** Fizz 2 draws the ground in an oblique projection with faces chosen from each tile's class and its neighbours (`docs/OBLIQUE.md`, #142 and #143). The projection is global, not per level.
- **Parallax and sky.** Open-air cells show the theme's parallax stack (the Lighthouse night's stars, clouds, headlands and sea), and a Sky choice (Full or Light) previews the DOS Light detail (#144).
- **Night and lights.** A Night toggle previews the palette banks and the dynamic lights (Ben's lantern, door badges, exit glow, the theme's lamps and lanterns, shots), with a light-count readout against the game's 16-light limit (#146).

**The editor never reimplements this drawing.** Every Game view frame is drawn by the game's own presenter code (`fizz-slice-view` and `fizz-present-web`) running in the game's WebAssembly, from the level as baked, in a Web Worker. Until the game exports a "draw this level" entry point (`ENGINE-CHANGES.md`, Fizz 2 change F5), the Game view says "not available" and draws nothing; it never falls back to a TypeScript imitation. A frame the game draws can be checked against the game's pinned frame digests, so the preview is the game's picture.

### Budgets

A **Budget** window shows meters for what a level and its world cost, each saying where its number came from:

| Meter | Limit | Source |
| --- | --- | --- |
| Rules | 32 per level, locks included | `MAX_RULES` (#138) |
| Strings | 32 per level, 30 bytes each | `MAX_STRINGS` (#138) |
| Channels used | 0 to 31 | `MAX_CHANNELS` |
| Objects | 65,535 (`u16`); the practical limit is the state hash and the drawing | `LEVL` header |
| `LEVL` section size | Decoded and stored bytes | From `fizz-bake` when it is available; otherwise an estimate from the published length formula, labelled "estimate" |
| World pack | The sum of its levels, sprites and backdrops | `fizz-bake` report |
| Floppy | `BUDGET 1100000` bytes for `FIZZ2.EXE` and the packs together (provisional), with the 8 KB and 64 KB reserves of the two images | Fizz 2's `docs/PLATFORM.md` and `docs/FAP.md`; `FIZZ2.EXE` is 374,272 bytes on #146 |
| Section limit | 96 KB decoded per section by default | `SECTION_LIMIT` in `fizz-pack` |
| Lights in view | 15 | #146 |

- A meter never claims a number it did not get: an estimate says so, and a meter whose source is not available reads "not run" (G-TRUST-4).
- The DOS floor (a 486DX with 4 MB, #143) and the per-frame drawing budget are not level properties and are not metered here; the Game view's night preview shows the game's own bench figures when the game reports them.

### Dump view

A read-only view of what the baker would produce for the level: the sorted object list with indices, the rule table as records, the string table and the bake's own disassembly (`fizz-bake dump`, planned), so what the person sees is what the game runs. It is a view, not an editor, and says so. Until the baker exists it reads "not run".

### What the editor does not do

- It does not run the rules. Rule behaviour belongs to the Fizz 2 simulation (the game owns the rules), reached through the same WebAssembly bridge as the Paths lens and the playtest bot.
- It does not draw the game's look. The Game view is the game's presenter.
- It does not bake. The baker writes the packs, manifests and digests; the editor shows its output.
- It does not define the theme, light or sprite formats. It reserves words for them and follows the Fizz 2 repository when it defines them.

## 14. Sprites (planned)

Nothing in this section is built. Fizz 1's level points already have a sprite plan ([OVERWORLD.md](OVERWORLD.md#8-sprites), ENGINE-CHANGES E10); this section covers sprites for every target, with Fizz 2's new art first. Fizz 2's sprite rules are in its `docs/SPRITES.md`; where this section and that file disagree, that file wins.

### What a sprite is in each game

- **Fizz 2.** Sprites are committed text grids: one JSON file per set under `assets/sprites/<set>.json`, canonical (fixed key order, one row per line, final newline), each sprite with a `name` unique across all files, `w` and `h` (1 to 255), an `anchor` (default the feet and centre, `[w / 2, h]`), a `source` and `rows` of palette letters, `.` for transparent. The palette is the 16 EGA colours, letters `k B G C R M N L D b g c r m y W` for indices 0 to 15. Until the `SPRT` pack section is specified, the grids are lowered to `const` data in `fizz-view` (`sprites_data.rs`, one byte a pixel, 255 transparent).
- **Fizz 1.** Sprites are generated by its TypeScript sprite code and named in `SPRITE_NAMES` (name table 0 of the WebAssembly module); the studio only ever names them.
- **Sources decide what can be edited.** In Fizz 2, `generated:fizz1` and `generated:ep2-canvas` sets are read-only (change the generator and re-export); `drawn` sets are editable.

### How a level uses sprites

A level does not choose sprites today. The game picks each frame from an object's kind and state: a chicken draws `cluckzarg_idle`, `walk`, `walk2` or `alert` with the `cluckzarg_beak` overlay when it clucks; a snack draws `cheezie`, `choc`, `cookie` or `soda` by its `sub`; keys draw `keyRed` and `keyBlue`, doors `doorRed` and `doorBlue`; Ben's pose comes from the presenter's rule (`ben_pose` in `fizz-slice-view`). So the editor's job is to **show** the right sprite, not to store one:

- The canvas draws each object with its kind's idle frame from the target's sprite sets, placed by its anchor at the object's position, flipped by its facing. The profile maps kinds to sprite names; nothing is hard-coded.
- The Inspector shows the object's sprite and its states. **Animation preview** steps through a kind's frames in a small loop. The cadence of the real game (Ben's run frames change with distance run, the stun stars every 10 ticks, the puff over 18 ticks) is a presenter rule, so the preview either asks the game for its frame sequence or labels its own fixed cadence "preview cadence, not the game's".
- If the game later lets a level choose a sprite variant for an object (open question Q20), the profile marks the field and the Inspector gains a sprite picker for it.

### The Sprites window

- A browser of every sprite set the target has, grouped by set and by the kind or state it serves, with each sprite's name, size, anchor (drawn as a cross), source and whether it is provisional (`note`), at 1x to 8x on the level's background colour and, for Fizz 2, at the night ambient.
- **Ben's poses.** The pose workshop's frames (`ep2-ben-lab`, trial branch `trial/lab-ben-sprites`, `7b948ae`: `lab_standRight`, `lab_standLeft` at 14 by 33, `lab_lookUp`, `lab_bendHalf`, `lab_bendFull` at 19 by 31, and six-frame runs left and right and fire at 25 by 33) are shown as a set beside Fizz 1's 16 by 24 Ben and the provisional `benA_*` frames. The profile records which set the game ships (Fizz 1's today) and the body size that goes with it, which drives the Head room lens and W105.
- **Enemies and pickups.** The roster the game publishes, with its animation states (planned in Fizz 2 as idle, walk, alert, stunned and dead), and the pickups and HUD keys. A kind whose sprite set is missing in a target is drawn as a labelled placeholder box, never as another kind's art.
- **Overworld level sprites.** For a target with an overworld (Fizz 1 today), the picker filtered to landmark sprites (`OwLm*`, `OwCastle`, `Saucer`) sets a level point's sprite, as [OVERWORLD.md](OVERWORLD.md#8-sprites) describes.
- **Availability per target.** Each sprite shows which targets and which profiles have it (a Fizz 1 sprite exported into Fizz 2 has both), and, once packs exist, whether its Web and DOS forms are both baked or one is a placeholder.

### Editing drawn sprites (later)

A pixel editor for `drawn` sets only, inside the game's workspace when the person opens it there:

- It edits a `w` by `h` grid of the 16 palette letters and `.`, writes the sprite back with the canonical rules (`tools/sprites/lib.ts` is the reference), and leaves a file's bytes unchanged when no cell changed.
- It refuses a letter outside the palette, a size outside 1 to 255, a name that is not unique across every set, and an edit to a generated set.
- It shows the EGA constraints as the art is drawn: 16 colours, no new ones, 255 never a colour; the night palette banks dim a colour and cannot tint it, so the preview at the night ambient shows whether a sprite still reads; the colour roles of `docs/OBLIQUE.md` (dark colours build the world, bright colours mark what Ben can touch) are a lint on pickups and hazards.
- After a save it reminds the person that `bun tools/sprites/emit-rust.ts` (and its `--check`) must run in the game's repository; the studio does not run the game's generators.

### How sprites reach a pack

The studio never writes a pack. Sprites flow from `assets/sprites/*.json` through `fizz-bake` into a `SPRT` section of `SHARED.FAP` (Ben, the HUD) or the world's pack (world sprites), once `SPRT` is specified (`docs/FAP.md`: bits per pixel, a mask or a colour key, runs, the index and the Web form are all open). Until then they reach the game as `const` data. Level files name kinds, not sprites, so a level does not change when its art does.

### What is not known

- The `SPRT` layout and whether sprites get numeric ids in place of names.
- Which Ben ships, and with it Ben's body size (the trial's 0.8 by 2.0 moves the state hash and the golden replay).
- The enemy roster's kinds, their sprite sets and state names.
- Whether a level can choose a sprite variant per object, and whether Fizz 2 gains an overworld with level sprites.
- Whether the Web form of a sprite may be richer than the DOS form, and how the editor would show both.
