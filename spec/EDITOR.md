# The editor

How Fizz Level Studio behaves, screen by screen, for Fizz 1 and, in sections 13 to 15, for Fizz 2, the sprites and the pixel editor. The source is the design prototype (`design/project/Proto.dc.html`) and its walkthrough (`design/project/Guide.dc.html`, twelve steps). Where the real studio must differ from the prototype, this document says so under **Real studio**. Each behaviour's build status is in `spec/REQUIREMENTS.md`.

## 1. The workspace

The **Ultimate** layout is home: the level is the canvas and fills the window; every other part is a window floating over it. The prototype's starting arrangement, at 1440 × 900:

| Window                         | Holds                                                                                                                                 | Start position (x, y, w, h) | Minimum size |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------ |
| Tool rail                      | Paint, Erase, Pick, Select, Stamp, Inspect; in a level also Lift, Room, Arena; on an overworld also Point; Pan shown muted            | 8, 8, 60, 318               | —            |
| Palette / Outliner (tabs)      | Every tile, item and enemy kind, grouped terrain, hazards, treats, enemies, objects, then the start, exit and moving-platform markers | 76, 8, 252, 300             | 200 × 120    |
| Objects                        | The level's objects, or the overworld's points and areas, and the selected one's fields                                               | 336, 196, 420, 300          | 240 × 120    |
| History                        | Who changed what, with Claude's pending ideas after a Now marker                                                                      | 336, 8, 560, 120            | 380 × 96     |
| Checks                         | Start, exit and the playtest bot                                                                                                      | 904, 8, 220, 120            | 190 × 96     |
| Lens bar                       | The lens toggles, the gap rule, and Run playtest bot                                                                                  | 336, 136, 788, 52           | —            |
| Inspector                      | The selected thing: name, position, facing for enemies (patrol for Fizz 2 objects, planned), its script line, Show in script, Delete  | 812, 436, 300, 256          | 270 × 220    |
| Review changes / Claude (tabs) | Pending hunks; the mode switch and Ask                                                                                                | 1132, 344, 300, 474         | 270 × 260    |
| Script / Playtest (tabs)       | The script, the typed-line box                                                                                                        | 76, 570, 600, 248           | 320 × 140    |
| Navigator                      | The whole level, a frame for what is visible, zoom buttons                                                                            | 684, 570, 440, 248          | 380 × 200    |

Window behaviour:

- Drag a window by its header. Its edges snap within 8 px to the workspace edges, to an 8 px margin inside them and to the edges of other windows; orange guide lines show what it is locking to.
- Resize by the corner grip, down to the window's minimum size.
- The chevron collapses a window to its 46 px header. Window, Collapse all windows and Expand all windows do it for every window.
- Grabbing a window brings it to the front.
- Window, Reset window layout (Ctrl+Shift+0) restores the starting arrangement. Save layout for this session and Restore saved layout keep one arrangement in memory; nothing is written to disk.
- The script's pop-out button moves the script into its own window labelled **Display 2**. It drags and resizes, still follows the selection, and Dock back (or its close button) returns it; while it is out, the script tab offers Dock back. In the desktop app every pop-out is a real window through tear-off (`DESKTOP.md` section 6).

**Real studio:** saved layouts persist per person in the settings document owned by Rust, never in browser storage (`DESKTOP.md` section 7). The title-bar window buttons, Pan and the Grid are built. A panel's header holds a grip, its icon, its title, Maximise and one ⋮ menu (Dock left, right and bottom, Float, Tear off or Dock back, Reset layout), so the dock, float, tear-off and fold buttons of the first build are gone; choosing the showing entry on a dock's rail folds the dock and choosing it again opens it (D67, D70). A floating panel keeps its collapse chevron. The **Layers** panel sits beside the Palette in the left dock in every workspace (see Layers and locks below). Assets is drawn dimmed on the left rail until it is built. The Script panel's header holds its tabs (section 7). Zoom is a floating pill at the bottom-right of the part of the level no dock covers, with zoom out, the factor (such as 4×, never a percentage), zoom in and Fit; Ctrl+=, Ctrl+- and Ctrl+0 do the same, and the status line holds only the cell (D69, D70).

### Layers and locks

The Layers panel lists a Fizz 1 level's script as layers, in the language's order, each row with an eye, a padlock, the layer's name, a short note and a count. Choosing a name shows the layer's first line in the Script panel. Show all brings back every hidden layer and Unlock all opens every lock.

| Layer      | What it is                                                              | Count                         |
| ---------- | ----------------------------------------------------------------------- | ----------------------------- |
| `terrain`  | The `terrain` section: ground, slopes, pools                            | its statements                |
| `walls`    | The `walls` line, the end walls                                         | its statements                |
| `blocks`   | The `blocks` section, without the crystal and the exit and door lines   | its statements                |
| `crystals` | The `crystal` lines                                                     | crystal cells                 |
| `markers`  | The exit and door tiles (`exit`, `red-door`, `blue-door`, `green-door`) | exits and doors the level has |
| `treats`   | The `treats` section, and every item a statement places                 | items the level has           |
| `enemies`  | The `enemies` section, and every enemy a statement spawns               | enemies the level has         |
| `edits`    | The `edits` block, where everything done in the studio is appended      | its statements                |

A row exists only when the script has that layer. A thing (an item, an enemy, an exit or a door) belongs to its layer by what it is, wherever it is written, so a treat placed under `edits` is a treat. A cell belongs to the layer of the last statement that wrote it: the ground to `terrain`, a tile the studio painted to `edits`. A Fizz 2 level has no layers yet; its panel says so, and nothing in it is locked.

- **Hide is the person's view only.** The eye hides a layer on the canvas of this window. It is not saved, it does not stop any edit, and Claude always sees the whole level. Hiding things (items, enemies, exits and doors) filters the drawing in the webview; hiding a layer of tiles asks Rust for the level run in full (the same rasteriser as the game's Builder) with only the painting of that layer's statements left out, so every cell and thing that remains is exactly where it is with nothing hidden, including those placed relative to the ground the hidden terrain laid. Nothing in the script changes.
- **A lock is by effect and binds every writer alike.** A locked layer's cells and things cannot change by any route: painting, clearing or placing on the canvas, Claude's edits and proposals, an outside text edit, and Undo or Redo. Every appended change (painting, clearing, placing) goes under `edits`, so locking `edits` stops all painting. Moving, turning or deleting a hand-written thing rewrites that thing's own statement and touches only its layer and section, so to freeze moves and deletes lock `treats` or `enemies`; the start has no layer and is never locked. Painting or clearing a range that reaches any cell a locked layer wrote is refused whole, and open sky no layer wrote is free.
- **A refusal changes nothing.** Not the text, the history or the revision; the status note says "{layers} is locked. Unlock it in Layers to change it." Undoing across a lock is refused the same way, since it would put a locked layer's own cell back. An outside edit to a locked layer (a text editor, `git`, Claude's direct-mode file write) is not taken in: it appears as a conflict that names the layer and shows the outside text, and the studio keeps its own. Locking does not retry it later.
- **Storage.** The locked layers are the `layers.locked` list in the level's `<level>.studio.json`, beside the level, so a lock travels with it (and may appear in `git`). The studio is the only writer of that key: it rewrites the file atomically, keeping every other key, and puts the key back if the MCP server rewrites the file without it. The server reads the list again before every edit. A sidecar the studio cannot read is never overwritten: the lock stays as it was and the studio says so.
- **Proposals.** The Proposals panel says, under a proposal that would touch a locked layer, which lock blocks it; the person's accept refuses it until the layer is unlocked.

## 2. Menus

| Menu                           | Items                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App menu (hamburger, far left) | New level…, Open starter level…; Save (Ctrl+S), Save as…, Export ▸; Lenses ▸ (each lens, Grid, Hide all lenses), Reset window layout; Preferences…, Keyboard shortcuts (?), About; Quit |
| File                           | New level…, Open starter level…; Save, Save as…, Export ▸; Quit                                                                                                                         |
| Edit                           | Undo: _step name_ (Ctrl+Z), Redo: _step name_ (Ctrl+Shift+Z); Cut, Copy (with the area size when an area is selected), Duplicate (Ctrl+D), Delete (Del)                                 |
| View                           | Each lens with Alt+1 onwards; Grid, Hide all lenses (Ctrl+Shift+L), Centre the level; Zoom in (=), Zoom out (-)                                                                         |
| Level                          | Run playtest bot, Level properties…; Go to start, Go to exit                                                                                                                            |
| Claude                         | Ask Claude for an idea (Ctrl+K), Check the gaps (rule-based); Propose changes, Edit directly; Accept all pending, Reject all pending, Show Review changes                               |
| Window                         | Reset window layout; Save layout for this session, Restore saved layout; Pop out the script / Dock the script; Collapse all windows, Expand all windows                                 |
| Help                           | About this prototype, Keyboard shortcuts, Builder language reference                                                                                                                    |

Click a menu, then hover along the bar to move between menus. Items that are not built are shown muted.

The **right-click menu** on a cell shows the thing's name, position and script line, then: Inspect, Show in script (Ctrl+J), Ask Claude about this (Ctrl+K); Flip facing (F, enemies only), Patrol range ▸, Replace with ▸, Duplicate; Cut, Copy; Delete. Clicking (not dragging) onto a thing opens a **context ring** of eight buttons around it: Paint, Erase, Select, Ask Claude, Show in script, Stamp, Pick and Inspect.

Not built in the prototype: New level, Save as, Export, Preferences, Quit, Level properties, Grid, Patrol range, Replace with, Builder language reference. Save shows a message and writes nothing.

**Real studio (D70):** one registry of commands feeds every menu, the toolbar, the ribbon, each panel's ⋮ menu, the command palette, the Keyboard shortcuts table and the key dispatcher, so a command that cannot run is dimmed with the same reason everywhere, and a command not built yet (Cut, Copy, Paste, Select all, Delete, Save as, Open recent, Grid, Playtest) is listed nowhere. With the menu bar off (the default) the app menu in the title bar is one flat list: New level…, Open level…; Save, Close level; Undo, Redo, Undo history ▸; the Menu bar, Toolbar and Ribbon switches; Panels ▸, Window ▸ (Workspace ▸, Float or Tear off the focused panel, Dock every window back), Command palette…; Preferences…, Help, Keyboard shortcuts…, About; Quit. With it on, the menus are File (New, Open, Save, Close, Preferences, Quit), Edit (Undo, Redo, Undo history), View (the switches, Zoom in, Zoom out, Fit level, Panels ▸, Maximise, Show the level only, Reset layout, Command palette), Window (Workspace ▸, the focused-panel rows, Tear off or Dock back for each panel) and Help. Go to line stays in the command palette. Under the menus the commands row is the classic toolbar (40 px: New, Open, Save, Close level, Undo, Redo, the brush chip, and a toggle for each panel at the right) or, from the Commands row setting in Preferences or the View menu, the ribbon (124 px open, 34 px folded: Home with File, History, Tools and Brush; Level with Layers and Checks; View with Zoom, Panels, Layout, Window and Workspaces; and a Script tab with Problems and Tabs while the Script panel is in use), or nothing. The workspace switcher (Paint, Script, Review) and the Search commands button are at the right end of the menu row, or of the commands row while there is no menu bar.

## 3. Tools and keys

Keys work while the studio has focus (click the level first) and pause while typing in a box. The prototype's root element owns the handler; nothing listens on the document.

| Key                              | Action                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B, E, I, S, T, Q                 | Paint, Erase, Pick, Select, Stamp, Inspect                                                                                                                  |
| L, R, A                          | Lift, Room, Arena (in a level)                                                                                                                              |
| P                                | Point (on an overworld)                                                                                                                                     |
| Ctrl+Z, Ctrl+Shift+Z (or Ctrl+Y) | Undo, redo                                                                                                                                                  |
| Ctrl+C, Ctrl+X                   | Copy, cut the selection (filled cells only)                                                                                                                 |
| Ctrl+D                           | Duplicate                                                                                                                                                   |
| Del or Backspace                 | Delete the selection, or the selected object                                                                                                                |
| Arrows                           | Move the selected thing one tile (a run is one undo step); Escape deselects, and the arrows then move the cursor. With a cell selected they move the cursor |
| F                                | Flip the selected enemy's facing                                                                                                                            |
| Ctrl+K                           | Ask Claude (about the selection when there is one)                                                                                                          |
| Ctrl+J                           | Show the selection's line in the script                                                                                                                     |
| Alt+1 to Alt+5                   | Toggle lenses one to five (the lenses on offer, in order)                                                                                                   |
| Ctrl+Shift+L                     | Hide all lenses                                                                                                                                             |
| = and -                          | Zoom in and out through 16, 24, 32 and 48 px                                                                                                                |
| Ctrl+Shift+0                     | Reset window layout                                                                                                                                         |
| Ctrl+S                           | Save (writes nothing in the prototype)                                                                                                                      |
| Ctrl+N                           | New level (opens the New level window)                                                                                                                      |
| Ctrl+O                           | Open level (asks for a level file)                                                                                                                          |
| Ctrl+W                           | Close the open level, asking first when it has unsaved changes (never the window)                                                                           |
| F1                               | Help (opens the About window until the studio has help of its own)                                                                                          |
| Esc                              | Close menus, cards and the ring; then clear the object selection; then clear the selection                                                                  |
| ?                                | Show or hide the shortcuts card (the Keyboard shortcuts window in the app)                                                                                  |

Tool behaviour:

- **Paint** places the palette's chosen tile, item or enemy. Dragging paints a run; the whole stroke is one undo step.
- **Erase** clears cells. **Pick** copies a cell's thing into the palette and switches to Paint.
- **Select** selects a cell; dragging selects a rectangle, labelled with its size and "Ctrl+C to copy". With Select, objects can be dragged (see §4).
- **Stamp** pastes the copied cells with the top-left on the clicked cell, with a dashed preview that follows the pointer and says when part of it is past the edge. A stamp is one undo step; cells past the edge are skipped. With nothing copied, the preview says "Nothing to stamp: select an area, then Ctrl+C".
- **Inspect** (Q) selects the topmost thing on the clicked cell (an item, then an enemy, then Ben's start), or the cell itself with its tile when nothing is on it, and outlines it on the canvas. It edits nothing and adds no undo step. The selected thing is the editor's, not the tool's: it stays when another tool is chosen, it is separate from Select's rectangle, and Esc on the canvas clears it. The objects list and the inspector (both planned to show it) are meant to read the same selection.
- **Lift** (L): drag from one end to the other. A click without a drag makes a lift 4 tiles long. New lifts start at speed 0.3, size 2 × 0.5, no rest.
- **Room** (R): drag a rectangle. The room's facade fills the empty cells of the rectangle.
- **Arena** (A): drag a width; a click makes it 10 tiles wide. Its floor is the row the drag started on.
- **Point** (P, overworld): see §8.

Zoom steps through 16, 24, 32 and 48 px from the Navigator's buttons or the keys; at 16 px the gap labels keep only the width.

On the level canvas the wheel zooms about the pointer (sideways wheel motion, or Shift or Alt with the wheel, pans), and dragging with the middle mouse button pans the map by hand whatever tool is chosen: the map follows the pointer, nothing is painted, and a drag that starts over the zoom control or the tool picker does nothing.

## 4. Objects and the studio-owned-lines rule

Tiles are painted. **Objects** are placed, selected and tuned, and each is a single line in the script:

| Object          | Script line                                          | Fields in the Objects window                                             | Drag handles            |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------- |
| Lift            | `hover from=X,Y to=X,Y speed=S [size=WxH] [dwell=S]` | From x, From y, To x, To y, Width, Speed, Rests (s)                      | The A and B ends        |
| Room            | `room x=A..B y=A..B` or `secret-room ...`            | Left x, Right x, Bottom y, Top y; Secret toggle                          | The body                |
| Boss arena      | `arena x=A..B floor=N`                               | Left x, Right x, Floor y                                                 | None                    |
| Switch channels | `channel LIST on`                                    | A chip per channel that starts on                                        | — (no place on the map) |
| Level point     | `level SLUG at=X,Y [req=LIST] [big] [hidden]`        | Level (cycles through the levels), x, y; Big, Hidden; Unlocks chips      | The point               |
| Teleporter      | `tele NAME at=X,Y with=NAME [req=LIST] [hidden]`     | Pairs with (cycles through the teleporters), x, y; Hidden; Unlocks chips | The point               |
| Saucer          | `saucer at=X,Y`                                      | x, y                                                                     | The point               |
| Sign            | `sign N at=X,Y`                                      | Sign, x, y                                                               | The point               |
| Area            | `area NAME x=A..B y=A..B`                            | Area (cycles through the five), Left x, Right x, Bottom y, Top y         | None                    |

The rule, as the prototype implements it:

1. When a level opens, the studio reads every line that holds an object (`parseObjLine`). From then on **the studio owns those lines**.
2. When an object changes (a field, a drag, a toggle), the studio **rewrites its one line in place**, in canonical form (`objText`), keeping the line's indentation. Moving a lift never adds a second one.
3. An object the studio adds goes under `edits`.
4. An object the person deletes has its line replaced by `// removed in the studio: <original line>`; Undo brings it back.
5. A statement the studio did not touch prints exactly as it was, comments and spacing included. D68 replaces the old rule that hand-written lines are never rewritten: an edit to an object rewrites that object's own statement in place (splitting or expanding a statement that places several objects or is generated), with its comments kept, as one named undo step. Tile painting keeps the `edits` log and folds it.
6. A drag is one undo step: the first move records the step, later moves of the same drag only update the object.

Moving a room moves its facade: the old facade cells go back to empty and the empty cells of the new rectangle take the facade.

**Real studio:**

- The rewrite must go through the language package (an API beside `appendEdits` that replaces one owned node and prints it with `formatNode`), so it is tested with the rest of the language. The language package has no such API yet.
- A new `arena` goes under `edits`, which the parser accepts for this one top-level word (a level still has at most one, and a second is E006).
- **Built for Fizz 1 items, enemies and the start (D72):** the Inspector's x and y steppers and facing keycaps, Delete, the arrows, F and the Erase tool send a `ThingRef` (kind, index, line, the exact line text and where the thing was seen) with the edit. The engine finds the statement by index and line, or by that text and place if the script moved, and answers `gone` rather than write over a line that changed. A pogo-cache item, exits, doors and anything in a Fizz 2 level are shown with the reason and not edited. The Objects list (with a filter and each thing's line) and the Inspector show the one selection, which follows the thing across its own edits and an outside change.
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

| Lens    | Shows                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gaps    | Every gap, coloured by the rule: up to 3 wide green "a jump clears it", exactly 4 amber "tight: a tenth of a second", 5 or more rose "needs a ledge". A gap is a run of non-solid cells on a surface row, bounded by standing surfaces, with nothing to stand on below (a valley with a bare floor is not a gap). Paint a gap wider or narrower and the colour follows. |
| Ghosts  | Claude's pending cells, dashed purple                                                                                                                                                                                                                                                                                                                                   |
| Reach   | A rough three-tile box around the selection, labelled a rough guide                                                                                                                                                                                                                                                                                                     |
| Hazards | Outlines spikes and chocolate                                                                                                                                                                                                                                                                                                                                           |
| Paths   | Where walking enemies go: a solid bar for a gloop's walk with its length ("gloop: 12 tiles"), a dashed bar for a marshmallow ("marsh: turns only at walls"), a dashed oval 5.2 × 2.8 tiles for a drone ("drone: a fixed loop"), and a 20 × 8 tile box for a hopper ("hopper: jumps when Ben is behind it, inside this box")                                             |

On an overworld: **Links** (cyan lines from each required level to the point it unlocks, and dashed purple lines between paired teleporters), **Areas** (dashed outlines of each `area` rectangle with its name), and **Ghosts**.

The same toggles are in the View menu and the app menu's Lenses submenu. The playtest button in the lens bar is a stand-in in the prototype: it says so and shows no results.

**Real studio:** the Paths lens draws positions from the game host, the game's own code linked natively (`ARCHITECTURE.md` §5); the prototype's JavaScript (`walkExtent`) is a reference and is approximate on slopes. The Gaps lens keeps its label as a design rule until it is checked against the jump physics.

## 7. Script panel and completion

- The script is always in sync with the canvas. The hand-written sections stay as written; every tile change becomes a line under `edits`.
- Lines Claude wrote carry a purple `+` in the gutter; lines still waiting for review are tinted.
- Clicking a line selects its thing on the level. Selecting something highlights its line and the script scrolls to follow it, unless **Following** is turned off. The scroll track has a marker for the selected line and for Claude's lines.
- **Show in script** (Inspector, ring, right-click menu, Ctrl+J) jumps to the line.
- The **typed-line box** under the script takes one line, such as `paint block x=3..5 y=9`, `clear x=2 y=11`, `place cheezie x=40..43 y=7`, an enemy line, or an object line (`hover`, `channel`, `room`, `secret-room`, `arena`; on an overworld `level`, `tele`, `saucer`, `sign`, `area`). Enter or Add applies it as one undo step. A line the editor cannot read gets a plain explanation and a suggested fix, and **Use this fix** fills the box. `paint cheezie ...` is answered with "A cheezie is an item, not a tile. Use place."
- **Completion** appears as the person types: statement words first; after `paint` the tile words, after `place` the item words; then the statement's fields (from `fields` in `docs.ts`, leaving out those already given; flags such as `ride`, `big`, `hidden` without `=`); then values for `req=` (every level slug except the saucer, and `secret`) and `with=` (the overworld's teleporter names). Up to eight suggestions show with the syntax and the note. Arrow keys move, Tab (or Enter on a highlighted row) accepts, Escape closes the list.

How the prototype builds the edits block: it compares the grid with the hand-written level and writes one line per tile word per row, grouped as `paint WORD x=LIST y=N` (or `place`, `clear`, or the enemy word). This is a picture of the difference, not an append-only log.

**Real studio (script tabs, D70):** the Script panel's header holds a tab strip in place of its title text: a `tablist` with roving focus (Left, Right, Home, End; Ctrl+W on a tab closes it), one tab today for the level script, named after its file, with a yellow dot and a close button that turns into a dot while the level has unsaved changes. Closing the tab hides the panel and never closes the level. In a side dock the strip is narrow (tabs keep a minimum width, the full name is the tooltip, and a More tabs menu lists every tab when they overflow); a floating Script has the same strip; while the script is in a window of its own the tab stays in the main window, marked away, and choosing it brings the window forward, and the window's own header shows its one tab. Dragging the tab out of the window tears the Script off into a window of its own, and dragging the window's tab back over the docks docks it where it is let go (`DESKTOP.md` section 6). Behaviour scripts (Fizz 2) are more tabs, one script per window.

**Real studio:** the typed line, the script panel and file loading use `packages/language` (`parse`, `appendEdits`, `print`), so the errors are the language's (E001–E016) and the edits block follows the language's append rule. Whether to offer a person-run "tidy edits" that regroups the block is open (`docs/QUESTIONS.md` Q1). The panel is a real text editor: a person can edit any line, and the studio reparses.

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
- **Locks bind Claude as they bind the person.** A layer the person locked in the Layers panel cannot be changed by Claude's edits in either mode: `edit_level` refuses a line that would touch it and names the layer, `get_level` lists the locked layers, and Claude has no way to lock or unlock. A paint or clear over the cells of a locked tile layer is caught by the studio's check of every change to the file; in Direct mode such a line is written but not taken in, and the person sees a conflict.
- **Check the gaps** is a fixed rule, labelled not AI: it proposes a one-way stone over the middle of every gap five or more tiles wide.

In the prototype there is no AI: Ask cycles through three canned ideas per level (for Crater Fields: stones over the first pool, a hopper past the three-wide gap, a ledge before the red door; for the overworld: a bridge over the river and one more house), and the window says so.

**Real studio:** the buttons reach Claude over MCP (`MCP.md`); Accept and Reject in Review changes are the person's controls that the CLI stands in for today.

## 11. What each screen shows

| Screen              | Shows                                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Level canvas        | Tiles, items and enemies as glyphs on coloured cells, objects as shapes (lift ends A and B with a dashed path, rooms as dashed rectangles labelled room or secret room, the arena as a dashed box nine tiles high), the selection, the dragged area, the stamp preview, ghosts and lenses |
| Overworld canvas    | The map tiles, points as circles (level initials, ⇄ for teleporters, S for the saucer, sign numbers in squares; hidden points dashed; big level points larger), names under level points and teleporters from 24 px zoom, and the Links and Areas lenses                                  |
| Inspector           | The selected thing's name and kind, x and y with steppers, facing (Left, Right) for enemies, its script line with Show in script, Delete (patrol is Fizz 2 only, planned; the last change's author is planned: the snapshot has only the level's last author)                             |
| Checks              | Has a start, has an exit, the playtest bot (stand-in)                                                                                                                                                                                                                                     |
| Navigator           | The whole level with an orange frame for what the canvas shows, shading under windows, the selection in white, and the zoom                                                                                                                                                               |
| History             | Steps by You and Claude, Now, then proposed steps                                                                                                                                                                                                                                         |
| Review changes      | The pending idea's title and why, its hunks and lines, Accept and Reject per hunk and for all                                                                                                                                                                                             |
| Script              | Line numbers, the `+` marks, tinted pending lines, the scroll track, Following, errors with Use this fix, completion in the editor                                                                                                                                                        |
| Shortcuts card      | The key table in §3                                                                                                                                                                                                                                                                       |
| Starter levels card | §9                                                                                                                                                                                                                                                                                        |

## 12. What is canned or not built in the prototype

From the Guide's last step, checked against the code:

- **Canned:** Claude's ideas (a fixed list of three, no AI, no network); Check the gaps (a fixed rule); the playtest bot (plays nothing, shows no results); Save (a message only; the saved layout lasts the session); patrol and facing (stored, no effect).
- **Not built:** Pan; New, Save as, Export, Preferences and Quit; dragging a room's corners or a lift's whole path; Patrol range and Replace with; Grid; the title-bar window buttons.

The Guide's "Not built" list also says the editor does not show enemy walking paths; that line predates the Paths lens, which the same list's "Works" column and the prototype include (computed in JavaScript, approximate on slopes).

## 13. The Fizz 2 target (planned)

Nothing in this section is built. It says what the editor needs so that one editor builds levels for Fizz 2, for Fizz 1 and for the episodes after them. Fizz 2 is the more important target; making Fizz 1 levels stays a goal. The dialect and the capability matrix are in [LANGUAGE.md](LANGUAGE.md#the-fizz-2-dialect-planned), world projects in [WORLD.md](WORLD.md), behaviour scripting in [SCRIPTING.md](SCRIPTING.md), and [FIZZ2-COVERAGE.md](../docs/FIZZ2-COVERAGE.md) maps every Fizz 2 feature to the place it is handled.

### A level's target is fixed

- **New level** asks which target the level is for (Fizz 2, or Fizz 1; later Episode 3) and, for Fizz 2, which world project it belongs to. The answer is written into the file (`script fizz2 0`, or no `script` line for Fizz 1) and **never changes**. The title bar shows the target, the world and the profile's dialect version.
- **The target selects what the level gets.** The tools, the palette and its legend, the object kinds, the sprites, the states and rules, the views, the checks and the exporter all come from the level's target profile. Nothing from the other target is offered, greyed or otherwise; a Fizz 2 level has no Lift tool and a Fizz 1 level has no Rules window.
- **Capability states still show.** Within the target, a **built** capability is offered normally; an **accepted** one (a rule input the current Fizz 2 build refuses at load, a placed light the game does not read yet) is offered with a small "not yet in the game" badge and its W106 or W109; a **reserved** one is shown with a reason on hover. The Capabilities card (Help menu) lists every row of the matrix for the level's profile with its source (a file, a pull request or a change request).
- **Convert up.** Level, Convert to Fizz 2 (on a Fizz 1 level) writes a new Fizz 2 level into a chosen world and opens it beside a **conversion report** window with four lists (carried over, approximated, dropped, to check), each item a link to its place on the canvas ([LANGUAGE.md](LANGUAGE.md#converting-a-fizz-1-level-to-fizz-2)). The Fizz 1 level is not changed.
- **Export down.** File, Export to Fizz 1 (on a Fizz 2 level) runs the lossy check first and shows every loss (E120 to E123, W103, W104, W110) in the Checks window; it writes the Fizz 1 script only when no error stands. It never converts: the Fizz 2 level stays the source.

### Checks

- A Fizz 2 level runs the Fizz 2 checks live: required and unique `id=`, references, kind order, bounds, keys, states, bindings and rules (E110 to E126), the time-rule ranges, conflicts (E119), the W1xx lints, the behaviour scripts' checks (E2xx) and the budgets.
- A Fizz 1 level runs the Fizz 1 checks (E001 to E016) and W103: a level made for Fizz 1 in the studio must not need a wall-kick (D47).
- Lints that stand in for physics (W103, W105) are labelled as design rules, as the Gaps lens is, and take their numbers from the profile; whether a level can really be finished is the playtest bot's answer, run by the game host.

### Windows and tools for a Fizz 2 level

- **Map painting.** The Paint tool writes the `map` block: a stroke rewrites the touched rows in place as one undo step. The map is studio-owned text in the sense of section 4, and the palette shows each tile's legend letter.
- **Objects window.** Keys, snacks, cans, chickens, switches, lights and the world's custom enemies and items, each with its `id=`, kind, position (`at=` or `x=`/`y=`, by the printer rule), kind fields and group, and its baked index, because rules point at indices. Adding an object proposes an id (`cheezie-3`); renaming one rewrites everything that names it in the same undo step; a drag that would reorder kinds is refused.
- **Snap to floor.** A command (and a modifier while dragging) that drops the selected objects to the surface below and writes the position as `at=`. For a snack or key, "on the floor" puts its centre half its sprite above the surface, as the game draws it.
- **States window.** Lists the level's states (and the world's shared ones it uses), each with its value set, start value, everything bound to it and every rule that tests or changes it. A state is added, renamed (rewriting every use) and given values here; Close all doors sets every door's state to its closed value in one undo step and removes an `allow W101` that no longer applies.
- **Bindings on the canvas.** Selecting a door run shows its state and open value in the Inspector; selecting a light or panel shows its `state=` and `on=`. A **Lock** shortcut on a door writes the `lock` sugar line (none, red key, blue key, or any key the profile has).
- **Rules window.** Lists the `when` and `lock` lines as sentences ("When Ben touches the door at 15,21 holding the red key, if red-door is closed, set red-door to open and spend the red key"), each with its input, conditions, delay, actions, repeat flag, baked record index, capability state and lints. An input's rectangle (`enter`) is dragged on the canvas; a cell is picked on the canvas; `take`, `touch`, `hit`, `stomp`, `stun` and `defeat` pick their object from a list of ids of the right kind, or a kind, a group or "any". A `lock` line shows its expansion beside it. A counter shows rules used out of 32.
- **Words and sounds.** The Rules window's Words tab lists the level's strings and the world's, with their style and byte count (out of 30), and previews each in the game's caption font and style colour at the DOS frame width (W107). The Sounds tab lists the world's sound library and plays any entry through the game's Web sound when the game module is loaded; the editor never synthesises a sound. Every `word` and `cue` id is checked (E116). An in-editor sound designer is not in scope (`SCRIPTING.md` section 5).
- **Rule lints inline.** W101, W106, W113, E111, E119 and the rest appear as squiggles in the script panel and badges on the door, light or rule, with Use this fix where there is one.
- **States lens.** Draws each state's bindings (doors, lights, panels), the switches and rule cells and rectangles that change it, and the rules that test it, in one colour per state, with the start value as a label; selecting a state in the States window isolates it. It replaces the Channels lens of the earlier design.
- **Exit and Head room lenses.** The Exit lens marks where Ben can stand in front of each exit cell to press Up (W102). The Head room lens shades passages and jump spaces by the clearance the profile's body leaves, and can compare two body sizes (today's 1.4 tiles and the trial's 2.0) so a level can be checked before a new Ben ships (W105).
- **Lights.** The Light tool (G) places a light; the Inspector sets its radius (drawn as a circle on the canvas), colour or palette bank, falloff, flicker, state and attachment; an attached light is drawn as a dashed line to what it follows. A light-count readout shows how many lights can be in view at once from any camera position (W111).
- **Definitions window and behaviour editor.** For the world's custom enemies and items ([SCRIPTING.md](SCRIPTING.md#6-the-editor)).

### Views: the oblique look by default

- **A Fizz 2 level's canvas is the Game view**: the level drawn as the game draws it, with the oblique ground, the parallax panels, and Night and Sky toggles, so the person edits what the player will see (D45). Grid lines, selection, handles, lenses and ghosts are drawn over it.
- **The flat grid stays as an editing aid** for a Fizz 2 level (a toggle in the View menu), for work that needs every cell square and unobscured, such as long map edits. A Fizz 1 level uses only the flat view.
- **The editor never reimplements the game's drawing.** Every Game view frame is drawn by the game's own presenter code (`fizz-slice-view` and the crates beside it), linked natively in the game host and streamed to the webview over a `Channel` (F5, D59). Until the game has a public "draw this level" call, the canvas falls back to the flat grid with a banner saying the Game view is not available; it never shows a TypeScript imitation. A Game view frame can be checked against the game's frame digests.
- **Night preview.** With Night on, the Game view shows the palette banks and the lights (placed and derived), with the frame's light count and the game's own frame cost when it reports one.

### Budgets

A **Budget window** shows meters for what a level and its world cost, each saying where its number came from:

| Meter                  | Limit                                                                                                                                                 | Source                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Rules, states, strings | 32 each per level (states of up to 8 values)                                                                                                          | The profile (F10, F11)                                                              |
| Objects                | `u16`; the practical limit is the state hash and the drawing                                                                                          | `LEVL` header                                                                       |
| `LEVL` section size    | Decoded and stored bytes                                                                                                                              | `fizz-bake`; otherwise an estimate, labelled "estimate"                             |
| World pack             | Its levels, definitions, bytecode, sprites (with the retro set), panels and sounds                                                                    | `fizz-bake`'s world build report ([WORLD.md](WORLD.md#4-building-the-world-pack))   |
| Floppy                 | `BUDGET 1100000` bytes for `FIZZ2.EXE` and the packs together (provisional), with the 8 KB and 64 KB reserves of the two images                       | Fizz 2's `docs/PLATFORM.md` and `docs/FAP.md`; `FIZZ2.EXE` is 374,272 bytes on #146 |
| Section limit          | 96 KB decoded per section by default                                                                                                                  | `SECTION_LIMIT` in `fizz-pack`                                                      |
| Lights                 | 16 active (15 in view kept as a margin), a pool of 32; DOS frame cost                                                                                 | #146; frame cost from the game's bench (F22)                                        |
| Behaviour cost         | Worst-case instructions per entity and per level per tick against the profile's step budgets; `BHVR` and `DEFS` sizes; an estimated DOS cost per tick | The compiler; the game's bench (F22)                                                |
| Panels                 | Panel bytes and the DOS cost of drawing them at Full and Light Sky detail                                                                             | `fizz-bake`; the game's bench (F22)                                                 |

- A meter never claims a number it did not get: an estimate says so, and a meter whose source is not available reads "not run" (G-TRUST-4).
- **Decided (D73, Q46, 2026-11-07), planned for Studio M2 and not built:** the `LEVL` section size meter becomes the level's size limit: the level's whole decoded section (every plane, layer, and table) against the profile's section limit, with information at 32 KB, a warning at 75%, and an error over 100% that stops Build world, the tiles, each plane, each layer, and the tables shown as parts of the bar. New level and Resize show the same readout and take any width and height that fit, with the presets Run 192 × 28 (the default), Cave 96 × 76, Tower 64 × 160, Deep 128 × 160, and Wide 256 × 64; this byte budget replaces today's 1024 × 128 creation caps. The numbers are firmed up by measuring before Studio M2. See [LEVEL-MODEL.md](../docs/LEVEL-MODEL.md#3-size).
- **Proposed (D73):** the Reach lens and the Checks window take their answers from the game's solvability check (F25); the severities are open (Q47).
- The DOS floor (a 486DX with 4 MB, #143) and the 60 Hz frame are the reference for the cost meters; today Full night averages 17.1 ms on the 486DX2-66 model against the 16.7 ms step (#146), which is the kind of figure the lights and panels meters show.

### Dump view

A read-only view of what the baker would produce for the level: the sorted object list with indices, the state table, the bindings, the rule table as records with every `lock` expanded, the string table, and the bake's own disassembly (`fizz-bake dump`, planned). It is a view, not an editor, and says so; until the baker exists it reads "not run".

### What the editor does not do

- It does not run rules or behaviours. They belong to the Fizz 2 simulation, reached through the game host (the playtest bot, the behaviour preview and debugger).
- It does not draw the game's look. The Game view is the game's presenter.
- It does not bake. Build world runs `fizz-bake`; the baker writes the packs, manifests and digests.
- It does not define formats the Fizz 2 repository has not defined; it proposes them as change requests and follows the game when it decides.

## 14. Sprites (planned)

Nothing in this section is built. Fizz 2's sprite rules are in its `docs/SPRITES.md`; where this section and that file disagree, that file wins. Drawing and touching up sprites is the pixel editor's job (section 15).

### What a sprite is in each game

- **Fizz 2.** Sprites are committed text grids: one JSON file per set under `assets/sprites/<set>.json` (and, for a world, the world's `sprites/`), canonical (fixed key order, one row per line, final newline), each sprite with a `name` unique across all files, `w` and `h` (1 to 255), an `anchor` (default the feet and centre, `[w / 2, h]`), a `source` and `rows` of palette letters, `.` for transparent. The palette is the 16 EGA colours, letters `k B G C R M N L D b g c r m y W` for indices 0 to 15. Until the `SPRT` pack section is specified (F7), the grids are lowered to `const` data in `fizz-view`.
- **Fizz 1.** Sprites are generated by its TypeScript sprite code and named in `SPRITE_NAMES`; a Fizz 1 level only names them. The Fizz 2 repository's exporter (`tools/sprites/export-fizz1.ts`) already turns them into grids, which is how the retro art set reaches a Fizz 2 world ([WORLD.md](WORLD.md#5-the-retro-art-set)).
- **Sources decide what can be edited.** `generated:fizz1` and `generated:ep2-canvas` sets are read-only (change the generator and re-export), as is an imported retro set; `drawn` sets are editable.

### How a level uses sprites

A level names **kinds**, not sprites (D39). The game picks each frame from an object's kind and state: a chicken draws `cluckzarg_idle`, `walk`, `walk2` or `alert` with the `cluckzarg_beak` overlay when it clucks; a snack draws `cheezie`, `choc`, `cookie` or `soda`; keys draw `keyRed` and `keyBlue`, doors `doorRed` and `doorBlue`; Ben's pose comes from the presenter's rule. A custom enemy or item names its sprite per state in its definition ([SCRIPTING.md](SCRIPTING.md#21-definitions)), which is where sprite choice lives for new content.

- The canvas draws each object with its kind's idle frame from the world's sprite sets (the retro set on a retro level), placed by its anchor and flipped by its facing. The profile and the world's definitions map kinds to sprite names; nothing is hard-coded.
- The Inspector shows the object's sprite and its states. **Animation preview** steps through a kind's frames; the cadence of the real game is a presenter rule, so the preview either asks the game for its frame sequence or labels its own fixed cadence "preview cadence, not the game's".

### The Sprites window

- A browser of every sprite set the world has, grouped by set and by the kind or state it serves, with each sprite's name, size, anchor (drawn as a cross), source and whether it is provisional (`note`), at 1x to 8x on the level's background and at the night ambient.
- **Ben's poses.** The pose workshop's frames (`ep2-ben-lab`, trial branch `trial/lab-ben-sprites`, `7b948ae`: standing at 14 by 33, look and bend at 19 by 31, six-frame runs and fire at 25 by 33) beside Fizz 1's 16 by 24 Ben and the provisional `benA_*` frames. The profile records which set ships (Fizz 1's today) and the body size that goes with it, which drives the Head room lens and W105.
- **Enemies and pickups:** the built-in roster with its states, the world's custom definitions, the pickups and the HUD keys. A kind with no sprite for a state is drawn as a labelled placeholder box, never as another kind's art (W205).
- **Retro art.** The imported Fizz 1 set, with a note on each sprite whose box differs from the Fizz 2 body it is drawn over.
- **Overworld level sprites.** For a target with an overworld (Fizz 1 today), the picker filtered to landmark sprites (`OwLm*`, `OwCastle`, `Saucer`) sets a level point's sprite ([OVERWORLD.md](OVERWORLD.md#8-sprites)).

### How sprites reach a pack

The studio never writes a pack. Sprites flow from the world's sprite files through `fizz-bake` into the `SPRT` section of the world pack (and Ben and the HUD into `SHARED.FAP`), once `SPRT` is specified (F7: bits per pixel, a mask or a colour key, runs, the index and the Web form are all open). Level files name kinds, so a level does not change when its art does.

### What is not known

- The `SPRT` layout and whether sprites get numeric ids in place of names.
- Which Ben ships, and with it Ben's body size (the trial's 0.8 by 2.0 moves the state hash and the golden replay).
- The built-in roster's kinds, their sprite sets and state names.
- Whether a level can choose a sprite variant per object beyond what a custom definition gives.
- Whether the Web form of a sprite may be richer than the DOS form.

## 15. Art: the pixel editor (planned)

Nothing in this section is built. The pixel editor is the studio's one tool for painting 16-colour art (D52). It is its own milestone in [ROADMAP.md](../docs/ROADMAP.md).

### What it paints

| Art                                         | Reach                                                                                                                                                    | Why                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Parallax panels                             | Full: import, paint, touch up, set panel properties                                                                                                      | Panels are world art in the world's `panels/`, packed in `BDRP` (F19)                               |
| Sprites in `drawn` sets                     | Full: paint frames, set anchors, add and order frames, preview animation                                                                                 | Fizz 2's `docs/SPRITES.md` says `drawn` sprites are editable in an editor, written back canonically |
| Sprites in generated sets and the retro set | View and copy only: a copy can become a new `drawn` sprite                                                                                               | Generated sets change only through their generator                                                  |
| Tile textures                               | Not at first. Fizz 2's tile looks are generated code tables (`oblique_data.rs` from `tools/tiles/emit-oblique.ts`, #143), chosen by tile class, not data | Reaches tiles only if the Fizz 2 repository moves tile textures to data (F14, Q34)                  |
| HUD, fonts, title art                       | Out of scope                                                                                                                                             | They belong to the game, not to a world                                                             |

### Parallax panels

- **Import a PNG**, quantised to the 16-colour EGA palette with a side-by-side preview of the source and the result, a choice of nearest colour or an ordered dither (the 2 by 2 pattern Fizz 2 uses for its lights, #146), and a transparency choice (a colour key or the image's alpha, thresholded). The quantiser is the studio's art tool, not a game rule; the result is saved as a palette grid, and the source image is kept beside it so a re-import is repeatable.
- **Per panel:** horizontal and vertical scroll factors (out of 256, as `fizz_view::parallax` takes them, #144), repeat (across, down, both or none), vertical position (a base row, or pinned to the horizon), and the open-air rule (drawn only behind `.` cells, as today's layers are, or also behind `w` cells), plus an optional `state=` to show or hide it. The order of panels in the stack is the drawing order, back to front.
- **The Game view shows them** through the game's presenter, so a panel is judged in place at both Sky details.

### The tool

- Pencil, line, rectangle, fill, colour pick and a 16-colour palette with the EGA letters; mirror, shift and rotate by quarter turns; onion skin across frames; zoom from 1x to 16x with a pixel grid; a second window at 1x.
- **The EGA constraints are enforced:** 16 colours and no others, 255 never a colour, sizes within the format's limits (1 to 255 for a sprite; the panel limits are F19's), names unique across the world's sets. The night palette banks dim a colour and cannot tint it (#146), so a preview at the night ambient shows whether the art still reads. The colour roles of `docs/OBLIQUE.md` (dark colours build the world, bright colours mark what Ben can touch) are a lint on pickups, hazards and panels.
- **Canonical files.** A sprite is written with the canonical rules (`tools/sprites/lib.ts` is the reference), and opening and saving without a change leaves the bytes unchanged. After saving sprites in the game's own `assets/sprites/`, the studio reminds the person that `bun tools/sprites/emit-rust.ts` must run there; in a world project, `fizz-bake` reads the files directly.
