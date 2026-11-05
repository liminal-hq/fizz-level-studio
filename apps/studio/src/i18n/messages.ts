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

	// translator: The title of the main editor window, shown in its title bar.
	'window.main.title': 'Fizz Level Studio',

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
	// translator: Verb. A tool that lays the chosen tile down where the pointer drags.
	'tools.paint': 'Paint',
	// translator: Verb. A tool that clears the cells the pointer drags over.
	'tools.erase': 'Erase',
	// translator: Verb. A tool that copies the tile under the pointer into the tile chooser.
	'tools.pick': 'Pick',
	// translator: Verb. A tool that outlines a rectangle of cells.
	'tools.select': 'Select',
	// translator: Verb. A tool that places the chosen item on a cell, like a rubber stamp.
	'tools.stamp': 'Stamp',
	// translator: Label of the chooser for the tile the Paint tool lays down.
	'tools.tile': 'Tile',
	// translator: Label of the chooser for the item the Stamp tool places (a collectable, such as a key).
	'tools.item': 'Item',

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
	// translator: Heading of the Palette’s list of tile words (the kinds of ground and wall).
	'palette.tiles': 'Tiles',
	// translator: Heading of the Palette’s list of item words (collectables, such as a key).
	'palette.items': 'Items',
	// translator: Heading of the Palette’s list of enemy words.
	'palette.enemies': 'Enemies',
	// translator: Shown under the enemies; enemies are listed for reference and cannot be placed with a tool yet.
	'palette.enemiesNote': 'Listed for reference. Enemies are placed in the script for now.',
	// translator: Shown in place of the Palette’s item and enemy lists while the words are loading or unavailable.
	'palette.unavailable': 'The word list is not available.',

	// translator: Label of the text field in which a line of script is typed, with word completion.
	'compose.label': 'Script line',
	// translator: Hint for the script line field. “Tab” and “Enter” are key names.
	'compose.hint': 'Type a word, then press Tab or Enter to complete it.',
	// translator: Accessible name of the list of suggested words under the script line field.
	'compose.suggestions': 'Word suggestions',
	// translator: Spoken when suggestions appear. {count} is how many.
	'compose.count.one': '{count} suggestion',
	// translator: Spoken when suggestions appear. {count} is how many.
	'compose.count.other': '{count} suggestions',
	// translator: What kind of word a suggestion is. A statement is a line of the script, such as “paint”.
	'compose.kind.statement': 'statement',
	// translator: What kind of word a suggestion is. A section is a heading in the script, such as “edits”.
	'compose.kind.section': 'section',
	// translator: What kind of word a suggestion is. A segment is a kind of terrain.
	'compose.kind.segment': 'terrain',
	// translator: What kind of word a suggestion is. A tile is a kind of ground or wall.
	'compose.kind.tile': 'tile',
	// translator: What kind of word a suggestion is. An item is a collectable.
	'compose.kind.item': 'item',
	// translator: What kind of word a suggestion is.
	'compose.kind.enemy': 'enemy',

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

	// translator: Verb phrase on a button. Moves the Script panel out of the main window into a window of its own.
	'panel.tearOff': 'Tear off',
	// translator: Verb phrase on a button. Closes a panel’s own window and puts the panel back in the main window.
	'panel.dockBack': 'Dock back',
	// translator: Shown in the main window in place of the Script panel while the panel is in its own window.
	'panel.scriptTornOff': 'The Script panel is open in its own window.',
	// translator: The title of the Script panel’s own window.
	'window.panelScript.title': 'Script',
	// translator: A line shown in the Script panel’s own window until it is built.
	'placeholder.panelScript': 'The script will appear here.',

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

	// translator: Title bar text for a window showing a level. {name} is the level’s name.
	'window.main.titled': '{name} — Fizz Level Studio',
	// translator: Title bar text for a level with unsaved changes; the “•” marks them. {name} is the level’s name.
	'window.main.titledDirty': '• {name} — Fizz Level Studio',
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
	// translator: A line shown in the Preferences window until it is built.
	'placeholder.preferences': 'Preferences are coming.',
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
