// The recent levels list: the settings document's `recent_worlds`, through the settings plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	clearRecent,
	getSettings,
	onSettingsChanged,
	touchRecent,
} from '@liminal-hq/fizz-studio-plugin-settings';

/** The recent paths, most recent first. Every answer is the whole list as it now stands. */
export interface RecentClient {
	list(): Promise<string[]>;
	touch(path: string): Promise<string[]>;
	clear(): Promise<string[]>;
	onChanged(listener: (paths: string[]) => void): () => void;
}

/** The real client. */
export const recentClient: RecentClient = {
	list: async () => (await getSettings()).settings.recent_worlds,
	touch: async (path) => (await touchRecent(path)).settings.recent_worlds,
	clear: async () => (await clearRecent()).settings.recent_worlds,
	onChanged(listener) {
		let stop: (() => void) | null = null;
		let cancelled = false;
		void onSettingsChanged((snapshot) => listener(snapshot.settings.recent_worlds)).then(
			(unlisten) => {
				if (cancelled) unlisten();
				else stop = unlisten;
			},
		);
		return () => {
			cancelled = true;
			stop?.();
		};
	},
};
