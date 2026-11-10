// The Preferences settings editor (General, Appearance and Transparency): reads the settings, saves each change at once and keeps per-field errors
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Settings } from '@liminal-hq/fizz-studio-protocol/generated/Settings';
import type { SettingsPatch } from '@liminal-hq/fizz-studio-protocol/generated/SettingsPatch';
import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t, type MessageId } from '../i18n/messages';
import type { SettingsClient } from '../services/settingsClient';
import { TRANSPARENCY_DEFAULTS } from '../theme/transparency';

/** The controls that can show an error. */
export type PreferencesField =
	| 'colourMode'
	| 'accent'
	| 'accentHex'
	| 'glass'
	| 'menuBar'
	| 'toolbar'
	| 'blur'
	| 'saturation'
	| 'panelOpacity'
	| 'docks'
	| 'floating'
	| 'menus'
	| 'menuOpacity'
	| 'dialogs'
	| 'titleBar'
	| 'windowEnabled'
	| 'windowBlur'
	| 'solidUnfocused'
	| 'resetTransparency';

export type PreferencesErrors = Partial<Record<PreferencesField, string>>;

/** The settings the pages edit. */
export type PreferencesValues = Pick<
	Settings,
	'colour_mode' | 'accent' | 'glass' | 'ui' | 'transparency'
>;

/** The pages that have a reset to defaults. */
export type PreferencesPage = 'appearance' | 'general' | 'transparency';

/** A patch, or a patch made from the settings it is based on (so a retry after a stale revision rebuilds it from the fresh ones). */
export type PreferencesPatch = SettingsPatch | ((settings: Settings) => SettingsPatch);

export interface PreferencesEditor {
	/** The values in force, or null until the first read comes back. */
	values: PreferencesValues | null;
	errors: PreferencesErrors;
	/** True when the settings could not be read at all. */
	unavailable: boolean;
	/** Saves `patch` now. A refusal is shown against `field` and nothing changes. */
	change(field: PreferencesField, patch: PreferencesPatch): Promise<void>;
	/** Puts a page's settings back to their defaults. */
	reset(page: PreferencesPage): Promise<void>;
}

/** The defaults of the settings the pages edit; the same as `Settings::default()` in Rust. */
export const PREFERENCE_DEFAULTS: PreferencesValues = {
	colour_mode: 'system',
	accent: { kind: 'system' },
	glass: 'system',
	ui: { menu_bar: false, toolbar: 'classic', ribbon_folded: false },
	transparency: TRANSPARENCY_DEFAULTS,
};

/** The control and the message for a refusal that names its field. */
const FIELD_OF_REFUSAL: Record<string, [PreferencesField, MessageId]> = {
	'accent-hex': ['accentHex', 'preferences.error.hex'],
	'transparency-blur': ['blur', 'preferences.error.range'],
	'transparency-saturation': ['saturation', 'preferences.error.range'],
	'transparency-panel-opacity': ['panelOpacity', 'preferences.error.range'],
	'transparency-menu-opacity': ['menuOpacity', 'preferences.error.range'],
};

function kindOf(error: unknown): string | null {
	return typeof error === 'object' && error !== null && 'kind' in error
		? String((error as { kind: unknown }).kind)
		: null;
}

function refusalMessage(error: unknown, fallback: PreferencesField): [PreferencesField, string] {
	if (kindOf(error) === 'invalid-field') {
		const field = (error as { field?: string }).field;
		const mapped = field ? FIELD_OF_REFUSAL[field] : undefined;
		if (mapped) return [mapped[0], t(mapped[1])];
	}
	return [fallback, t('preferences.error.save')];
}

/**
 * Loads the settings and saves every change as it is made, against the revision it last saw. A stale
 * revision is read again and the change tried once more. The settings plugin's change event keeps
 * the values current when another window changes them.
 */
export function usePreferencesSettings(client: SettingsClient): PreferencesEditor {
	const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
	const [errors, setErrors] = useState<PreferencesErrors>({});
	const [unavailable, setUnavailable] = useState(false);
	const latest = useRef<SettingsSnapshot | null>(null);

	const adopt = useCallback((next: SettingsSnapshot) => {
		if (latest.current && next.revision < latest.current.revision) return;
		latest.current = next;
		setSnapshot(next);
	}, []);

	useEffect(() => {
		let stop: (() => void) | null = null;
		let gone = false;
		client
			.get()
			.then((first) => {
				if (gone) return;
				adopt(first);
				stop = client.onChanged(adopt, first.revision);
			})
			.catch(() => {
				if (!gone) setUnavailable(true);
			});
		return () => {
			gone = true;
			stop?.();
		};
	}, [client, adopt]);

	const change = useCallback(
		async (field: PreferencesField, patch: PreferencesPatch) => {
			setErrors((current) => ({ ...current, [field]: undefined }));
			const build = (settings: Settings): SettingsPatch =>
				typeof patch === 'function' ? patch(settings) : patch;
			try {
				const based = latest.current ?? (await client.get());
				try {
					adopt(await client.update(build(based.settings), based.revision));
				} catch (error) {
					if (kindOf(error) !== 'stale') throw error;
					const fresh = await client.get();
					adopt(fresh);
					adopt(await client.update(build(fresh.settings), fresh.revision));
				}
			} catch (error) {
				const [where, message] = refusalMessage(error, field);
				setErrors((current) => ({ ...current, [where]: message }));
			}
		},
		[client, adopt],
	);

	const reset = useCallback(
		async (page: PreferencesPage) => {
			setErrors({});
			if (page === 'general') {
				await change('menuBar', { ui: PREFERENCE_DEFAULTS.ui });
				return;
			}
			if (page === 'transparency') {
				await change('resetTransparency', { transparency: PREFERENCE_DEFAULTS.transparency });
				return;
			}
			await change('colourMode', {
				colour_mode: PREFERENCE_DEFAULTS.colour_mode,
				accent: PREFERENCE_DEFAULTS.accent,
				glass: PREFERENCE_DEFAULTS.glass,
			});
		},
		[change],
	);

	const values = snapshot
		? {
				colour_mode: snapshot.settings.colour_mode,
				accent: snapshot.settings.accent,
				glass: snapshot.settings.glass,
				ui: snapshot.settings.ui,
				transparency: snapshot.settings.transparency,
			}
		: null;
	return { values, errors, unavailable, change, reset };
}
