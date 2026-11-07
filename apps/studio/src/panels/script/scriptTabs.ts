// The Script panel's tabs: which scripts are open, and how the keys move between them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Today the panel holds one script, the level's. Behaviour scripts arrive with Fizz 2, so the model
// is already a list keyed by a script id, and a torn-off script's window is keyed the same way.

/** The id of the level's own script tab. */
export const LEVEL_TAB = 'level';

export interface ScriptTab {
	/** `level` for the level script, else a behaviour script's id. */
	id: 'level' | (string & {});
	/** The script's file name, as the tab and its tooltip show it. */
	title: string;
	kind: 'level' | 'behaviour';
	/** The script has changes that are not saved. */
	dirty: boolean;
	/** The script is in a window of its own: the tab stays here, marked, and brings that window forward. */
	away: boolean;
}

/** The last part of a path, whichever separator it uses. */
export function fileNameOf(path: string): string {
	return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** The tabs of the open level: just the level script for now. */
export function scriptTabsFor(level: { path: string; dirty: boolean; away: boolean }): ScriptTab[] {
	return [
		{
			id: LEVEL_TAB,
			title: fileNameOf(level.path),
			kind: 'level',
			dirty: level.dirty,
			away: level.away,
		},
	];
}

/**
 * The tab a navigation key lands on, from the tab that has the focus: Left and Right step (and wrap),
 * Home and End go to the first and last. Null for any other key.
 */
export function tabAfterKey(tabs: readonly ScriptTab[], from: string, key: string): string | null {
	if (tabs.length === 0) return null;
	const at = Math.max(
		0,
		tabs.findIndex((tab) => tab.id === from),
	);
	switch (key) {
		case 'ArrowRight':
			return tabs[(at + 1) % tabs.length]!.id;
		case 'ArrowLeft':
			return tabs[(at - 1 + tabs.length) % tabs.length]!.id;
		case 'Home':
			return tabs[0]!.id;
		case 'End':
			return tabs[tabs.length - 1]!.id;
		default:
			return null;
	}
}
