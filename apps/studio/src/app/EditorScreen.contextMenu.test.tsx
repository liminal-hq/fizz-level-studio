// Tests for the right-click menus of the editor's chrome: panel headers, rails, tabs, the commands row, zoom and History
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCommandBridge } from '../commands/commandBridge';
import { createBridgeHub } from '../panels/windows/fakePanelBridge';
import { fakeDockClient, openDock } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { fakePanelWindows } from '../test/panelWindowFixtures';
import { createFakeTearoff } from '../services/fakeTearoffClient';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { ContextMenuHost } from './ContextMenuHost';
import { EditorScreen } from './EditorScreen';

afterEach(() => vi.restoreAllMocks());

async function mount() {
	const bridge = createCommandBridge();
	const snapshot = levelSnapshot();
	render(
		<ContextMenuHost bridge={bridge} nativeMenu={{ allowed: async () => false }}>
			<EditorScreen
				snapshot={snapshot}
				client={new FakeLevelClient(snapshot)}
				docks={fakeDockClient(openDock())}
				panelWindows={fakePanelWindows().client}
				panelBridge={createBridgeHub().bridgeFor('main-1')}
				tearoff={createFakeTearoff()}
			/>
		</ContextMenuHost>,
	);
	await screen.findByRole('region', { name: 'Left dock' });
	await act(async () => {});
	return bridge;
}

/** The rows of the open menu: actions and ticked rows alike. */
const rows = () => [
	...screen.getByRole('menu').querySelectorAll<HTMLElement>('[role^="menuitem"]'),
];
const rowLabels = () => rows().map((row) => row.querySelector('.label')?.textContent ?? '');
const row = async (name: RegExp) =>
	waitFor(() => {
		const found = rows().find((r) => name.test(r.querySelector('.label')?.textContent ?? ''));
		if (!found) throw new Error(`no row ${name}`);
		return found;
	});

const headerOf = (region: string, title: string) =>
	within(screen.getByRole('region', { name: region }))
		.getByRole('heading', { name: title })
		.closest<HTMLElement>('[data-strip]')!;

describe('a panel in a dock', () => {
	it('opens the panel menu on its header, with Maximise and Hide after the layout rows', async () => {
		await mount();
		expect(fireEvent.contextMenu(headerOf('Right dock', 'Inspector'))).toBe(false);
		await screen.findByRole('menu', { name: 'Inspector menu' });
		const rows = rowLabels();
		expect(rows).toEqual(
			expect.arrayContaining([
				'Dock left',
				'Dock right',
				'Dock bottom',
				'Float',
				'Tear off',
				'Reset layout',
				'Hide Inspector',
			]),
		);
		expect(rows.indexOf('Hide Inspector')).toBeGreaterThan(rows.indexOf('Reset layout'));
	});

	it('runs a row as its command: Hide closes the panel', async () => {
		await mount();
		fireEvent.contextMenu(headerOf('Right dock', 'Inspector'));
		fireEvent.click(await row(/Hide Inspector/));
		expect(screen.queryByRole('menu')).toBeNull();
		await act(async () => {});
		expect(
			within(screen.getByRole('region', { name: 'Right dock' })).queryByRole('heading', {
				name: 'Inspector',
			}),
		).toBeNull();
	});

	it("opens the same menu on the panel's rail entry, and none on the rail's gap", async () => {
		await mount();
		const entry = document.querySelector<HTMLElement>('[data-rail-item="layers"]')!;
		expect(fireEvent.contextMenu(entry)).toBe(false);
		await screen.findByRole('menu', { name: 'Layers menu' });
		expect(rowLabels()).toContain('Hide Layers');
		fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
		const rail = document.querySelector<HTMLElement>('[data-rail="right"]')!;
		expect(fireEvent.contextMenu(rail)).toBe(false);
		await act(async () => {});
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('opens from the keyboard on a rail entry and returns the focus to it', async () => {
		await mount();
		const entry = document.querySelector<HTMLElement>('[data-rail-item="layers"]')!;
		entry.focus();
		fireEvent.keyDown(entry, { key: 'F10', shiftKey: true });
		await screen.findByRole('menu', { name: 'Layers menu' });
		expect(document.activeElement?.getAttribute('role')).toMatch(/^menuitem/);
		expect(screen.getByRole('menu').contains(document.activeElement)).toBe(true);
		fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
		expect(document.activeElement).toBe(entry);
	});

	it('is not replaced by the header when a row of the ⋮ menu is right-clicked', async () => {
		await mount();
		const header = headerOf('Right dock', 'Inspector');
		fireEvent.click(within(header).getByRole('button', { name: /menu/i }));
		const dockLeft = await row(/Dock left/);
		fireEvent.contextMenu(dockLeft);
		await act(async () => {});
		expect(screen.getAllByRole('menu')).toHaveLength(1);
		// The right-click did not open the header's menu in its place: the ⋮ menu is still the one open.
		expect(rowLabels()).toContain('Dock left');
		expect(rowLabels()).not.toContain('Hide Inspector');
	});
});

describe('the script tab', () => {
	it('opens its own menu, not the header’s', async () => {
		await mount();
		const tab = await screen.findByRole('tab', { name: /./ });
		expect(fireEvent.contextMenu(tab)).toBe(false);
		await screen.findByRole('menu', { name: 'Script tab menu' });
		const rows = rowLabels();
		expect(rows).toEqual(
			expect.arrayContaining([
				'Show the level script tab',
				'Close the level script tab',
				'Tear off',
			]),
		);
		expect(screen.getAllByRole('menu')).toHaveLength(1);
	});
});

describe('a floating panel', () => {
	it('opens the panel menu on its header', async () => {
		const bridge = createCommandBridge();
		const snapshot = levelSnapshot();
		const dock = fakeDockClient(openDock());
		render(
			<ContextMenuHost bridge={bridge} nativeMenu={{ allowed: async () => false }}>
				<EditorScreen
					snapshot={snapshot}
					client={new FakeLevelClient(snapshot)}
					docks={dock}
					panelWindows={fakePanelWindows().client}
					panelBridge={createBridgeHub().bridgeFor('main-1')}
					tearoff={createFakeTearoff()}
				/>
			</ContextMenuHost>,
		);
		await screen.findByRole('region', { name: 'Left dock' });
		await act(async () => {});
		// Float the Palette from its own menu, then right-click its floating header.
		fireEvent.contextMenu(headerOf('Left dock', 'Palette'));
		fireEvent.click(await row(/^Float/));
		await act(async () => {});
		const floating = document.querySelector<HTMLElement>('[data-panel="palette"]')!;
		expect(floating).not.toBeNull();
		fireEvent.contextMenu(floating.querySelector('header')!);
		await screen.findByRole('menu', { name: 'Palette menu' });
		expect(rowLabels()).toContain('Hide Palette');
	});
});
