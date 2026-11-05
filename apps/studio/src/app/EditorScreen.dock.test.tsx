// Tests for the editor's docks: the default arrangement, its tabs and the menus that show and hide panels
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { defaultDock } from '../panels/dock/dockModel';
import { runCommand } from '../commands/registry';
import { fakeDockClient, openDock } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

async function mount(dock = openDock()) {
	const snapshot = levelSnapshot();
	const client = new FakeLevelClient(snapshot);
	const docks = fakeDockClient(dock);
	const bridge = createCommandBridge();
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<EditorScreen snapshot={snapshot} client={client} docks={docks} />
		</CommandBridgeContext.Provider>,
	);
	await screen.findByRole('region', { name: 'Left dock' });
	return { docks, bridge };
}

describe('the editor’s docks', () => {
	it('opens all three docks in the shipped Paint workspace', async () => {
		await mount(defaultDock());
		expect(screen.getByRole('region', { name: 'Left dock' })).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Right dock' })).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Bottom dock' })).toBeInTheDocument();
		expect(screen.queryByRole('group', { name: 'Right rail' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'Bottom rail' })).toBeNull();
	});

	it('docks the panels around the canvas when every dock is open', async () => {
		await mount();
		const left = screen.getByRole('region', { name: 'Left dock' });
		expect(within(left).getByRole('tab', { name: 'Palette' })).toBeInTheDocument();
		expect(
			within(screen.getByRole('region', { name: 'Right dock' })).getAllByRole('tab'),
		).toHaveLength(2);
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(await within(bottom).findByRole('textbox', { name: 'Script text' })).toBeInTheDocument();
		expect(screen.getByRole('application')).toBeInTheDocument();
	});

	it('switches a zone’s tabs to the real panel', async () => {
		const user = userEvent.setup();
		await mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(within(right).getByRole('tab', { name: 'History' }));
		expect(within(right).getByRole('button', { name: /^Undo/ })).toBeInTheDocument();
	});

	it('floats a docked panel from its header and docks it back from the floating one', async () => {
		const user = userEvent.setup();
		await mount();
		const left = screen.getByRole('region', { name: 'Left dock' });
		await user.click(within(left).getByRole('button', { name: 'Float Palette' }));
		expect(screen.queryByRole('region', { name: 'Left dock' })).toBeNull();
		const floating = screen.getByRole('region', { name: 'Palette' });
		await user.click(within(floating).getByRole('button', { name: 'Dock Palette bottom' }));
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(within(bottom).getByRole('tab', { name: 'Palette' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
	});

	it('hides a docked panel from the Panels menu and shows it as the showing tab', async () => {
		const user = userEvent.setup();
		await mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(screen.getByRole('button', { name: 'Panels' }));
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'Objects' }));
		expect(within(right).queryByRole('tab', { name: 'Objects' })).toBeNull();
		expect(within(right).getByRole('tab', { name: 'History' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'Objects' }));
		expect(within(right).getByRole('tab', { name: 'Objects' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
	});

	it('runs the View menu’s panel rows against the docks', async () => {
		const { bridge } = await mount();
		await waitFor(() => expect(bridge.getSnapshot().facts.editorOpen).toBe(true));
		expect(bridge.getSnapshot().facts.panels.history).toBe(true);
		expect(runCommand('view.panel.history', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(bridge.getSnapshot().facts.panels.history).toBe(false));
		expect(screen.queryByRole('tab', { name: 'History' })).toBeNull();
		runCommand('view.panel.history', bridge.getSnapshot());
		await waitFor(() => expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument());
		runCommand('view.resetLayout', bridge.getSnapshot());
		expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
	});

	it('saves the layout after a change', async () => {
		const user = userEvent.setup();
		const { docks } = await mount();
		await user.click(
			within(screen.getByRole('region', { name: 'Left dock' })).getByRole('button', {
				name: 'Dock Palette right',
			}),
		);
		await waitFor(() => expect(docks.save).toHaveBeenCalled(), { timeout: 2000 });
		const saved = vi.mocked(docks.save).mock.calls.at(-1)![0];
		expect(saved.workspaces[saved.active]!.zones.left.groups).toEqual([]);
	});

	it('folds a dock to a rail, peeks a panel over the level and pins it back', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(screen.getByRole('button', { name: 'Fold the right dock' }));
		expect(screen.queryByRole('region', { name: 'Right dock' })).toBeNull();
		const rail = screen.getByRole('group', { name: 'Right rail' });
		await user.click(within(rail).getByRole('button', { name: 'History' }));
		const peek = screen.getByRole('region', { name: 'History, peeking' });
		expect(within(peek).getByRole('button', { name: /^Undo/ })).toBeInTheDocument();
		await user.click(within(peek).getByRole('button', { name: 'Pin History' }));
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByRole('tab', { name: 'History' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
		expect(screen.queryByRole('region', { name: 'History, peeking' })).toBeNull();
	});

	it('closes a peek with Escape and puts focus back on the rail button', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(screen.getByRole('button', { name: 'Fold the left dock' }));
		const item = within(screen.getByRole('group', { name: 'Left rail' })).getByRole('button', {
			name: 'Palette',
		});
		await user.click(item);
		expect(item).toHaveAttribute('aria-expanded', 'true');
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('region', { name: 'Palette, peeking' })).toBeNull();
		expect(item).toHaveFocus();
		expect(item).toHaveAttribute('aria-expanded', 'false');
	});

	it('opens a folded dock when the Panels menu shows a panel in it', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(screen.getByRole('button', { name: 'Fold the right dock' }));
		await user.click(screen.getByRole('button', { name: 'Panels' }));
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'History' }));
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'History' }));
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByRole('tab', { name: 'History' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
	});

	it('resizes a dock with the keys, held to its cap, and saves the size', async () => {
		const user = userEvent.setup();
		const { docks } = await mount();
		const handle = screen.getByRole('separator', { name: 'Resize the left dock' });
		handle.focus();
		await user.keyboard('{ArrowRight}');
		expect(handle).toHaveAttribute('aria-valuenow', '204');
		await user.keyboard('{End}');
		expect(handle).toHaveAttribute('aria-valuenow', '384');
		await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
		expect(handle).toHaveAttribute('aria-valuenow', '384');
		await waitFor(() => expect(docks.save).toHaveBeenCalled(), { timeout: 2000 });
		const saved = vi.mocked(docks.save).mock.calls.at(-1)![0];
		expect(saved.workspaces[saved.active]!.zones.left.size).toBe(384);
	});

	it('resets a dock’s size with a double-click', async () => {
		const user = userEvent.setup();
		await mount();
		const handle = screen.getByRole('separator', { name: 'Resize the left dock' });
		handle.focus();
		await user.keyboard('{End}');
		await user.dblClick(handle);
		expect(handle).toHaveAttribute('aria-valuenow', '196');
	});

	it('hides the docks and floating panels with Tab on the level and brings them back', async () => {
		const user = userEvent.setup();
		const { bridge } = await mount();
		await user.click(
			within(screen.getByRole('region', { name: 'Left dock' })).getByRole('button', {
				name: 'Float Palette',
			}),
		);
		expect(screen.getByRole('region', { name: 'Palette' })).toBeInTheDocument();
		screen.getByRole('application').focus();
		await user.keyboard('{Tab}');
		expect(screen.queryByRole('region', { name: 'Palette' })).toBeNull();
		expect(screen.queryByRole('region', { name: 'Right dock' })).toBeNull();
		expect(screen.queryByRole('region', { name: 'Bottom dock' })).toBeNull();
		expect(screen.getByRole('application')).toBeInTheDocument();
		expect(bridge.getSnapshot().facts.levelFirst).toBe(true);
		await user.keyboard('{Tab}');
		expect(screen.getByRole('region', { name: 'Palette' })).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Right dock' })).toBeInTheDocument();
		expect(bridge.getSnapshot().facts.levelFirst).toBe(false);
	});

	it('keeps Tab for the focus when it is in a panel', async () => {
		const user = userEvent.setup();
		await mount();
		screen.getByRole('tab', { name: 'Palette' }).focus();
		await user.keyboard('{Tab}');
		expect(screen.getByRole('region', { name: 'Right dock' })).toBeInTheDocument();
	});

	it('keeps the rails of folded docks while the level comes first and restores the same set', async () => {
		const user = userEvent.setup();
		const folded = defaultDock();
		folded.workspaces.Paint!.zones.right.collapsed = true;
		folded.workspaces.Paint!.zones.bottom.collapsed = true;
		const { bridge } = await mount(folded);
		expect(runCommand('view.levelFirst', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(bridge.getSnapshot().facts.levelFirst).toBe(true));
		expect(screen.queryByRole('region', { name: 'Left dock' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Script' })).toBeDisabled();
		expect(screen.getByRole('group', { name: 'Right rail' })).toBeInTheDocument();
		runCommand('view.levelFirst', bridge.getSnapshot());
		await waitFor(() =>
			expect(screen.getByRole('region', { name: 'Left dock' })).toBeInTheDocument(),
		);
		expect(screen.getByRole('button', { name: 'Script' })).toBeEnabled();
		expect(user).toBeDefined();
	});
});
