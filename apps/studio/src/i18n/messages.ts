// The message catalogue: every user-visible string the app shows, keyed by a stable identifier
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { activeMessages, formatLocale, pluralLocale } from './active';

/**
 * English (`en-CA`), the source catalogue and the fallback for any message another locale lacks.
 * Screens and the chrome's labels read their copy through `t()`, never from a literal in JSX. Keys
 * are `area.thing`, and a value is plain text with `{name}` tokens. Plurals are a `.one` and an
 * `.other` message (another language may add `.zero`, `.two`, `.few` and `.many`), chosen by `tn`
 * with `Intl.PluralRules`.
 *
 * A comment `// translator: ...` directly above a key is context for whoever translates it. Use
 * one where a short word is ambiguous (a verb or a noun? which of two senses?).
 */
export const enMessages = {
	// translator: The product name, “Fizz Level Studio”. “Fizz” is the game’s hero and is not translated.
	'app.name': 'Fizz Level Studio',

	// translator: The title of the main window while no level is open, shown in its title bar and in the taskbar. It names the start screen, not the app.
	'window.main.start': 'Start',

	// translator: Verb. Puts a maximised window back to its earlier size. Appears on a window button.
	'chrome.restore': 'Restore',
	// translator: Verb. Makes the window fill the screen. Appears on a window button.
	'chrome.maximise': 'Maximise',
	// translator: Verb. Hides the window to the taskbar. Appears on a window button.
	'chrome.minimise': 'Minimise',
	// translator: Verb. Lets the person drag the window to a new place. A window menu entry.
	'chrome.move': 'Move',
	// translator: A toggle that keeps the window above other windows. A window menu entry.
	'chrome.alwaysOnTop': 'Always on Top',
	// translator: A window menu entry that opens the desktop’s own window menu.
	'chrome.systemWindowMenu': 'More options…',
	// translator: Verb. Closes the window. Appears on a window button.
	'chrome.close': 'Close',
	// translator: Accessible name of the window’s menu, read aloud by a screen reader.
	'chrome.windowMenu': 'Window menu',
	// translator: Accessible name of the group of window buttons (minimise, maximise, close).
	'chrome.windowControls': 'Window controls',
	// translator: The accessible name of the group of editing tools.
	'tools.group': 'Tools',
	// translator: Verb. A tool that lays the brush down where the pointer drags: a tile, a row of items or one enemy.
	'tools.paint': 'Paint',
	// translator: Verb. A tool that clears the tiles of the cells the pointer drags over.
	'tools.erase': 'Erase',
	// translator: Verb. A tool that copies what is on the cell under the pointer into the brush.
	'tools.pick': 'Pick',
	// translator: Verb. A tool that outlines a rectangle of cells.
	'tools.select': 'Select',
	// translator: Verb. A tool that pastes the outlined rectangle, copied when the tool is chosen, where the pointer presses, like a rubber stamp.
	'tools.stamp': 'Stamp',
	// translator: Verb. A tool that selects what is on the cell the pointer presses (an item, an enemy, Ben's start, or the cell and its tile) so it can be looked at; it changes nothing.
	'tools.inspect': 'Inspect',
	// translator: A hint shown while the Stamp tool has nothing copied yet.
	'tools.stampEmpty': 'Outline an area with Select, then choose Stamp to paste it.',
	// translator: The accessible name of the row above the level that holds Save, Close level, the brush chip and the Panels menu.
	'tools.bar': 'Editor toolbar',
	// translator: Label of the grip a person drags, or moves with the arrow keys, to move the floating group of tools over the level.
	'tools.move': 'Move the tools',
	// translator: Tooltip of a tool's key. {tool} is the tool’s name, such as “Paint”; {key} is the letter that chooses it, such as “B”.
	'tools.keyTitle': '{tool} ({key})',
	// translator: The brush chip in the toolbar. {kind} is the name of the tile, item or enemy that Paint lays down, such as “cheezie”.
	'brush.chip': 'Brush: {kind}',
	// translator: The brush chip when the brush is an item that is spaced out. {kind} is the item; {spacing} says how far apart, such as “Every 3 cells”.
	'brush.chipSpaced': 'Brush: {kind}, {spacing}',
	// translator: The kind of thing the brush lays down: a tile of the grid.
	'brush.group.tile': 'Tile',
	// translator: The kind of thing the brush lays down: an item, a collectable such as a cheezie or a key.
	'brush.group.item': 'Item',
	// translator: The kind of thing the brush lays down: an enemy, or a prop the game places like one (a switch, a terminal).
	'brush.group.enemy': 'Enemy',
	// translator: Accessible name of the group holding the item spacing control.
	'spacing.group': 'Item spacing',
	// translator: Label before the control that sets how many cells apart a dragged row of items is placed.
	'spacing.label': 'Spacing',
	// translator: The spacing when every cell gets an item.
	'spacing.everyCell': 'Every cell',
	// translator: The spacing when only some cells get an item. {n} is a whole number from 2 to 8, such as “Every 3 cells”.
	'spacing.everyN': 'Every {n} cells',
	// translator: Visible text of the button that puts dragged items closer together: a minus sign.
	'spacing.lessGlyph': '−',
	// translator: Visible text of the button that puts dragged items further apart: a plus sign.
	'spacing.moreGlyph': '+',
	// translator: Accessible name of the button that puts dragged items closer together.
	'spacing.less': 'Place items closer together',
	// translator: Accessible name of the button that puts dragged items further apart.
	'spacing.more': 'Place items further apart',

	// translator: Accessible name of the level canvas. {name} is the level’s name; the size is in cells.
	'canvas.label': 'Level canvas, {name}, {width} by {height} cells',
	// translator: Describes the cell the keyboard cursor is on: its column, row and tile word.
	'canvas.cell': 'Cell {x}, {y}: {tile}',
	// translator: Verb. Makes the level canvas show larger cells.
	'canvas.zoomIn': 'Zoom in',
	// translator: Verb. Makes the level canvas show smaller cells.
	'canvas.zoomOut': 'Zoom out',
	// translator: The zoom factor of the canvas, such as 4×.
	'canvas.zoomLevel': 'Zoom {zoom}×',
	// translator: Accessible name of the group holding the canvas’s zoom buttons.
	'canvas.zoomGroup': 'Canvas zoom',
	// translator: The zoom factor shown on the zoom control, such as 4×. {zoom} is a whole number from 1 to 16.
	'canvas.zoomFactor': '{zoom}×',
	// translator: Short label on the button of the zoom control that fits the whole level in the room there is.
	'canvas.zoomFitShort': 'Fit',
	// translator: Verb phrase. Chooses the largest whole zoom that shows the whole level in the room there is.
	'canvas.zoomFit': 'Fit level',
	// translator: Tooltip on a disabled Zoom in button: the canvas is already at its largest.
	'canvas.zoomMax': 'Already at the largest zoom',
	// translator: Tooltip on a disabled Zoom out button: the canvas is already at its smallest.
	'canvas.zoomMin': 'Already at the smallest zoom',

	// translator: Accessible name of the list of things placed in the level, such as items and enemy spawns.
	'objects.list': 'Objects',
	// translator: An item (a collectable) placed in the level, at a column and a row.
	'objects.item': 'Item {kind} at {x}, {y}',
	// translator: An enemy or object spawn at a column and a row.
	'objects.spawn': 'Spawn {kind} at {x}, {y}',
	// translator: An enemy or object spawn that has a column but no row (it drops to the ground).
	'objects.spawnGround': 'Spawn {kind} at column {x}',
	// translator: Where the hero, Ben, starts the level.
	'objects.start': 'Ben’s start at {x}, {y}',
	// translator: A problem found in the script: its line number, its code and its message.
	'objects.diagnostic': 'Line {line}, {code}: {message}',
	// translator: Shown in place of the list of objects when the level has none.
	'objects.none': 'Nothing placed yet',

	// translator: Heading of the panel that shows the level’s script text.
	'script.title': 'Script',
	// translator: Accessible name of the read-only block that shows the script’s text.
	'script.text': 'Script text',
	// translator: Heading of the list of problems found in the script.
	'script.diagnostics': 'Problems',
	// translator: Shown when the script has no problems.
	'script.noProblems': 'No problems',
	// translator: A link to a script line that has a problem: line number, code and message.
	'script.problem': 'Line {line}: {code} {message}',
	// translator: The text of a problem marked in the script: error code, then the message.
	'script.lint': '{code} {message}',
	// translator: Label above the way a script word is written, in its documentation popup.
	'script.docSyntax': 'Syntax',
	// translator: Label above an example line, in a script word’s documentation popup.
	'script.docExample': 'Example',
	// translator: Accessible name of the popup that documents the script word under the cursor.
	'script.docPopup': 'Documentation',
	// translator: Short label of what a completion is, shown beside it: a statement word.
	'script.kind.statement': 'statement',
	// translator: Short label of what a completion is: a section heading such as “blocks”.
	'script.kind.section': 'section',
	// translator: Short label of what a completion is: a piece of terrain.
	'script.kind.segment': 'terrain',
	// translator: Short label of what a completion is: a kind of tile.
	'script.kind.tile': 'tile',
	// translator: Short label of what a completion is: a collectable item.
	'script.kind.item': 'item',
	// translator: Short label of what a completion is: an enemy.
	'script.kind.enemy': 'enemy',
	// translator: Short label of what a completion is: a named field of a statement, such as “x”.
	'script.kind.field': 'field',
	// translator: The editor’s own wording, “Fold line”: a tooltip on the gutter button that hides a section.
	'script.cm.foldLine': 'Fold line',
	// translator: Tooltip on the gutter button that shows a hidden section again.
	'script.cm.unfoldLine': 'Unfold line',
	// translator: Announced when lines are hidden by folding.
	'script.cm.foldedLines': 'Folded lines',
	// translator: Announced when hidden lines are shown again.
	'script.cm.unfoldedLines': 'Unfolded lines',
	// translator: Text standing in for the lines a fold hides.
	'script.cm.foldedCode': 'folded code',
	// translator: Tooltip on the marker that shows a folded section again.
	'script.cm.unfold': 'unfold',
	// translator: Joins two line numbers in an announcement, such as “1 to 5”.
	'script.cm.to': 'to',
	// translator: Heading of the box that jumps to a line number.
	'script.cm.gotoLine': 'Go to line',
	// translator: Button that jumps to the typed line number.
	'script.cm.go': 'go',
	// translator: Label of the search field.
	'script.cm.find': 'Find',
	// translator: Label of the replace field.
	'script.cm.replaceLabel': 'Replace',
	// translator: Button that finds the next match.
	'script.cm.next': 'next',
	// translator: Button that finds the previous match.
	'script.cm.previous': 'previous',
	// translator: Button that selects every match.
	'script.cm.all': 'all',
	// translator: Option that makes a search care about capital letters.
	'script.cm.matchCase': 'match case',
	// translator: Option that reads the search as a regular expression.
	'script.cm.regexp': 'regexp',
	// translator: Option that matches whole words only.
	'script.cm.byWord': 'by word',
	// translator: Button that replaces the current match.
	'script.cm.replace': 'replace',
	// translator: Button that replaces every match.
	'script.cm.replaceAll': 'replace all',
	// translator: Button that closes a search or other small panel.
	'script.cm.close': 'close',
	// translator: Announced for the match the search is on.
	'script.cm.currentMatch': 'current match',
	// translator: Announced after “match” to say which line it is on, such as “match on line 4”.
	'script.cm.onLine': 'on line',
	// translator: Announced after one match is replaced. The $ stands for the line number.
	'script.cm.replacedMatchOnLine': 'replaced match on line $',
	// translator: Announced after every match is replaced. The $ stands for how many.
	'script.cm.replacedMatches': 'replaced $ matches',
	// translator: Name of the list of problems that the editor can show.
	'script.cm.diagnostics': 'Diagnostics',
	// translator: Shown in that list when the script has no problems.
	'script.cm.noDiagnostics': 'No diagnostics',
	// translator: Accessible name of the list of suggested words that opens while typing.
	'script.cm.completions': 'Completions',
	// translator: Announced when a selection is removed by an editing command.
	'script.cm.selectionDeleted': 'Selection deleted',
	// translator: Announced for a control character that the editor shows as a symbol.
	'script.cm.controlCharacter': 'Control character',

	// translator: Heading of the panel that lists the words the person can paint or place with.
	'palette.title': 'Palette',
	// translator: Heading of the Palette section with the kinds of ground and wall: blocks, slopes, doors and the like.
	'palette.section.terrain': 'Terrain',
	// translator: Heading of the Palette section with the things that hurt, such as spikes.
	'palette.section.hazards': 'Hazards',
	// translator: Heading of the Palette section with the collectable items, such as a cookie or a key.
	'palette.section.treats': 'Treats',
	// translator: Heading of the Palette section with the enemies and the props that are placed like enemies.
	'palette.section.enemies': 'Enemies',
	// translator: Heading of the Palette section with the markers of a level, such as its exit.
	'palette.section.markers': 'Markers',
	// translator: Shown in place of the Palette’s item and enemy lists while the words are loading or unavailable.
	'palette.unavailable': 'The word list is not available.',

	// translator: Heading of the panel that shows what Claude has proposed and the person has not yet answered.
	'ghosts.title': 'Proposals',
	// translator: Label of the switch that shows or hides Claude’s proposed changes as faint cells on the canvas.
	'ghosts.show': 'Show Claude’s proposals on the canvas',
	// translator: Button that reads Claude’s proposals again.
	'ghosts.refresh': 'Refresh',
	// translator: Shown when Claude has no pending proposals.
	'ghosts.none': 'Nothing proposed',
	// translator: How many cells a pending proposal changes, shown beside its title.
	'ghosts.cells.one': '{count} cell',
	// translator: How many cells a pending proposal changes, shown beside its title.
	'ghosts.cells.other': '{count} cells',
	// translator: Note that the proposals can be seen but not yet accepted or rejected here.
	'ghosts.readOnly': 'You can see proposals here. Accepting and rejecting them comes later.',

	// translator: Verb phrase on a button. Closes a panel’s own window and puts the panel back in the main window.
	'panel.dockBack': 'Dock back',
	// translator: Shown in the main window in place of a panel while the panel is in its own window. {title} is the panel’s name, such as “Script”.
	'panel.tornOff': 'The {title} panel is open in its own window.',
	// translator: Name of a docked panel’s tab, or of its folded dock’s rail button, while the panel is in its own window. {title} is the panel’s name.
	'panel.awayTitle': '{title} (own window)',
	// translator: Label of the grip a person drags, or moves with the arrow keys, to move a floating panel. {title} is the panel’s name.
	'float.move': 'Move {title}',
	// translator: Label of the corner grip a person drags, or presses the arrow keys on, to resize a floating panel. {title} is the panel’s name.
	'float.resize': 'Resize {title}',
	// translator: Verb phrase on a button. Shrinks a floating panel to just its title bar. {title} is the panel’s name.
	'float.collapse': 'Collapse {title}',
	// translator: Verb phrase on a button. Opens a collapsed floating panel again. {title} is the panel’s name.
	'float.expand': 'Expand {title}',
	// translator: Label of the button that opens the list of floating panels, where each can be shown or hidden.
	'panels.menu': 'Panels',
	// translator: Verb phrase on a menu item. Puts every floating panel back where it starts.
	'panels.reset': 'Reset layout',

	// translator: Verb phrase on a menu item. Opens the command palette, a search box that finds and runs any command. The three dots mean it asks for more input.
	'appMenu.commandPalette': 'Command palette…',
	// translator: A switch in the View menu. Shows or hides the menu bar (File, Edit, View, Window, Help) under the title bar.
	'appMenu.menuBar': 'Menu bar',
	// translator: A submenu of the Window menu. Lists the workspaces, each a saved arrangement of the panels, to switch between.
	'appMenu.workspace': 'Workspace',
	// translator: Menu row. Lets the panel the person last used float over the level.
	'appMenu.floatFocused': 'Float the focused panel',
	// translator: Menu row. Moves the panel the person last used into a window of its own.
	'appMenu.tearOffFocused': 'Tear off the focused panel',
	// translator: Menu row. Brings every panel that is in a window of its own back into the main window.
	'appMenu.dockAllBack': 'Dock every window back',
	// translator: Tooltip on a disabled Window row: no panel has been used yet.
	'appMenu.noFocusedPanel': 'Click a panel first',
	// translator: Tooltip on a disabled row: no panel is in a window of its own.
	'appMenu.noWindows': 'No panel is in a window of its own',
	// translator: Name of a workspace, a saved arrangement of the panels for painting the level. Also a menu row that switches to it.
	'workspace.paint': 'Paint',
	// translator: Name of a workspace, a saved arrangement of the panels for writing the level’s script. Also a menu row that switches to it.
	'workspace.script': 'Script',
	// translator: Name of a workspace, a saved arrangement of the panels for reviewing Claude’s proposals. Also a menu row that switches to it.
	'workspace.review': 'Review',
	// translator: Tooltip on a disabled workspace row: that workspace is the one in use.
	'workspace.current': 'This workspace is open',
	// translator: The name of the command palette dialog, read aloud by a screen reader. It is a search box listing every command.
	'cmdPalette.title': 'Command palette',
	// translator: Accessible name of the search field in the command palette.
	'cmdPalette.search': 'Search commands',
	// translator: Placeholder in the command palette’s search field.
	'cmdPalette.placeholder': 'Type a command…',
	// translator: Accessible name of the list of commands in the command palette.
	'cmdPalette.list': 'Commands',
	// translator: Heading above the commands the person ran most recently, in the command palette.
	'cmdPalette.recent': 'Recent',
	// translator: Shown in the command palette when nothing matches what was typed.
	'cmdPalette.empty': 'No matching commands',
	// translator: Heading in the command palette above the editing tools (Paint, Erase and the rest). Plural noun.
	'cmdPalette.group.tools': 'Tools',
	// translator: Heading in the command palette above the brushes: the tiles, items and enemies Paint can lay down. Plural noun.
	'cmdPalette.group.brushes': 'Brushes',
	// translator: Heading in the command palette above the commands that show, hide and arrange the editor’s panels. Plural noun.
	'cmdPalette.group.panels': 'Panels',
	// translator: Heading in the command palette above the commands from the File menu.
	'cmdPalette.group.file': 'File',
	// translator: Heading in the command palette above the commands from the Edit menu.
	'cmdPalette.group.edit': 'Edit',
	// translator: Heading in the command palette above the commands from the View menu.
	'cmdPalette.group.view': 'View',
	// translator: Heading in the command palette above the commands from the Window menu.
	'cmdPalette.group.window': 'Window',
	// translator: Heading in the command palette above the commands from the Help menu.
	'cmdPalette.group.help': 'Help',
	// translator: Heading in the command palette above the commands that move to a place in the level, such as a line of its script.
	'cmdPalette.group.goto': 'Go to',
	// translator: Why a command in the command palette is dimmed: no level is open yet.
	'cmdPalette.needsLevel': 'Open a level first',
	// translator: Why a command in the command palette is dimmed: it cannot run at the moment.
	'cmdPalette.unavailableNow': 'Not available right now',
	// translator: A command in the command palette. {panel} is the name of a panel, such as “Script”. Verb phrase.
	'cmdPalette.showPanel': 'Show {panel}',
	// translator: A command in the command palette. {panel} is the name of a panel, such as “Script”. Verb phrase.
	'cmdPalette.hidePanel': 'Hide {panel}',
	// translator: A command in the command palette. Moves a panel out of the main window into a window of its own. {panel} is the name of a panel, such as “Script”. Verb phrase.
	'cmdPalette.tearOffPanel': 'Tear off {panel}',
	// translator: A command in the command palette. Closes a panel’s own window and puts the panel back where it was. {panel} is the name of a panel, such as “Script”. Verb phrase.
	'cmdPalette.dockPanelBack': 'Dock {panel} back',
	// translator: A command in the command palette that chooses the brush. {name} is the tile, item or enemy, such as “cheezie”.
	'cmdPalette.brush': 'Brush: {name}',
	// translator: A command in the command palette. It asks for a line number, then shows that line of the level’s script. The three dots mean it asks for more input.
	'cmdPalette.gotoLine': 'Go to line…',
	// translator: Accessible name of the field where a line number is typed, after choosing “Go to line…” in the command palette.
	'cmdPalette.lineField': 'Line number',
	// translator: Placeholder of the line number field. {count} is how many lines the script has.
	'cmdPalette.linePlaceholder': 'Line number, 1 to {count}',
	// translator: Error under the line number field. {count} is how many lines the script has.
	'cmdPalette.lineInvalid': 'Enter a line from 1 to {count}.',
	// translator: Footer hint of the command palette. Follows the up and down arrow keys. Verb: moves the highlight.
	'cmdPalette.hintMove': 'Move',
	// translator: Footer hint of the command palette. Follows the Enter key. Verb: runs the highlighted command.
	'cmdPalette.hintRun': 'Run',
	// translator: Footer hint of the command palette. Follows the Escape key. Verb: closes the palette.
	'cmdPalette.hintClose': 'Close',
	// translator: The name of the Enter key, written on a keycap.
	'cmdPalette.keyEnter': 'Enter',
	// translator: The name of the Escape key, written on a keycap. Keep it short.
	'cmdPalette.keyEscape': 'Esc',

	// translator: Name of the dock on the left of the level, where panels sit as tabs. Used as a region name.
	'dock.zone.left': 'Left dock',
	// translator: Name of the dock on the right of the level, where panels sit as tabs. Used as a region name.
	'dock.zone.right': 'Right dock',
	// translator: Name of the dock below the level, where panels sit as tabs. Used as a region name.
	'dock.zone.bottom': 'Bottom dock',
	// translator: Verb phrase. Names the command that moves a panel into the dock on the left of the level. {title} is the panel’s name.
	'dock.dockLeft': 'Dock {title} left',
	// translator: Verb phrase. Names the command that moves a panel into the dock on the right of the level. {title} is the panel’s name.
	'dock.dockRight': 'Dock {title} right',
	// translator: Verb phrase. Names the command that moves a panel into the dock below the level. {title} is the panel’s name.
	'dock.dockBottom': 'Dock {title} bottom',
	// translator: Verb phrase. Names the command that lets a panel float over the level. {title} is the panel’s name.
	'dock.float': 'Float {title}',

	// translator: Accessible name and tooltip of the ⋮ button in a panel’s header, which opens that panel’s menu. {title} is the panel’s name.
	'dock.menu.button': '{title} menu',
	// translator: Tooltip on the rail entry of the panel that is showing in an open dock. Choosing it again folds the dock. {title} is the panel’s name.
	'dock.rail.hintOpen': '{title}, open; choose again to fold',
	// translator: Tooltip on the rail entry of a folded dock’s panel. Choosing it opens the dock. {title} is the panel’s name.
	'dock.rail.hintFolded': '{title}, folded; choose to open',
	// translator: Name of the Assets panel, shown dimmed on the rail because it is not built yet.
	'dock.assets': 'Assets',
	// translator: Accessible name of the row of tabs in the Script panel’s header, one tab for each open script.
	'scriptTabs.label': 'Scripts',
	// translator: Accessible name of a script tab’s close button. {name} is the script’s file name. Closing a tab hides the Script panel; it does not close the level.
	'scriptTabs.close': 'Close {name}',
	// translator: Accessible name of a script tab’s close button when the script has changes that are not saved. {name} is the script’s file name.
	'scriptTabs.closeDirty': 'Close {name}, unsaved changes',
	// translator: Tooltip of the tab of a script that is open in a window of its own. Choosing it brings that window forward. {name} is the script’s file name.
	'scriptTabs.away': '{name}, open in its own window; choose to bring it forward',
	// translator: Accessible name and tooltip of the button that lists every script tab when they do not all fit in a narrow header.
	'scriptTabs.more': 'More tabs',
	// translator: Command palette entry. Shows the Script panel with the level’s script tab.
	'scriptTabs.activate': 'Show the level script tab',
	// translator: Command palette entry. Closes the level’s script tab, which hides the Script panel. The level stays open.
	'scriptTabs.closeCommand': 'Close the level script tab',
	// translator: Label of a Preferences setting. The commands row is the row of buttons under the menus: the classic toolbar, the ribbon, or nothing.
	'toolbar.setting.label': 'Commands row',
	// translator: Description of the commands row setting in Preferences.
	'toolbar.setting.description':
		'The classic toolbar is one row of buttons. The ribbon groups the commands under tabs. None leaves the menus and the command palette.',
	// translator: A choice of the commands row setting: one row of buttons. Keep it short.
	'toolbar.setting.classic': 'Toolbar',
	// translator: A choice of the commands row setting: commands grouped under tabs, as in an office program. Keep it short.
	'toolbar.setting.ribbon': 'Ribbon',
	// translator: A choice of the commands row setting: no commands row. Keep it short.
	'toolbar.setting.hidden': 'None',
	// translator: Tooltip on the dimmed Assets entry of the rail: the panel will come in a later version.
	'dock.assets.later': 'Assets are coming later',
	// translator: A row in a panel’s own menu. Moves that panel into the dock on the left of the level. The panel is already named by the menu.
	'dock.menu.left': 'Dock left',
	// translator: A row in a panel’s own menu. Moves that panel into the dock on the right of the level.
	'dock.menu.right': 'Dock right',
	// translator: A row in a panel’s own menu. Moves that panel into the dock below the level.
	'dock.menu.bottom': 'Dock bottom',
	// translator: A row in a panel’s own menu. Lets that panel float over the level.
	'dock.menu.float': 'Float',
	// translator: A row in a panel’s own menu. Moves that panel out of the main window into a window of its own.
	'dock.menu.tearOff': 'Tear off',
	// translator: A row in the menu of a panel that is in a window of its own. Brings it back into the main window.
	'dock.menu.dockBack': 'Dock back',
	// translator: Tooltip on a disabled row of a panel’s menu: the panel is already in that place.
	'dock.menu.here': 'Already here',
	// translator: Name of the thin strip along the left edge of the window beside the left dock. It holds one button for each panel in the dock, showing its icon and title.
	'dock.rail.left': 'Left rail',
	// translator: Name of the thin strip along the right edge of the window beside the right dock. It holds one button for each panel in the dock, showing its icon and title.
	'dock.rail.right': 'Right rail',
	// translator: Name of the thin strip along the bottom edge of the window beside the bottom dock. It holds one button for each panel in the dock, showing its icon and title.
	'dock.rail.bottom': 'Bottom rail',
	// translator: Name of a panel shown briefly over the level from a folded dock’s rail. {title} is the panel’s name.
	'dock.peek': '{title}, peeking',
	// translator: Verb phrase on an icon button. Turns a panel peeking over the level into a real dock again. {title} is the panel’s name.
	'dock.pin': 'Pin {title}',

	// translator: Label of the draggable edge between the level and the left dock. A person drags it, or presses the arrow keys on it, to make the dock wider or narrower.
	'dock.resize.left': 'Resize the left dock',
	// translator: Label of the draggable edge between the level and the right dock. A person drags it, or presses the arrow keys on it, to make the dock wider or narrower.
	'dock.resize.right': 'Resize the right dock',
	// translator: Label of the draggable edge between the level and the bottom dock. A person drags it, or presses the arrow keys on it, to make the dock taller or shorter.
	'dock.resize.bottom': 'Resize the bottom dock',
	// translator: The size of a dock shown while it is dragged. {size} is a number of pixels, so “264 px”.
	'dock.size': '{size} px',
	// translator: Announced to screen readers after a tab is moved with the keyboard. {title} is the panel’s name, {position} the tab’s new place counting from 1 and {total} how many tabs the dock group has.
	'dock.tab.moved': '{title} moved to position {position} of {total}.',
	// translator: Announced to screen readers after a panel is dragged into a dock. {title} is the panel’s name and {zone} the dock’s name, such as “Left dock”.
	'dock.drag.docked': '{title} moved to the {zone}.',
	// translator: Announced to screen readers after a docked panel is dragged out onto the level, where it floats. {title} is the panel’s name.
	'dock.drag.floated': '{title} is floating over the level.',
	// translator: Announced to screen readers when a drag of a panel is cancelled and the panel stays where it was. {title} is the panel’s name.
	'dock.drag.cancelled': 'Move cancelled. {title} stays where it was.',
	// translator: Name and tooltip of a button in a panel’s header. Makes the panel fill the editor’s whole workspace, with the level and the other panels hidden behind it. This is not the window’s own maximise button. {title} is the panel’s name.
	'panel.maximise': 'Maximise {title}',
	// translator: Tooltip of the button that maximises a panel. {title} is the panel’s name and {keys} the keys that do the same, such as “Ctrl+Shift+M”.
	'panel.maximise.tip': 'Maximise {title} ({keys})',
	// translator: Name and tooltip of a button in a maximised panel’s header. Puts the panel back where it was in the layout. {title} is the panel’s name.
	'panel.restore': 'Restore {title}',
	// translator: Tooltip of the button that restores a maximised panel. {title} is the panel’s name and {keys} the keys that do the same, such as “Ctrl+Shift+M”.
	'panel.restore.tip': 'Restore {title} ({keys})',
	// translator: Menu item and command in the View menu. Makes a panel fill the editor’s workspace. {panel} is the panel’s name.
	'view.maximise': 'Maximise {panel}',
	// translator: Menu item and command in the View menu, shown while a panel is maximised. Puts the panel back in the layout. {panel} is the panel’s name.
	'view.restore': 'Restore {panel}',
	// translator: Menu item in the View menu. Hides every docked and floating panel so the level has the whole window, and brings the same panels back when chosen again.
	'view.levelFirst': 'Show the level only',

	// translator: The name of the File menu in the application menu. Level files are opened, saved and closed from it, and Preferences and Quit are in it.
	'appMenu.file': 'File',
	// translator: The name of the Edit menu in the application menu. Undo and Redo are in it.
	'appMenu.edit': 'Edit',
	// translator: The name of the View menu in the application menu. It shows or hides the editor’s panels.
	'appMenu.view': 'View',
	// translator: The name of the Window menu in the application menu. Tearing a panel off into its own window, and docking it back, are in it.
	'appMenu.window': 'Window',
	// translator: The name of the Help menu in the application menu. About and the command palette are in it.
	'appMenu.help': 'Help',
	// translator: Verb on a File menu item. Closes the whole app.
	'appMenu.quit': 'Quit',
	// translator: Menu item that opens the Preferences window. The dots mean it opens a window.
	'appMenu.preferences': 'Preferences…',
	// translator: Menu item in the Help menu that opens the About window, which names the app and its version. “Fizz Level Studio” is the product name. The dots mean it opens a window.
	'appMenu.about': 'About Fizz Level Studio…',
	// translator: Menu item in the Help menu that opens the app’s help. The noun, not the verb.
	'appMenu.helpTopic': 'Help',
	// translator: Menu item in the Help menu that opens a window listing the keyboard shortcuts. The dots mean it opens a window.
	'appMenu.shortcuts': 'Keyboard shortcuts…',
	// translator: Menu item in the Edit menu that opens a submenu listing the steps Undo and Redo would take. “History” is the list of changes made to the level.
	'appMenu.history': 'Undo history',
	// translator: Disabled item in the Undo history submenu, shown while the level has no change to take back or do again.
	'appMenu.history.empty': 'Nothing in the history yet',
	// translator: Last item in the Undo history submenu. Opens the command palette, which lists every command. The dots mean it opens a dialog.
	'appMenu.history.more': 'More in the command palette…',
	// translator: Item in the Undo history submenu: a step that can be taken back. {label} is the step’s name, such as “Paint grass”; {author} says who made it, such as “You” or “Claude”.
	'appMenu.history.entryBy': '{label} ({author})',
	// translator: Item in the Undo history submenu: a step that was taken back and can be done again. {label} is the step’s name, such as “Paint grass”.
	'appMenu.history.undone': '{label} (undone)',
	// translator: Item in the Undo history submenu: a step that was taken back and can be done again. {label} is the step’s name, such as “Paint grass”; {author} says who made it, such as “You” or “Claude”.
	'appMenu.history.undoneBy': '{label} ({author}, undone)',
	// translator: Who made a change, in the Undo history submenu. The person using the studio. Shown in brackets after a step’s name.
	'appMenu.history.author.person': 'You',
	// translator: Who made a change, in the Undo history submenu. Claude is the AI assistant, a name that is not translated.
	'appMenu.history.author.claude': 'Claude',
	// translator: Who made a change, in the Undo history submenu: the level’s file was changed by another program.
	'appMenu.history.author.outside': 'Outside the studio',
	// translator: Who made a change, in the Undo history submenu: the unsaved changes were brought back after a crash.
	'appMenu.history.author.recovered': 'Recovered',
	// translator: Why Undo is disabled in the menus and the command palette: there is no change to take back.
	'history.nothingToUndo': 'Nothing to undo',
	// translator: Why Redo is disabled in the menus and the command palette: nothing has been taken back that could be done again.
	'history.nothingToRedo': 'Nothing to redo',
	// translator: Why Maximise is disabled on a menu item: the panel it would fill the workspace with is hidden.
	'view.maximiseNeedsPanel': 'Show the panel first',
	// translator: Why Show the level only is disabled on a menu item: a panel fills the workspace.
	'view.levelFirstMaximised': 'Restore the maximised panel first',
	// translator: Title of the window that lists the keyboard shortcuts.
	'shortcuts.title': 'Keyboard shortcuts',
	// translator: Short text under the title of the keyboard shortcuts window. Keys work when the window has focus, and not while typing in a box.
	'shortcuts.description':
		'Keys work while the studio has focus and pause while you type in a box.',
	// translator: Accessible name of the table in the keyboard shortcuts window: a key in one column, what it does in the other.
	'shortcuts.table': 'Keys and what they do',
	// translator: Column heading in the keyboard shortcuts window: the keys to press.
	'shortcuts.keys': 'Keys',
	// translator: Column heading in the keyboard shortcuts window: what the keys do.
	'shortcuts.action': 'Action',
	// translator: Row in the keyboard shortcuts window: the keys that choose a tool (a list of letters). The action names the six tools.
	'shortcuts.tools': 'Paint, Erase, Pick, Select, Stamp, Inspect',
	// translator: Row in the keyboard shortcuts window: take back a step, and do a taken-back step again.
	'shortcuts.undoRedo': 'Undo, redo',
	// translator: Row in the keyboard shortcuts window. Writes the level to its file.
	'shortcuts.save': 'Save',
	// translator: Row in the keyboard shortcuts window. Opens the New level window.
	'shortcuts.newLevel': 'New level',
	// translator: Row in the keyboard shortcuts window. Opens a file dialog to choose a level.
	'shortcuts.openLevel': 'Open level',
	// translator: Row in the keyboard shortcuts window. Closes the open level, not the window.
	'shortcuts.closeLevel': 'Close level',
	// translator: Row in the keyboard shortcuts window. Opens the Preferences window.
	'shortcuts.preferences': 'Preferences',
	// translator: Row in the keyboard shortcuts window. Closes the whole app.
	'shortcuts.quit': 'Quit',
	// translator: Row in the keyboard shortcuts window. Opens the command palette.
	'shortcuts.commandPalette': 'Command palette',
	// translator: Row in the keyboard shortcuts window. Hides every panel so the level has the whole window, and brings them back.
	'shortcuts.levelFirst': 'Show the level only',
	// translator: Row in the keyboard shortcuts window. Makes the focused panel fill the workspace, or puts it back.
	'shortcuts.maximise': 'Maximise or restore the focused panel',
	// translator: Row in the keyboard shortcuts window. Puts every panel back where it starts.
	'shortcuts.resetLayout': 'Reset layout',
	// translator: A row of the Keyboard shortcuts table. Makes the level canvas show larger cells.
	'shortcuts.zoomIn': 'Zoom in',
	// translator: A row of the Keyboard shortcuts table. Makes the level canvas show smaller cells.
	'shortcuts.zoomOut': 'Zoom out',
	// translator: A row of the Keyboard shortcuts table. Chooses the largest whole zoom that shows the whole level.
	'shortcuts.zoomFit': 'Fit level',
	// translator: Row in the keyboard shortcuts window. Opens the app’s help.
	'shortcuts.help': 'Help',
	// translator: Row in the keyboard shortcuts window. Shows or hides this window.
	'shortcuts.shortcuts': 'Show or hide this window',
	// translator: Accessible name of the row of menus under the title bar.
	'menuBar.label': 'Application menu',
	// translator: Accessible name of the button that holds the menus that do not fit in the menu bar.
	'menuBar.more': 'More menus',
	// translator: A line shown in a panel’s own window while the main window has no level open, so the panel has nothing to show.
	'panelWindow.noLevel': 'Open a level in the main window to use this panel.',

	// translator: Heading of the panel with the undo and redo buttons.
	'history.title': 'History',
	// translator: Verb. Takes back the last step.
	'history.undo': 'Undo',
	// translator: Verb. Does a taken-back step again.
	'history.redo': 'Redo',
	// translator: The undo button’s label when it names the step it would undo, such as “Undo Paint grass”.
	'history.undoNamed': 'Undo {name}',
	// translator: The redo button’s label when it names the step it would redo.
	'history.redoNamed': 'Redo {name}',

	// translator: A banner shown when the level’s file was changed by something other than the studio.
	'editor.editedOutside': 'This level was changed outside the studio.',
	// translator: A note above the grid of a Fizz 2 level. “The game” is Lieutenant Fizz 2; “flat view” is a plain drawing of the tiles.
	'level.flatFallback':
		'The game’s own drawing of this level is not available yet, so this is the flat view.',
	// translator: Shown when an edit was refused because the level had moved on.
	'editor.stale': 'The level changed first, so that edit was not applied. Try it again.',
	// translator: Shown when an edit could not be applied.
	'editor.failed': 'That edit could not be applied.',
	// translator: Accessible name of the editor’s main area, which holds the canvas, tools and panels.
	'editor.region': 'Level editor',

	// translator: Title bar text and taskbar title for a window showing a level. {name} is the level’s name, and nothing else is added.
	'window.main.titled': '{name}',
	// translator: Title bar text and taskbar title for a level with unsaved changes; the “•” after the name marks them. {name} is the level’s name.
	'window.main.titledDirty': '{name} •',
	// translator: The title of the New level window, shown in its title bar.
	'window.newWorld.title': 'New level',
	// translator: The title of the Preferences window, shown in its title bar.
	'window.preferences.title': 'Preferences',
	// translator: The title of the About window, shown in its title bar.
	'window.about.title': 'About Fizz Level Studio',

	// translator: Label of the text field for the new level’s name, the one the person sees.
	'newLevel.name': 'Name',
	// translator: Label of the field for the new level’s id, a short lowercase name used for its file or folder.
	'newLevel.id': 'Id',
	// translator: A hint under the id field: it becomes the file or folder name.
	'newLevel.idHint': 'Lowercase letters, digits, and hyphens. It names the file or folder.',
	// translator: Label of the field for the level’s width, in cells (tiles).
	'newLevel.width': 'Width',
	// translator: Label of the field for the level’s height, in cells (tiles).
	'newLevel.height': 'Height',
	// translator: Caption of the two choices for which game the new level is for.
	'newLevel.target': 'Target',
	// translator: A choice: a single level for the first game, Lieutenant Fizz 1.
	'newLevel.targetFizz1': 'Fizz 1 level',
	// translator: A choice: a world folder for the second game, Lieutenant Fizz 2.
	'newLevel.targetFizz2': 'Fizz 2 world',
	// translator: A one-line warning beside the target choice: it cannot be changed after the level is made.
	'newLevel.targetFixed': 'This cannot be changed after the level is created.',
	// translator: A note under the Fizz 1 choice: the game knows only its own sixteen levels until it has a level registry, so a new level's id is reported as a problem for now.
	'newLevel.fizz1Note':
		'The Fizz 1 game only knows its own 16 level ids until it has a level registry, so a new Fizz 1 level reports a problem with its id for now.',
	// translator: Label of the chooser for the look of a Fizz 1 level; “theme” is the game’s own word.
	'newLevel.theme': 'Theme',
	// translator: The choice meaning no theme is set for the level.
	'newLevel.themeNone': 'None',
	// translator: Label of the read-only field showing the folder the level will be made in.
	'newLevel.folder': 'Folder',
	// translator: Shown in the folder field before a folder is chosen.
	'newLevel.folderNone': 'No folder chosen',
	// translator: Verb phrase on a button. Opens a dialog to choose the folder.
	'newLevel.chooseFolder': 'Choose…',
	// translator: The title of the native dialog for choosing the folder.
	'newLevel.folderDialogTitle': 'Choose a folder for the new level',
	// translator: Verb. A button that makes the new level.
	'newLevel.create': 'Create',
	// translator: Verb. A button that closes the window without making a level.
	'newLevel.cancel': 'Cancel',
	// translator: Title of a question asked when the New level window is closed after the person typed in it.
	'newLevel.discardTitle': 'Discard this new level?',
	// translator: The question’s explanation: what happens to what the person entered.
	'newLevel.discardMessage': 'What you entered will be lost.',
	// translator: Verb. A button that closes the New level window and throws away what was entered.
	'newLevel.discard': 'Discard',
	// translator: Verb phrase on a button that goes back to the New level form instead of closing it.
	'newLevel.keepEditing': 'Keep editing',
	// translator: An error shown beside the name field when it is empty.
	'newLevel.error.nameEmpty': 'Enter a name.',
	// translator: An error shown beside the name field: it may not hold quotation marks or line breaks.
	'newLevel.error.nameChars': 'The name must be one line without quotation marks.',
	// translator: An error shown beside the id field.
	'newLevel.error.id': 'Use lowercase letters, digits, and single hyphens.',
	// translator: An error shown beside the width field.
	'newLevel.error.width': 'The width must be a whole number from 8 to 1024.',
	// translator: An error shown beside the height field.
	'newLevel.error.height': 'The height must be a whole number from 8 to 128.',
	// translator: An error shown beside the folder field when none is chosen.
	'newLevel.error.folder': 'Choose a folder.',
	// translator: An error line shown when the level could not be made. {message} says why, in English.
	'newLevel.createFailed': 'The level could not be created: {message}',
	// translator: Accessible name of the list of pages in the Preferences window.
	'preferences.navigation': 'Preferences pages',
	// translator: The name of a Preferences page about how the app behaves in general, such as its title bar. It is the page’s heading and its entry in the list of pages.
	'preferences.page.general': 'General',
	// translator: The title of a group of settings about the window’s title bar and the menus under it.
	'preferences.group.titleBar': 'Title bar',
	// translator: The name of a switch. When on, the application’s menus sit in a row under the title bar.
	'preferences.menuBar.label': 'Show the menu bar',
	// translator: Explains the Show the menu bar switch. “App menu” is the button at the left of the title bar that shows the app’s name.
	'preferences.menuBar.description':
		'Puts the menus in a bar below the title bar. The app menu in the title bar then becomes plain text.',
	// translator: Explains the reset action on the General page.
	'preferences.reset.descriptionGeneral': 'Puts the title bar choices back to their defaults.',
	// translator: The name of a Preferences page about how the app looks. It is the page’s heading and its entry in the list of pages.
	'preferences.page.appearance': 'Appearance',
	// translator: The title of a group of settings about colour.
	'preferences.group.colours': 'Colours',
	// translator: The title of a group of settings about visual effects such as blur.
	'preferences.group.effects': 'Effects',
	// translator: A choice meaning “use whatever the operating system is set to”. Shown on several settings.
	'preferences.follow': 'Follow the system',
	// translator: The name of the setting that picks the light or dark colour scheme.
	'preferences.mode.label': 'Colour mode',
	// translator: Explains the Colour mode setting.
	'preferences.mode.description': 'Light or dark windows, or the same as the system.',
	// translator: A choice for Colour mode: light windows.
	'preferences.mode.light': 'Light',
	// translator: A choice for Colour mode: dark windows.
	'preferences.mode.dark': 'Dark',
	// translator: The name of the setting that picks the highlight colour used for the active tool and other lit controls.
	'preferences.accent.label': 'Accent',
	// translator: Explains the Accent setting.
	'preferences.accent.description': 'The colour of the active tool and other lit controls.',
	// translator: A choice for Accent: the studio’s own cyan (a blue-green).
	'preferences.accent.studio': 'Studio cyan',
	// translator: A choice for Accent: a warm orange called Afterglow orange.
	'preferences.accent.orange': 'Afterglow orange',
	// translator: A choice for Accent: a soft purple called Afterglow purple.
	'preferences.accent.purple': 'Afterglow purple',
	// translator: A choice for Accent: the person picks any colour themselves.
	'preferences.accent.custom': 'Choose a colour',
	// translator: The name of a colour picker for the custom accent.
	'preferences.accentColour.label': 'Custom accent',
	// translator: Explains the colour picker for the custom accent.
	'preferences.accentColour.description': 'Pick the accent colour.',
	// translator: The name of a text field where a colour is typed as a hex code such as #00e5ff.
	'preferences.accentHex.label': 'Custom accent code',
	// translator: Explains the hex code field. The format shown is six lowercase hexadecimal digits after a number sign.
	'preferences.accentHex.description': 'A colour as # followed by six lowercase hex digits.',
	// translator: An error beside the hex code field when the text is not a colour in that format.
	'preferences.error.hex': 'Use # followed by six lowercase hex digits, such as #00e5ff.',
	// translator: An error beside a setting when the change could not be saved.
	'preferences.error.save': 'The change could not be saved.',
	// translator: An error shown when the settings could not be read at all.
	'preferences.unavailable': 'The settings could not be read.',
	// translator: The name of the setting that turns the frosted-glass look of panels on or off.
	'preferences.glass.label': 'Glass panels',
	// translator: Explains Glass panels. “Off” draws panels in a solid colour, which is easier on slower graphics.
	'preferences.glass.description':
		'Off draws solid panels, which is easier on slower graphics. Following the system turns glass off when the system asks for less transparency.',
	// translator: A choice for Glass panels: always frosted glass.
	'preferences.glass.on': 'On',
	// translator: A choice for Glass panels: solid panels.
	'preferences.glass.off': 'Off',
	// translator: Accessible name of the small live sample of the chosen accent and glass.
	'preferences.preview.label': 'Preview',
	// translator: The label on a sample lit key in the preview.
	'preferences.preview.key': 'Paint',
	// translator: Text on a sample glass panel in the preview, drawn in the accent colour.
	'preferences.preview.strip': 'Accent text on a panel',
	// translator: Says how readable the lit key’s label is. {ink} is the label colour as a hex code; {ratio} is the contrast ratio, such as 8.2.
	'preferences.preview.contrast': 'Key label {ink}, contrast {ratio} to 1.',
	// translator: Added after the contrast line when the key’s colour was made darker than the chosen accent so its label stays readable.
	'preferences.preview.darkened': 'The key was darkened to stay readable.',
	// translator: The name of the setting row that puts the Appearance page back to its starting choices.
	'preferences.reset.label': 'Reset this page',
	// translator: Explains the reset action on the Appearance page.
	'preferences.reset.description':
		'Puts colour mode, accent and glass back to following the system.',
	// translator: Verb phrase on a button. Puts the page’s settings back to their defaults.
	'preferences.reset.action': 'Reset to defaults',
	// translator: The name of a Preferences page about how see-through the panels, menus and windows are. It is the page’s heading and its entry in the list of pages.
	'preferences.page.transparency': 'Transparency',
	// translator: The title of a group of settings about the frosted glass on the panels and menus inside a window.
	'preferences.group.transparencyPanels': 'Panels and menus',
	// translator: The title of a group of settings about the window itself letting the desktop show through.
	'preferences.group.transparencyWindow': 'Window',
	// translator: A note at the top of the Transparency page when the Glass panels setting on the Appearance page is off, or the system asks for less transparency, so everything is drawn solid.
	'preferences.transparency.solidNote':
		'Glass is off for now (Glass panels on the Appearance page, or the system asking for less transparency), so every surface is drawn solid.',
	// translator: The unit after a blur value in pixels, with its leading space, such as “16 px”.
	'preferences.unit.pixels': ' px',
	// translator: The unit after a value in percent, such as “88%”.
	'preferences.unit.percent': '%',
	// translator: The name of a slider. How strongly a glass panel blurs what is behind it.
	'preferences.transparency.blur.label': 'Blur',
	// translator: Explains the Blur slider.
	'preferences.transparency.blur.description': 'How much the glass blurs what lies behind it.',
	// translator: The name of a slider. How vivid the colours seen through the glass are.
	'preferences.transparency.saturation.label': 'Saturation',
	// translator: Explains the Saturation slider.
	'preferences.transparency.saturation.description':
		'How vivid the colours behind the glass look. 100% leaves them as they are.',
	// translator: The name of a slider. How solid (not see-through) a glass panel’s fill is.
	'preferences.transparency.panelOpacity.label': 'Panel opacity',
	// translator: Explains the Panel opacity slider.
	'preferences.transparency.panelOpacity.description':
		'How solid a glass panel is. Lower lets more of the level show through.',
	// translator: The name of a switch that puts glass on the panels docked at the window’s edges.
	'preferences.transparency.docks.label': 'Docked panels',
	// translator: Explains the Docked panels switch. A “rail” is the strip of panel buttons at a window edge; “peeked” means shown for a moment from the rail.
	'preferences.transparency.docks.description':
		'The panels docked at the edges, their rails, and a panel peeked from a rail.',
	// translator: The name of a switch that puts glass on the panels floating over the level.
	'preferences.transparency.floating.label': 'Floating panels',
	// translator: Explains the Floating panels switch.
	'preferences.transparency.floating.description':
		'Floating panels, the tool picker, and the command palette.',
	// translator: The name of a switch that puts glass on the menus.
	'preferences.transparency.menus.label': 'Menus',
	// translator: Explains the Menus switch. “App menu” is the button at the left of the title bar.
	'preferences.transparency.menus.description':
		'The app menu, the menu bar’s menus, the Panels menu, and the menus that open on a right-click.',
	// translator: The name of a slider. How solid (not see-through) a glass menu is.
	'preferences.transparency.menuOpacity.label': 'Menu opacity',
	// translator: Explains the Menu opacity slider.
	'preferences.transparency.menuOpacity.description': 'How solid a glass menu is.',
	// translator: The name of a switch that puts glass on the dialogs (the boxes that ask a question over a window).
	'preferences.transparency.dialogs.label': 'Dialogs',
	// translator: Explains the Dialogs switch.
	'preferences.transparency.dialogs.description': 'The questions and messages shown over a window.',
	// translator: The name of a switch that puts glass on the title bar at the top of a window.
	'preferences.transparency.titleBar.label': 'Title bar',
	// translator: Explains the Title bar switch.
	'preferences.transparency.titleBar.description':
		'The title bar and the menu bar under it. They show the window behind them, or the desktop when the window lets it through.',
	// translator: The name of a switch. When on, the window’s own background lets the desktop behind it show through.
	'preferences.transparency.window.label': 'Transparent window',
	// translator: Explains the Transparent window switch. “The level” is the map being edited.
	'preferences.transparency.window.description':
		'Lets the desktop show through the window around the panels. The level itself stays solid, and text stays readable.',
	// translator: Shown in place of the Transparent window switch’s action when this computer cannot draw see-through windows.
	'preferences.transparency.window.unavailable': 'This system cannot draw see-through windows.',
	// translator: The name of a choice of how strongly the desktop behind a see-through window is blurred.
	'preferences.transparency.windowBlur.label': 'Desktop blur',
	// translator: Explains the Desktop blur choice. “Low” and “High” are the same on Linux.
	'preferences.transparency.windowBlur.description':
		'How strongly the desktop behind the window is blurred. Low and High are the same where the desktop has only one blur.',
	// translator: A choice for Desktop blur: no blur.
	'preferences.transparency.windowBlur.off': 'Off',
	// translator: A choice for Desktop blur: a light blur.
	'preferences.transparency.windowBlur.low': 'Low',
	// translator: A choice for Desktop blur: a strong blur.
	'preferences.transparency.windowBlur.high': 'High',
	// translator: A line shown instead of the Desktop blur choice when this desktop cannot blur behind windows.
	'preferences.transparency.windowBlur.unavailable':
		'This desktop cannot blur behind windows, so the desktop shows through as it is.',
	// translator: The name of a switch. When on, a window that is not the one in front is drawn solid.
	'preferences.transparency.solidUnfocused.label': 'Solid when unfocused',
	// translator: Explains the Solid when unfocused switch.
	'preferences.transparency.solidUnfocused.description':
		'Draws a window solid while another window is in front.',
	// translator: Explains the reset action on the Transparency page.
	'preferences.reset.descriptionTransparency':
		'Puts the blur, saturation, opacity, surfaces, and window back to their defaults.',
	// translator: An error beside a slider when its value was refused as outside the slider’s range.
	'preferences.error.range': 'That value is outside the range this setting allows.',
	// translator: Accessible name of the live sample of the transparency settings: panels and a menu over a busy picture.
	'preferences.transparency.preview.label': 'Transparency preview',
	// translator: Text in the preview’s sample title bar.
	'preferences.transparency.preview.title': 'Sample window',
	// translator: Heading of the sample docked panel in the preview.
	'preferences.transparency.preview.dock': 'Docked panel',
	// translator: Heading of the sample floating panel in the preview.
	'preferences.transparency.preview.floating': 'Floating panel',
	// translator: A line of sample text inside a panel in the preview.
	'preferences.transparency.preview.text': 'Text on the glass',
	// translator: A sample menu row in the preview.
	'preferences.transparency.preview.menuItem': 'Menu row',
	// translator: A second sample menu row in the preview.
	'preferences.transparency.preview.menuItemOther': 'Another row',
	// translator: A line shown in the About window until it is built.
	'placeholder.about': 'About is coming.',

	// translator: A short description of the app, shown on the start screen under its name.
	'main.tagline': 'A level editor for Lieutenant Fizz.',
	// translator: Verb phrase on a button. Opens the New level window.
	'main.newLevel': 'New level…',
	// translator: Verb phrase on a button. Opens a file dialog to choose a level file.
	'main.openLevel': 'Open level…',
	// translator: The title of the native file dialog for choosing a level file.
	'main.openDialogTitle': 'Open a level',
	// translator: The name of the .fizz file type in the file dialog’s filter.
	'main.fileFilter': 'Fizz level',
	// translator: Heading of the list of levels opened recently.
	'main.recent': 'Recent levels',
	// translator: Shown when the list of recent levels is empty.
	'main.recentNone': 'No recent levels yet.',
	// translator: Verb phrase on a button. Empties the list of recent levels.
	'main.clearRecent': 'Clear recent',
	// translator: Shown beside a recent level whose file could not be opened, for example because it moved.
	'main.recentMissing': 'This file could not be opened. It may have moved or been deleted.',
	// translator: An error banner. {path} is the file that could not be opened.
	'main.openFailed': 'Could not open {path}.',
	// translator: An error banner shown when saving the level failed.
	'main.saveFailed': 'The level could not be saved.',
	// translator: An error banner shown when closing the level failed.
	'main.closeFailed': 'The level could not be closed.',
	// translator: Verb. A button that hides a message.
	'main.dismiss': 'Dismiss',
	// translator: Accessible name of the group of buttons that act on the open level.
	'main.levelActions': 'Level actions',
	// translator: Verb. A button that writes the level to its file.
	'main.save': 'Save',
	// translator: Verb phrase on a button. Closes the open level and returns to the start screen.
	'main.closeLevel': 'Close level',
	// translator: Title of a question asked when closing a level with unsaved changes. {name} is the level’s name.
	'main.closeConfirmTitle': 'Save changes to {name}?',
	// translator: The question’s explanation: what happens to unsaved changes.
	'main.closeConfirmMessage': 'If you do not save, your changes to this level are lost.',
	// translator: Verb. A button that throws away unsaved changes.
	'main.discard': 'Discard',
	// translator: Verb. A button that abandons what the person was about to do.
	'main.cancel': 'Cancel',
	// translator: A banner explaining that the level’s file changed outside the studio on the same lines as unsaved changes.
	'main.conflict':
		'The file changed outside the studio on lines you also changed. The text below marks where.',
	// translator: Heading of the start-screen section that offers levels whose unsaved changes survived a crash.
	'main.recovered': 'Recovered changes',
	// translator: Explains the recovered-changes section.
	'main.recoveredHint': 'These levels had unsaved changes when the studio last closed.',
	// translator: When a recovery copy was kept. {time} is a date and time, already formatted.
	'main.recoveredKept': 'Kept {time}',
	// translator: Verb. Button that opens a level with its recovered unsaved changes. {name} is the level’s file name.
	'main.restoreNamed': 'Restore {name}',
	// translator: Verb. Button that opens a level with its recovered unsaved changes.
	'main.restore': 'Restore',
	// translator: Verb. Button that throws away one recovery copy. {name} is the level’s file name.
	'main.discardNamed': 'Discard {name}',
	// translator: Verb. Button that throws away every recovery copy.
	'main.discardAll': 'Discard all',
	// translator: A notice shown after a level is opened from a recovery copy.
	'main.recoveredNotice': 'Recovered unsaved changes from your last session.',
	// translator: Error banner. {path} is a file path.
	'main.restoreFailed': 'Could not restore {path}.',
	// translator: Error banner. {path} is a file path.
	'main.discardFailed': 'Could not discard the recovery copy of {path}.',
	// translator: Accessible name of the box holding the text with conflict markers.
	'main.conflictText': 'Text with conflict markers',
} as const;

export type MessageId = keyof typeof enMessages;

/** Message identifiers that have plural forms, named by their shared prefix (`items.count`). */
export type PluralId = MessageId extends infer K
	? K extends `${infer Base}.other`
		? Base
		: never
	: never;

function interpolate(message: string, values: Record<string, string | number> | undefined): string {
	if (!values) return message;
	return message.replace(/\{(\w+)\}/g, (token, name: string) =>
		name in values ? String(values[name]) : token,
	);
}

/** The message for `id` in the active catalogue, or English when that catalogue lacks it. */
export function t(id: MessageId, values?: Record<string, string | number>): string {
	return interpolate(activeMessages()[id] ?? enMessages[id], values);
}

/**
 * The message for `count` of something, choosing the plural form the locale's rules give
 * (`Intl.PluralRules`). A form neither the catalogue nor English spells out uses `.other`.
 * `{count}` is replaced with the number formatted for that locale.
 */
export function tn(id: PluralId, count: number, locale?: string): string {
	const form = new Intl.PluralRules(locale ?? pluralLocale()).select(count);
	const exact = `${id}.${form}`;
	const own = activeMessages() as Record<string, string | undefined>;
	const english = enMessages as Record<string, string>;
	const key = exact in english || exact in own ? exact : `${id}.other`;
	const message = own[key] ?? english[key] ?? key;
	const formatted = new Intl.NumberFormat(locale ?? formatLocale()).format(count);
	return interpolate(message, { count: formatted });
}
