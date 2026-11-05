// Whether this window shows the menu bar: the settings document's choice, followed live
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import type { SettingsClient } from '../services/settingsClient';

/**
 * The `ui.menu_bar` setting. It is off until the settings are read (and stays off if they cannot
 * be), and follows every later change, so turning it on in Preferences shows the bar in every Main
 * window at once.
 */
export function useMenuBar(client: Pick<SettingsClient, 'get' | 'onChanged'>): boolean {
	const [menuBar, setMenuBar] = useState(false);
	useEffect(() => {
		let gone = false;
		let stop: (() => void) | null = null;
		client
			.get()
			.then((first) => {
				if (gone) return;
				setMenuBar(first.settings.ui.menu_bar);
				stop = client.onChanged((next) => setMenuBar(next.settings.ui.menu_bar), first.revision);
			})
			.catch(() => {});
		return () => {
			gone = true;
			stop?.();
		};
	}, [client]);
	return menuBar;
}
