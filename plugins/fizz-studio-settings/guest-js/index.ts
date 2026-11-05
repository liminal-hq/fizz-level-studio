// Typed guest-side functions for the fizz-studio-settings plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AccentChoice } from '@liminal-hq/fizz-studio-protocol/generated/AccentChoice';
import type { ColourMode } from '@liminal-hq/fizz-studio-protocol/generated/ColourMode';
import type { GlassMode } from '@liminal-hq/fizz-studio-protocol/generated/GlassMode';
import type { PanelLayout } from '@liminal-hq/fizz-studio-protocol/generated/PanelLayout';
import type { PanelPlacement } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlacement';
import type { Settings } from '@liminal-hq/fizz-studio-protocol/generated/Settings';
import type { SettingsError } from '@liminal-hq/fizz-studio-protocol/generated/SettingsError';
import type { SettingsField } from '@liminal-hq/fizz-studio-protocol/generated/SettingsField';
import type { SettingsPatch } from '@liminal-hq/fizz-studio-protocol/generated/SettingsPatch';
import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';

const PREFIX = 'plugin:fizz-studio-settings|';

/** Sent to every window after every change; the payload is a `SettingsSnapshot`. */
export const SETTINGS_EVENT = 'settings://changed';

function cmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
	return invoke<T>(`${PREFIX}${name}`, args);
}

/** The settings in force and the revision they are at. */
export function getSettings(): Promise<SettingsSnapshot> {
	return cmd<SettingsSnapshot>('settings_get');
}

/**
 * Changes the fields named in `patch`, provided `basedOn` is the revision of the snapshot the
 * caller last saw. Rust merges the patch into what is in force, but refuses a stale revision:
 * the promise rejects with a `SettingsError` of kind `stale` carrying both revisions, and nothing
 * changes. Read `getSettings()` again and retry.
 */
export function updateSettings(patch: SettingsPatch, basedOn: number): Promise<SettingsSnapshot> {
	return cmd<SettingsSnapshot>('settings_update', { patch, basedOn });
}

/** Puts a world's path at the front of the recent list (no duplicates, at most 12). */
export function touchRecent(path: string): Promise<SettingsSnapshot> {
	return cmd<SettingsSnapshot>('recent_touch', { path });
}

/** Empties the recent list. */
export function clearRecent(): Promise<SettingsSnapshot> {
	return cmd<SettingsSnapshot>('recent_clear');
}

/**
 * The floating-panel layout for a kind of window (`main` for the editor): what was saved, laid over
 * the defaults Rust owns, so a panel added since the layout was saved still has a place.
 */
export function getPanelLayout(kind: string): Promise<PanelLayout> {
	return cmd<PanelLayout>('layout_get', { kind });
}

/** Saves the layout of a kind of window. The newest save wins. Resolves with what is now in force. */
export function savePanelLayout(kind: string, layout: PanelLayout): Promise<PanelLayout> {
	return cmd<PanelLayout>('layout_set', { kind, layout });
}

/** Forgets the saved layout of a kind of window and resolves with the defaults. */
export function resetPanelLayout(kind: string): Promise<PanelLayout> {
	return cmd<PanelLayout>('layout_reset', { kind });
}

/**
 * Wraps `listener` so it hears only snapshots newer than everything it has already heard. Events
 * can arrive out of order or twice (a window's own change comes back as an event), and a lower or
 * equal revision is older news than what the window has applied: it is ignored. `since` is the
 * revision already applied, normally that of the `getSettings()` answer the window started from;
 * use -1 to hear everything.
 */
export function newerOnly(
	since: number,
	listener: (snapshot: SettingsSnapshot) => void,
): (snapshot: SettingsSnapshot) => void {
	let latest = since;
	return (snapshot) => {
		if (snapshot.revision <= latest) {
			return;
		}
		latest = snapshot.revision;
		listener(snapshot);
	};
}

/**
 * Hears every change from Rust, applying the revision rule of `newerOnly`. Read `getSettings()`
 * first and pass its revision as `since`, so an event that raced the read is not applied twice.
 */
export function onSettingsChanged(
	listener: (snapshot: SettingsSnapshot) => void,
	since = -1,
): Promise<UnlistenFn> {
	const hear = newerOnly(since, listener);
	return listen<SettingsSnapshot>(SETTINGS_EVENT, (event) => hear(event.payload));
}

export type {
	AccentChoice,
	ColourMode,
	GlassMode,
	PanelLayout,
	PanelPlacement,
	Settings,
	SettingsError,
	SettingsField,
	SettingsPatch,
	SettingsSnapshot,
};
