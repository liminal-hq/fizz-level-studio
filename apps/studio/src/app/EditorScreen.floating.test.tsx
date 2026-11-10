// Tests for the editor's floating panels: they float over the canvas and keep their place
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
import { setPanelVisible } from '../panels/dock/dockLayout';
import type { DockClient } from '../services/dockClient';
import { fakeDockClient, floatingDock } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

function mount(dock = floatingDock()) {
	const snapshot = levelSnapshot();
	const client = new FakeLevelClient(snapshot);
	const docks: DockClient = fakeDockClient(dock);
	const bridge = createCommandBridge();
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<EditorScreen snapshot={snapshot} client={client} docks={docks} />
		</CommandBridgeContext.Provider>,
	);
	return { docks, bridge };
}

describe('the editor’s floating panels', () => {
	it('shows each panel as a named region over the canvas', async () => {
		mount();
		for (const name of ['Palette', 'Objects', 'History', 'Proposals', 'Script']) {
			expect(await screen.findByRole('region', { name })).toBeInTheDocument();
		}
		expect(screen.getByRole('application')).toBeInTheDocument();
	});

	it('names the active brush beside the palette’s title', async () => {
		mount();
		const palette = await screen.findByRole('region', { name: 'Palette' });
		expect(within(palette).getByText('grass')).toBeInTheDocument();
	});

	it('collapses a panel to its header and opens it again', async () => {
		const user = userEvent.setup();
		mount();
		const history = await screen.findByRole('region', { name: 'History' });
		await user.click(within(history).getByRole('button', { name: 'Collapse History' }));
		expect(history).toHaveAttribute('data-collapsed');
		await user.click(within(history).getByRole('button', { name: 'Expand History' }));
		expect(history).not.toHaveAttribute('data-collapsed');
	});

	it('brings a grabbed panel in front', async () => {
		mount();
		const palette = await screen.findByRole('region', { name: 'Palette' });
		const z = () => Number(palette.style.getPropertyValue('--fls-float-z'));
		const before = z();
		fireEvent.pointerDown(palette, { button: 0 });
		expect(z()).toBeGreaterThan(before);
	});

	it('moves a panel with the keyboard and saves its place', async () => {
		const user = userEvent.setup();
		const { docks } = mount();
		const history = await screen.findByRole('region', { name: 'History' });
		const start = Number(history.style.getPropertyValue('--fls-float-x').replace('px', ''));
		within(history).getByRole('button', { name: 'Move History' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(history.style.getPropertyValue('--fls-float-x')).toBe(`${start + 8}px`);
		await waitFor(() => expect(docks.save).toHaveBeenCalled(), { timeout: 2000 });
		const saved = vi.mocked(docks.save).mock.calls.at(-1)![0];
		expect(saved.workspaces[saved.active]!.panels.history!.float.x).toBe(start + 8);
	});

	it('puts the panels back with Ctrl+Shift+0', async () => {
		const user = userEvent.setup();
		mount();
		const history = await screen.findByRole('region', { name: 'History' });
		const start = history.style.getPropertyValue('--fls-float-x');
		within(history).getByRole('button', { name: 'Move History' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(history.style.getPropertyValue('--fls-float-x')).not.toBe(start);
		await user.keyboard('{Control>}{Shift>}0{/Shift}{/Control}');
		// Resetting returns the panels to the docks.
		await waitFor(() =>
			expect(screen.getByRole('region', { name: 'Left dock' })).toBeInTheDocument(),
		);
	});

	it('does not show a panel that is hidden in the saved layout', async () => {
		const dock = floatingDock();
		dock.workspaces[dock.active] = setPanelVisible(
			dock.workspaces[dock.active]!,
			'proposals',
			false,
		);
		mount(dock);
		await screen.findByRole('region', { name: 'Script' });
		await waitFor(() => expect(screen.queryByRole('region', { name: 'Proposals' })).toBeNull());
	});

	it('hides and shows a panel with its command, and saves the choice', async () => {
		const { docks, bridge } = mount();
		await screen.findByRole('region', { name: 'History' });
		await waitFor(() => expect(bridge.getSnapshot().facts.editorOpen).toBe(true));
		runCommand('view.panel.history', bridge.getSnapshot());
		await waitFor(() => expect(screen.queryByRole('region', { name: 'History' })).toBeNull());
		await waitFor(() => expect(docks.save).toHaveBeenCalled(), { timeout: 2000 });
		const saved = vi.mocked(docks.save).mock.calls.at(-1)![0];
		expect(saved.workspaces[saved.active]!.panels.history!.float.visible).toBe(false);
		await waitFor(() => expect(bridge.getSnapshot().facts.panels.history).toBe(false));
		runCommand('view.panel.history', bridge.getSnapshot());
		expect(await screen.findByRole('region', { name: 'History' })).toBeInTheDocument();
	});

	it('resets with its command to the docked default', async () => {
		const { docks, bridge } = mount();
		await screen.findByRole('region', { name: 'History' });
		await waitFor(() => expect(bridge.getSnapshot().facts.editorOpen).toBe(true));
		runCommand('view.resetLayout', bridge.getSnapshot());
		await waitFor(() => expect(screen.queryByRole('region', { name: 'History' })).toBeNull());
		expect(screen.getByRole('region', { name: 'Left dock' })).toBeInTheDocument();
		await waitFor(() => expect(docks.save).toHaveBeenCalled(), { timeout: 2000 });
		const saved = vi.mocked(docks.save).mock.calls.at(-1)![0];
		const places = Object.values(saved.workspaces[saved.active]!.panels).map((e) => e.place);
		expect(places.every((place) => place === 'docked')).toBe(true);
	});
});
