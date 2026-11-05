// Dock layouts and a dock client for the editor's tests
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import { vi } from 'vitest';
import { floatPanel } from '../panels/dock/dockLayout';
import { PANEL_IDS, defaultDock, defaultWorkspace } from '../panels/dock/dockModel';
import type { DockClient } from '../services/dockClient';

/** The default dock with every panel floating where the default puts it. */
export function floatingDock(): DockSettings {
	const dock = defaultDock();
	let ws = dock.workspaces[dock.active]!;
	for (const id of PANEL_IDS) ws = floatPanel(ws, id);
	return { ...dock, workspaces: { ...dock.workspaces, [dock.active]: ws } };
}

/** The fixed default arrangement with every dock open, as the Paint workspace. */
export function openDock(): DockSettings {
	return { active: 'Paint', workspaces: { Paint: defaultWorkspace() } };
}

/** A dock client that answers with `dock` (every dock open unless told otherwise) and records what is saved. */
export function fakeDockClient(dock: DockSettings = openDock()): DockClient {
	return {
		get: vi.fn(async () => structuredClone(dock)),
		save: vi.fn(async () => {}),
	};
}
