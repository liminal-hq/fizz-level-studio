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
	// translator: Shown when an edit was refused because the level had moved on.
	'editor.stale': 'The level changed first, so that edit was not applied. Try it again.',
	// translator: Shown when an edit could not be applied.
	'editor.failed': 'That edit could not be applied.',
	// translator: Accessible name of the editor’s main area, which holds the canvas, tools and panels.
	'editor.region': 'Level editor',
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
