// Tests for the editor's docks: the default arrangement, its rails and the menus that show and hide panels
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

/** The entry for a panel on a zone's rail. */
function railItem(rail: string, name: string): HTMLElement {
	return within(screen.getByRole('group', { name: rail })).getByRole('button', { name });
}

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
		for (const name of ['Left rail', 'Right rail', 'Bottom rail']) {
			expect(screen.getByRole('group', { name })).toBeInTheDocument();
		}
	});

	it('docks the panels around the canvas when every dock is open', async () => {
		await mount();
		const left = screen.getByRole('region', { name: 'Left dock' });
		expect(within(left).getByRole('heading', { name: 'Palette' })).toBeInTheDocument();
		expect(railItem('Left rail', 'Palette')).toHaveAttribute('aria-pressed', 'true');
		expect(
			within(screen.getByRole('group', { name: 'Right rail' })).getAllByRole('button'),
		).toHaveLength(2);
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(await within(bottom).findByRole('textbox', { name: 'Script text' })).toBeInTheDocument();
		expect(screen.getByRole('application')).toBeInTheDocument();
	});

	it('lays the docks over the level and tells the canvas how far they cover it', async () => {
		await mount();
		const canvas = screen.getByRole('application');
		const shell = canvas.closest<HTMLElement>('[data-level]')!.parentElement!;
		const root = canvas.closest('[data-level]')!.querySelector<HTMLElement>('[style]')!;
		const px = (el: HTMLElement, name: string) =>
			Number(el.style.getPropertyValue(name).replace('px', ''));
		for (const edge of ['left', 'right', 'bottom']) {
			expect(px(root, `--fls-cover-${edge}`)).toBe(
				px(shell, `--fls-rail-${edge}`) + px(shell, `--fls-dock-${edge}`),
			);
			expect(px(root, `--fls-cover-${edge}`)).toBeGreaterThan(0);
		}
		// The status line and the tools are in the level, outside every dock.
		const status = screen.getByText(/^Cell /);
		const tools = screen.getByRole('group', { name: 'Tools' });
		for (const name of ['Left dock', 'Right dock', 'Bottom dock']) {
			expect(screen.getByRole('region', { name })).not.toContainElement(status);
			expect(screen.getByRole('region', { name })).not.toContainElement(tools);
		}
	});

	it('shows the real panel chosen on the rail, and folds the dock when it is chosen again', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(railItem('Right rail', 'History'));
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByRole('button', { name: /^Undo/ })).toBeInTheDocument();
		expect(within(right).getByRole('heading', { name: 'History' })).toBeInTheDocument();
		expect(railItem('Right rail', 'History')).toHaveAttribute('aria-pressed', 'true');
		expect(railItem('Right rail', 'Objects')).toHaveAttribute('aria-pressed', 'false');
		await user.click(railItem('Right rail', 'History'));
		expect(screen.queryByRole('region', { name: 'Right dock' })).toBeNull();
		expect(screen.getByRole('group', { name: 'Right rail' })).toBeInTheDocument();
		await user.click(railItem('Right rail', 'Objects'));
		const opened = screen.getByRole('region', { name: 'Right dock' });
		expect(within(opened).getByRole('heading', { name: 'Objects' })).toBeInTheDocument();
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
		expect(within(bottom).getByRole('heading', { name: 'Palette' })).toBeInTheDocument();
		expect(railItem('Bottom rail', 'Palette')).toHaveAttribute('aria-pressed', 'true');
		expect(screen.queryByRole('group', { name: 'Left rail' })).toBeNull();
	});

	it('hides a docked panel from the Panels menu and shows it as the showing tab', async () => {
		const user = userEvent.setup();
		await mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(screen.getByRole('button', { name: 'Panels' }));
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'Objects' }));
		const rail = screen.getByRole('group', { name: 'Right rail' });
		expect(within(rail).queryByRole('button', { name: 'Objects' })).toBeNull();
		expect(railItem('Right rail', 'History')).toHaveAttribute('aria-pressed', 'true');
		expect(within(right).getByRole('heading', { name: 'History' })).toBeInTheDocument();
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'Objects' }));
		expect(railItem('Right rail', 'Objects')).toHaveAttribute('aria-pressed', 'true');
	});

	it('runs the View menu’s panel rows against the docks', async () => {
		const { bridge } = await mount();
		await waitFor(() => expect(bridge.getSnapshot().facts.editorOpen).toBe(true));
		expect(bridge.getSnapshot().facts.panels.history).toBe(true);
		expect(runCommand('view.panel.history', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(bridge.getSnapshot().facts.panels.history).toBe(false));
		const rail = () => within(screen.getByRole('group', { name: 'Right rail' }));
		expect(rail().queryByRole('button', { name: 'History' })).toBeNull();
		runCommand('view.panel.history', bridge.getSnapshot());
		await waitFor(() =>
			expect(rail().getByRole('button', { name: 'History' })).toBeInTheDocument(),
		);
		runCommand('view.resetLayout', bridge.getSnapshot());
		expect(rail().getByRole('button', { name: 'History' })).toBeInTheDocument();
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
		railItem('Right rail', 'History').focus();
		await user.keyboard('{ArrowLeft}');
		const peek = screen.getByRole('region', { name: 'History, peeking' });
		expect(within(peek).getByRole('button', { name: /^Undo/ })).toBeInTheDocument();
		await user.click(within(peek).getByRole('button', { name: 'Pin History' }));
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByRole('heading', { name: 'History' })).toBeInTheDocument();
		expect(railItem('Right rail', 'History')).toHaveAttribute('aria-pressed', 'true');
		expect(screen.queryByRole('region', { name: 'History, peeking' })).toBeNull();
	});

	it('closes a peek with Escape and puts focus back on the rail button', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(screen.getByRole('button', { name: 'Fold the left dock' }));
		const item = within(screen.getByRole('group', { name: 'Left rail' })).getByRole('button', {
			name: 'Palette',
		});
		item.focus();
		await user.keyboard('{ArrowRight}');
		expect(item).toHaveAttribute('data-peeking');
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('region', { name: 'Palette, peeking' })).toBeNull();
		expect(item).toHaveFocus();
		expect(item).not.toHaveAttribute('data-peeking');
	});

	it('opens a folded dock when the Panels menu shows a panel in it', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(screen.getByRole('button', { name: 'Fold the right dock' }));
		await user.click(screen.getByRole('button', { name: 'Panels' }));
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'History' }));
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'History' }));
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByRole('heading', { name: 'History' })).toBeInTheDocument();
		expect(railItem('Right rail', 'History')).toHaveAttribute('aria-pressed', 'true');
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
		railItem('Left rail', 'Palette').focus();
		await user.keyboard('{Tab}');
		expect(screen.getByRole('region', { name: 'Right dock' })).toBeInTheDocument();
	});

	it('keeps every rail while the level comes first and restores the same set', async () => {
		const user = userEvent.setup();
		const folded = defaultDock();
		folded.workspaces.Paint!.zones.right.collapsed = true;
		folded.workspaces.Paint!.zones.bottom.collapsed = true;
		const { bridge } = await mount(folded);
		expect(runCommand('view.levelFirst', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(bridge.getSnapshot().facts.levelFirst).toBe(true));
		expect(screen.queryByRole('region', { name: 'Left dock' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Script' })).toBeDisabled();
		expect(railItem('Left rail', 'Palette')).toBeDisabled();
		expect(screen.getByRole('group', { name: 'Right rail' })).toBeInTheDocument();
		runCommand('view.levelFirst', bridge.getSnapshot());
		await waitFor(() =>
			expect(screen.getByRole('region', { name: 'Left dock' })).toBeInTheDocument(),
		);
		expect(screen.getByRole('button', { name: 'Script' })).toBeEnabled();
		expect(user).toBeDefined();
	});
});
