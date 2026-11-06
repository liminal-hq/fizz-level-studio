// Dock layouts and a dock client for the editor's tests
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
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

const RAILS = { left: 'Left rail', right: 'Right rail', bottom: 'Bottom rail' } as const;

/** The entries named `name` on the rails, or on one zone's rail. */
function railEntries(name: string, zone?: keyof typeof RAILS): HTMLElement[] {
	const scope = zone ? within(screen.getByRole('group', { name: RAILS[zone] })) : screen;
	return scope
		.queryAllByRole('button', { name })
		.filter((button) => button.hasAttribute('data-rail-item'));
}

/** The rail entry for the docked panel named `name`, as a person finds it at the window's edge. */
export function railEntry(name: string, zone?: keyof typeof RAILS): HTMLElement {
	const found = railEntries(name, zone);
	if (found.length !== 1)
		throw new Error(`expected one rail entry named ${name}, found ${found.length}`);
	return found[0]!;
}

export function queryRailEntry(name: string, zone?: keyof typeof RAILS): HTMLElement | null {
	return railEntries(name, zone)[0] ?? null;
}

export function findRailEntry(name: string, zone?: keyof typeof RAILS): Promise<HTMLElement> {
	return waitFor(() => railEntry(name, zone));
}

/** Shows a docked panel from its rail; choosing the panel already showing would fold its dock. */
export async function showFromRail(user: UserEvent, name: string): Promise<void> {
	const entry = railEntry(name);
	if (entry.getAttribute('aria-pressed') !== 'true') await user.click(entry);
}

/** A dock client that answers with `dock` (every dock open unless told otherwise) and records what is saved. */
export function fakeDockClient(dock: DockSettings = openDock()): DockClient {
	return {
		get: vi.fn(async () => structuredClone(dock)),
		save: vi.fn(async () => {}),
	};
}
