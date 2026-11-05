// The settings document as a whole: read it, patch it and hear it change, through the settings plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	getSettings,
	onSettingsChanged,
	updateSettings,
	type SettingsPatch,
	type SettingsSnapshot,
} from '@liminal-hq/fizz-studio-plugin-settings';

/** What the Preferences window needs of the settings. Rust owns them and checks every value. */
export interface SettingsClient {
	get(): Promise<SettingsSnapshot>;
	/** Applies `patch` if `basedOn` is still the revision in force; a refusal rejects with a `SettingsError`. */
	update(patch: SettingsPatch, basedOn: number): Promise<SettingsSnapshot>;
	/** Hears every change newer than revision `since`; returns the function that stops. */
	onChanged(listener: (snapshot: SettingsSnapshot) => void, since: number): () => void;
}

/** The real client. */
export const settingsClient: SettingsClient = {
	get: getSettings,
	update: updateSettings,
	onChanged(listener, since) {
		let stop: (() => void) | null = null;
		let cancelled = false;
		void onSettingsChanged(listener, since)
			.then((unlisten) => {
				if (cancelled) unlisten();
				else stop = unlisten;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			stop?.();
		};
	},
};
