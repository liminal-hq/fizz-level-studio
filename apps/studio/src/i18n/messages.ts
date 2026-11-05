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
