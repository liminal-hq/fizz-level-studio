// The clipboard's text, read for the text-field menu's Paste
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * What the text-field menu needs from the clipboard. Only reading is here: Copy and Cut write it
 * through the webview's own `copy` and `cut` commands, which a menu choice is allowed to run.
 */
export interface ClipboardClient {
	/** The text on the clipboard, or null when there is none or it cannot be read. */
	readText(): Promise<string | null>;
}

/**
 * The clipboard manager plugin, with the webview's own clipboard as the fallback for a page served
 * on its own (a test run, the webview in a browser). A webview refuses a script's `paste` command,
 * so Paste reads the text here and the menu inserts it itself.
 */
export const clipboardClient: ClipboardClient = {
	async readText() {
		try {
			return (await readText()) || null;
		} catch {
			try {
				return (await navigator.clipboard.readText()) || null;
			} catch {
				return null;
			}
		}
	},
};
