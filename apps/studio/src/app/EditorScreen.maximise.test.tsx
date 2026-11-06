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
import { setZoneCollapsed } from '../panels/dock/dockLayout';
import { fakeDockClient, openDock, railEntry } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

async function mount(dock = openDock()) {
	const snapshot = levelSnapshot();
	const docks = fakeDockClient(dock);
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
		await user.click(railEntry('Proposals', 'bottom'));
		expect(within(bottom).getByRole('button', { name: 'Maximise Proposals' })).toBeInTheDocument();
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).queryByRole('button', { name: /^Maximise/ })).toBeNull();
	});

	it('fills the workspace, hides the docks and level, and restores the same arrangement', async () => {
		const user = userEvent.setup();
		const { bridge, docks } = await mount();
		await user.click(screen.getByRole('button', { name: 'Maximise Script' }));
		expect(maximised()).toBeInTheDocument();
		// Everything else stays mounted; the stylesheet hides it (and its tab stops).
		expect(document.querySelector('[data-has-maximised]')).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Left dock' })).not.toHaveAttribute(
			'data-panel-maximised',
		);
		expect(bridge.getSnapshot().facts.maximised).toBe('script');
		await user.click(screen.getByRole('button', { name: 'Restore Script' }));
		expect(maximised()).toBeNull();
		expect(document.querySelector('[data-has-maximised]')).toBeNull();
		expect(screen.getByRole('region', { name: 'Left dock' })).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Bottom dock' })).toBeInTheDocument();
		expect(screen.getByRole('application')).toBeInTheDocument();
		expect(bridge.getSnapshot().facts.maximised).toBeNull();
		// Maximising is not part of the saved layout.
		expect(docks.save).not.toHaveBeenCalled();
	});

	it('keeps the Script editor mounted, the same node, while it is maximised and restored', async () => {
		const user = userEvent.setup();
		await mount();
		const editor = await screen.findByRole('textbox', { name: 'Script text' });
		const scroller = editor.closest('.cm-scroller') as HTMLElement;
		scroller.scrollTop = 37;
		await user.click(screen.getByRole('button', { name: 'Maximise Script' }));
		expect(screen.getByRole('textbox', { name: 'Script text' })).toBe(editor);
		expect(document.contains(editor)).toBe(true);
		expect(maximised()).toContainElement(editor);
		expect(scroller.scrollTop).toBe(37);
		await user.click(screen.getByRole('button', { name: 'Restore Script' }));
		expect(screen.getByRole('textbox', { name: 'Script text' })).toBe(editor);
		expect(scroller.scrollTop).toBe(37);
	});

	it('toggles with Ctrl+Shift+M on the focused panel, or the Script when none is', async () => {
		const user = userEvent.setup();
		await mount();
		expect(screen.getByRole('region', { name: 'Bottom dock' })).toBeInTheDocument();
		await user.click(railEntry('Proposals', 'bottom'));
		railEntry('Proposals', 'bottom').focus();
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
		await waitFor(() => {
			const after = labels().map((i) => i.label);
			expect(after).toContain('Restore Script');
			expect(after).not.toContain('Maximise Script');
			expect(after).toContain('Maximise Proposals');
			expect(
				paletteEntries(bridge.getSnapshot())
					.map((e) => e.label)
					.filter((l) => /^(Maximise|Restore)/.test(l)),
			).toEqual(['Maximise Proposals', 'Restore Script']);
		});
		expect(runCommand('view.restore.script', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(maximised()).toBeNull());
	});
});

describe('maximising from a folded dock', () => {
	function foldedBottom() {
		const dock = openDock();
		dock.workspaces[dock.active] = setZoneCollapsed(dock.workspaces[dock.active]!, 'bottom', true);
		return dock;
	}

	it('unfolds the dock on Ctrl+Shift+M, fills the workspace and leaves the dock open on restore', async () => {
		const user = userEvent.setup();
		await mount(foldedBottom());
		expect(screen.queryByRole('region', { name: 'Bottom dock' })).toBeNull();
		await user.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');
		await waitFor(() => expect(maximised()).toHaveAttribute('data-panel-id', 'script'));
		expect(screen.getByRole('textbox', { name: 'Script text' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Restore Script' }));
		expect(maximised()).toBeNull();
		expect(screen.getByRole('region', { name: 'Bottom dock' })).toBeInTheDocument();
	});

	it('mounts the Script editor once and keeps the same node through maximise and restore', async () => {
		const user = userEvent.setup();
		await mount(foldedBottom());
		await user.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');
		const editor = await screen.findByRole('textbox', { name: 'Script text' });
		await user.click(screen.getByRole('button', { name: 'Restore Script' }));
		expect(screen.getByRole('textbox', { name: 'Script text' })).toBe(editor);
	});

	it('runs the Maximise command on a folded dock', async () => {
		const { bridge } = await mount(foldedBottom());
		expect(runCommand('view.maximise.script', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(maximised()).toBeInTheDocument());
		expect(screen.getByRole('region', { name: 'Bottom dock' })).toBeInTheDocument();
	});

	it('maximises a peeking Script straight from the rail, pinning the dock', async () => {
		const user = userEvent.setup();
		await mount(foldedBottom());
		// A folded rail peeks with the arrow key that points into the level.
		railEntry('Script', 'bottom').focus();
		await user.keyboard('{ArrowUp}');
		const peek = await screen.findByRole('region', { name: 'Script, peeking' });
		await user.click(within(peek).getByRole('button', { name: 'Maximise Script' }));
		await waitFor(() => expect(maximised()).toHaveAttribute('data-panel-id', 'script'));
		expect(screen.queryByRole('region', { name: 'Script, peeking' })).toBeNull();
	});

	it('does not offer Maximise on the Palette, even peeking', async () => {
		const user = userEvent.setup();
		const dock = openDock();
		dock.workspaces[dock.active] = setZoneCollapsed(dock.workspaces[dock.active]!, 'left', true);
		await mount(dock);
		railEntry('Palette', 'left').focus();
		await user.keyboard('{ArrowRight}');
		const peek = await screen.findByRole('region', { name: 'Palette, peeking' });
		expect(within(peek).queryByRole('button', { name: /^Maximise/ })).toBeNull();
	});
});
