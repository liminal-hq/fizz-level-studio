// The dock layout: the settings document's `dock`, read and saved through the settings client
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import { settingsClient, type SettingsClient } from './settingsClient';

/** The saved workspaces and the active one. Rust owns them and checks every value. */
export interface DockClient {
	/** What is in force. */
	get(): Promise<DockSettings>;
	/** Saves the dock as a whole. */
	save(dock: DockSettings): Promise<void>;
}

/**
 * A dock client over the settings document. A save is based on the revision last seen; when another
 * window changed the settings in between, the revision is read again and the save tried once more.
 */
export function createDockClient(settings: SettingsClient = settingsClient): DockClient {
	let revision: number | null = null;
	return {
		async get() {
			const snapshot = await settings.get();
			revision = snapshot.revision;
			return snapshot.settings.dock;
		},
		async save(dock) {
			const send = async () => {
				if (revision === null) revision = (await settings.get()).revision;
				const snapshot = await settings.update({ dock }, revision);
				revision = snapshot.revision;
			};
			try {
				await send();
			} catch {
				revision = null;
				await send();
			}
		},
	};
}

/** The real client. */
export const dockClient: DockClient = createDockClient();
