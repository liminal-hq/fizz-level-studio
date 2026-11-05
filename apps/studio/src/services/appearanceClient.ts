// The colour scheme's two sources: the settings document's colour mode and the system's preference
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getSettings, onSettingsChanged } from '@liminal-hq/fizz-studio-plugin-settings';
import {
	getAppearance,
	getStatus,
	onAppearanceChanged,
	type AppearancePreferences,
	type PluginStatus,
} from '@liminal-hq/plugin-system-appearance';
import type { AccentSources } from '../theme/followAccent';
import type { SchemeSources } from '../theme/followColourScheme';

/** Keeps the plugin's unsubscribe function once its promise settles, even if stopped before then. */
function subscribe(start: () => Promise<() => void>): () => void {
	let stop: (() => void) | null = null;
	let cancelled = false;
	void start()
		.then((unlisten) => {
			if (cancelled) unlisten();
			else stop = unlisten;
		})
		.catch(() => {});
	return () => {
		cancelled = true;
		stop?.();
	};
}

/** The real sources: the settings plugin and the system-appearance plugin. */
export const schemeSources: SchemeSources = {
	mode: async () => (await getSettings()).settings.colour_mode,
	onModeChanged: (listener) =>
		subscribe(() => onSettingsChanged((snapshot) => listener(snapshot.settings.colour_mode))),
	system: async () => (await getAppearance()).colourScheme,
	onSystemChanged: (listener) => {
		// Keep only changes newer than the last one heard: the revision only goes up.
		let latest = 0;
		return subscribe(() =>
			onAppearanceChanged((preferences) => {
				if (preferences.revision <= latest) return;
				latest = preferences.revision;
				listener(preferences.colourScheme);
			}),
		);
	},
};

/** The accent and the transparency and contrast hints, from the same plugin. */
export const accentSources: AccentSources = {
	accentAvailable: async () =>
		(await getStatus()).appearance.some((entry) => entry.feature === 'accent' && entry.available),
	hints: async () => toHints(await getAppearance()),
	onHintsChanged: (listener) => {
		// Keep only changes newer than the last one heard: the revision only goes up.
		let latest = 0;
		return subscribe(() =>
			onAppearanceChanged((preferences) => {
				if (preferences.revision <= latest) return;
				latest = preferences.revision;
				listener(toHints(preferences));
			}),
		);
	},
};

function toHints(preferences: AppearancePreferences) {
	return {
		accent: preferences.accent,
		reducedTransparency: preferences.reducedTransparency,
		contrast: preferences.contrast,
	};
}

/** What the system-appearance plugin can read on this desktop; its status command answering. */
export function appearanceStatus(): Promise<PluginStatus> {
	return getStatus();
}

export type { AppearancePreferences, PluginStatus };
