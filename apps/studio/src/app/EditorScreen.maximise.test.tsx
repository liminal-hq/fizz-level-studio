// Tests for maximising a panel: the button, the keys, what is hidden and what comes back
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { appMenuItems } from '../commands/appMenuModel';
import { paletteEntries } from '../commands/paletteModel';
import { runCommand } from '../commands/registry';
import { fakeDockClient, openDock } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

async function mount() {
	const snapshot = levelSnapshot();
	const docks = fakeDockClient(openDock());
	const bridge = createCommandBridge();
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<EditorScreen snapshot={snapshot} client={new FakeLevelClient(snapshot)} docks={docks} />
		</CommandBridgeContext.Provider>,
	);
	await screen.findByRole('region', { name: 'Left dock' });
	return { bridge, docks };
}

const maximised = () => document.querySelector('[data-panel-maximised]');

describe('maximising a panel', () => {
	it('offers the button on Script and Proposals only', async () => {
		const user = userEvent.setup();
		await mount();
		const left = screen.getByRole('region', { name: 'Left dock' });
		expect(within(left).queryByRole('button', { name: /^Maximise/ })).toBeNull();
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(within(bottom).getByRole('button', { name: 'Maximise Script' })).toBeInTheDocument();
		await user.click(within(bottom).getByRole('tab', { name: 'Proposals' }));
		expect(within(bottom).getByRole('button', { name: 'Maximise Proposals' })).toBeInTheDocument();
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).queryByRole('button', { name: /^Maximise/ })).toBeNull();
	});

	it('fills the workspace, hides the docks and level, and restores the same arrangement', async () => {
		const user = userEvent.setup();
		const { bridge, docks } = await mount();
		await user.click(screen.getByRole('button', { name: 'Maximise Script' }));
		expect(maximised()).toBeInTheDocument();
		expect(screen.queryByRole('region', { name: 'Left dock' })).toBeNull();
		expect(screen.queryByRole('region', { name: 'Bottom dock' })).toBeNull();
		expect(screen.queryByRole('application')).toBeNull();
		expect(bridge.getSnapshot().facts.maximised).toBe('script');
		await user.click(screen.getByRole('button', { name: 'Restore Script' }));
		expect(maximised()).toBeNull();
		expect(screen.getByRole('region', { name: 'Left dock' })).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Bottom dock' })).toBeInTheDocument();
		expect(screen.getByRole('application')).toBeInTheDocument();
		expect(bridge.getSnapshot().facts.maximised).toBeNull();
		// Maximising is not part of the saved layout.
		expect(docks.save).not.toHaveBeenCalled();
	});

	it('toggles with Ctrl+Shift+M on the focused panel, or the Script when none is', async () => {
		const user = userEvent.setup();
		await mount();
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		await user.click(within(bottom).getByRole('tab', { name: 'Proposals' }));
		within(bottom).getByRole('tab', { name: 'Proposals' }).focus();
		await user.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');
		expect(maximised()).toHaveAttribute('data-panel-id', 'proposals');
		await user.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');
		expect(maximised()).toBeNull();
		(document.activeElement as HTMLElement).blur();
		screen.getByRole('region', { name: 'Left dock' });
		// With the focus on the Palette, which is not expandable, the last expandable one is used.
		await user.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');
		expect(maximised()).toHaveAttribute('data-panel-id', 'proposals');
	});

	it('restores with Escape, but not from inside the script editor', async () => {
		const user = userEvent.setup();
		await mount();
		await user.click(screen.getByRole('button', { name: 'Maximise Script' }));
		const editor = await screen.findByRole('textbox', { name: 'Script text' });
		editor.focus();
		await user.keyboard('{Escape}');
		expect(maximised()).toBeInTheDocument();
		screen.getByRole('button', { name: 'Restore Script' }).focus();
		await user.keyboard('{Escape}');
		await waitFor(() => expect(maximised()).toBeNull());
	});

	it('ignores Tab (level-first) while a panel is maximised', async () => {
		const user = userEvent.setup();
		const { bridge } = await mount();
		await user.click(screen.getByRole('button', { name: 'Maximise Script' }));
		document.body.focus();
		await user.keyboard('{Tab}');
		expect(bridge.getSnapshot().facts.levelFirst).toBe(false);
		expect(maximised()).toBeInTheDocument();
	});

	it('lists one Maximise or Restore row at a time in the View menu and the palette', async () => {
		const { bridge } = await mount();
		const labels = () => {
			const view = appMenuItems(bridge.getSnapshot()).find((item) => item.id === 'menu:view')!;
			return (view as { items: { label?: string; shortcut?: string }[] }).items;
		};
		expect(
			labels()
				.filter((i) => i.label?.startsWith('Maximise'))
				.map((i) => i.label),
		).toEqual(['Maximise Proposals', 'Maximise Script']);
		expect(labels().find((i) => i.label === 'Maximise Script')?.shortcut).toBe('Ctrl+Shift+M');
		expect(runCommand('view.maximise.script', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(maximised()).toBeInTheDocument());
		const after = labels().map((i) => i.label);
		expect(after).toContain('Restore Script');
		expect(after).not.toContain('Maximise Script');
		expect(after).toContain('Maximise Proposals');
		expect(
			paletteEntries(bridge.getSnapshot())
				.map((e) => e.label)
				.filter((l) => /^(Maximise|Restore)/.test(l)),
		).toEqual(['Maximise Proposals', 'Restore Script']);
		expect(runCommand('view.restore.script', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(maximised()).toBeNull());
	});
});
