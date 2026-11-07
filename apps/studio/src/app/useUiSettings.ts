// The window chrome settings (`ui.*`): read from the settings document, followed live and changed from the chrome
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { UiSettings } from '@liminal-hq/fizz-studio-protocol/generated/UiSettings';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsClient } from '../services/settingsClient';

/** What the chrome reads and may change of the settings; a window with no `update` can only read. */
export type UiSettingsClient = Pick<SettingsClient, 'get' | 'onChanged'> &
	Partial<Pick<SettingsClient, 'update'>>;

export const DEFAULT_UI: UiSettings = { menu_bar: false, toolbar: 'classic', ribbon_folded: false };

export interface UiSettingsHandle {
	ui: UiSettings;
	/** Changes some of the `ui` settings; absent when the client cannot write. A refused change leaves them as they are. */
	setUi?: (patch: Partial<UiSettings>) => void;
}

/**
 * The `ui` settings. They are the defaults until the settings are read (and stay so if they cannot
 * be), and follow every later change, so turning one on in Preferences shows it in every Main
 * window at once. `setUi` saves against the revision last seen and tries once more when it is stale.
 */
export function useUiSettings(client: UiSettingsClient): UiSettingsHandle {
	const [ui, setUiState] = useState<UiSettings>(DEFAULT_UI);
	const revision = useRef<number | null>(null);
	useEffect(() => {
		let gone = false;
		let stop: (() => void) | null = null;
		client
			.get()
			.then((first) => {
				if (gone) return;
				revision.current = first.revision;
				setUiState(first.settings.ui);
				stop = client.onChanged((next) => {
					revision.current = next.revision;
					setUiState(next.settings.ui);
				}, first.revision);
			})
			.catch(() => {});
		return () => {
			gone = true;
			stop?.();
		};
	}, [client]);

	const canWrite = client.update !== undefined;
	const latest = useRef(ui);
	latest.current = ui;
	const setUi = useCallback(
		(patch: Partial<UiSettings>) => {
			if (!canWrite) return;
			const save = async (basedOn: number, again: boolean): Promise<void> => {
				try {
					const saved = await client.update!({ ui: { ...latest.current, ...patch } }, basedOn);
					revision.current = saved.revision;
					setUiState(saved.settings.ui);
				} catch {
					if (!again) return;
					const fresh = await client.get();
					revision.current = fresh.revision;
					setUiState(fresh.settings.ui);
					await save(fresh.revision, false);
				}
			};
			if (revision.current !== null) void save(revision.current, true).catch(() => {});
		},
		[canWrite, client],
	);
	return { ui, setUi: canWrite ? setUi : undefined };
}
