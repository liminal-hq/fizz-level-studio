# The editor

How Fizz Level Studio behaves, screen by screen. The source is the design prototype (`design/project/Proto.dc.html`) and its walkthrough (`design/project/Guide.dc.html`, twelve steps). Where the real studio must differ from the prototype, this document says so under **Real studio**. Each behaviour's build status is in `SPEC.md` §10.

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

Nothing in this section is built. It says what the editor needs so that a future implementer builds one editor for both games; the dialect itself is in [LANGUAGE.md](LANGUAGE.md#the-fizz-2-dialect-planned).

### The Target setting

- A **Target** setting, **Fizz 1** or **Fizz 2**, belongs to the project and shows in the title bar. A file that starts `script fizz2 0` opens with Target Fizz 2; any other opens with Fizz 1. Changing it never rewrites the script by itself.
- With Target Fizz 1, everything Fizz 1 lacks is **greyed out** with a reason on hover: the map grid's slope and reserved letters that have no Fizz 1 tile, `chicken`, `floor`, `at=` placement, locks, channels as rule state, and the rule tools.
- With Target Fizz 1, the editor also runs the **Fizz 1 export check** live and shows its findings inline and in the Checks window: E120 (a lock Fizz 1 cannot say), E121 (any `when` rule), E122 (a solid `floor`) and W104 (an `at=` position that will snap to a cell centre, shown on the canvas as an arrow from the exact position to the cell it would take). Exporting is refused while an E12x error stands; warnings do not block it.
- With Target Fizz 2, the Fizz 2 checks run instead: required `id=`, bounds, channels, limits (32 rules), conflicts (E119) and the W1xx lints.

### Editor features this implies

- **Snap items to the floor.** A command (and a modifier while dragging) that drops the selected items to the surface below them and writes the position as `at=`, not `x=`/`y=`. The printer rule applies: a position that lands on an exact cell centre is written as `x=`/`y=`.
- **Close all doors.** One command that sets every door channel's start state to closed, so a level that was tested open can be put back in one undo step. It writes the explicit `channel` start line and removes the need for `allow W101` where the doors now start closed.
- **Rule authoring UI.** A Rules window lists `when ... then ...` lines as sentences with a trigger, a guard, up to two actions and a repeat flag, and a trigger rectangle you drag on the canvas (for `enter x= y=`). Locks are set on the door itself in the Object window. Rule and lock lines are studio-owned lines in the sense of section 4: the studio rewrites them in place and never touches a hand-written line beside them.
- **Rule lints inline.** W101, E119 and the limits appear as squiggles in the script panel and badges on the door, with Use this fix where there is one (for example adding `allow W101` with a comment, or flipping the channel).
- **Dump view.** A read-only view of what the baker would produce for the level: the sorted object list with indices, the rule table as records, and the bake's own disassembly (`fizz-bake dump`), so what the person sees is what the game runs. It is a view, not an editor, and says so.
- **A Channels lens.** Draws each channel's switches, doors and rule triggers with one colour per channel, in the style of the existing Links lens.

### What the editor does not do

- It does not run the rules. Rule behaviour belongs to the Fizz 2 simulation (the game owns the rules), reached through the same WebAssembly bridge as the Paths lens and the playtest bot.
- It does not bake. The baker writes the packs, manifests and digests; the editor only shows its output.
