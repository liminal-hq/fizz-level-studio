// Tests for tearing any panel off into a window of its own, from the editor's side
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
import { PANEL_IDS, defaultDock } from '../panels/dock/dockModel';
import { sendToWindow } from '../panels/dock/dockLayout';
import { createBridgeHub } from '../panels/windows/fakePanelBridge';
import { fakeDockClient, openDock } from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { fakePanelWindows } from '../test/panelWindowFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

function dockWithWindow(panel: string) {
	const dock = openDock();
	const workspace = dock.workspaces.Paint!;
	return { ...dock, workspaces: { Paint: sendToWindow(workspace, panel) } };
}

async function mount(options: { dock?: ReturnType<typeof openDock>; open?: string[] } = {}) {
	const snapshot = levelSnapshot();
	const client = new FakeLevelClient(snapshot);
	const docks = fakeDockClient(options.dock ?? openDock());
	const windows = fakePanelWindows(options.open);
	const bridge = createCommandBridge();
	const hub = createBridgeHub();
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<EditorScreen
				snapshot={snapshot}
				client={client}
				docks={docks}
				panelWindows={windows.client}
				panelBridge={hub.bridgeFor('main-1')}
			/>
		</CommandBridgeContext.Provider>,
	);
	await screen.findByRole('region', { name: 'Left dock' });
	return { docks, windows, bridge, hub, client };
}

describe('tearing a panel off', () => {
	it.each(PANEL_IDS.map((id) => [id]))(
		'opens the %s panel in a window from its header',
		async (id) => {
			const user = userEvent.setup();
			const { windows } = await mount();
			const title = {
				palette: 'Palette',
				objects: 'Objects',
				history: 'History',
				proposals: 'Proposals',
				script: 'Script',
			}[id]!;
			// Show the panel to tear off: click its tab.
			await user.click(screen.getByRole('tab', { name: title }));
			await user.click(
				screen.getByRole('button', { name: `Tear off ${title} into its own window` }),
			);
			await waitFor(() => expect(windows.client.tearOff).toHaveBeenCalledWith(id, null));
			expect(windows.open.has(`panel-${id}-1`)).toBe(true);
			// The panel's tab stays, marked away, and its content is the notice with Dock back.
			const tab = await screen.findByRole('tab', { name: `${title} (own window)` });
			expect(tab).toHaveAttribute('aria-selected', 'true');
			expect(screen.getByText(`The ${title} panel is open in its own window.`)).toBeVisible();
		},
	);

	it('docks a panel back from the notice and from its window closing', async () => {
		const user = userEvent.setup();
		const { windows, docks } = await mount({
			dock: dockWithWindow('history'),
			open: ['panel-history-1'],
		});
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(within(right).getByRole('tab', { name: 'History (own window)' }));
		await user.click(within(right).getByRole('button', { name: 'Dock back' }));
		expect(windows.client.dockBack).toHaveBeenCalledWith('history');
		await waitFor(() => expect(within(right).getByRole('tab', { name: 'History' })).toBeVisible());

		await user.click(
			within(right).getByRole('button', { name: 'Tear off History into its own window' }),
		);
		await within(right).findByRole('tab', { name: 'History (own window)' });
		act(() => windows.close('panel-history-1'));
		await waitFor(() => expect(within(right).getByRole('tab', { name: 'History' })).toBeVisible());
		expect(docks.save).toBeDefined();
	});

	it('opens a window for a panel the saved arrangement has in a window, when the editor starts', async () => {
		const { windows } = await mount({ dock: dockWithWindow('proposals') });
		await waitFor(() =>
			expect(windows.client.tearOff).toHaveBeenCalledWith('proposals', expect.anything()),
		);
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(within(bottom).getByRole('tab', { name: 'Proposals (own window)' })).toBeVisible();
	});

	it('does not open a window that is already open', async () => {
		const { windows } = await mount({ dock: dockWithWindow('script'), open: ['panel-script-1'] });
		await screen.findByRole('tab', { name: 'Script (own window)' });
		expect(windows.client.tearOff).not.toHaveBeenCalled();
	});

	it('closes a panel’s window when the panel is docked elsewhere from its tab', async () => {
		const user = userEvent.setup();
		const { windows } = await mount({ dock: dockWithWindow('history'), open: ['panel-history-1'] });
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(within(right).getByRole('tab', { name: 'History (own window)' }));
		await user.click(
			within(right).getByRole('button', { name: 'Dock History (own window) bottom' }),
		);
		await waitFor(() => expect(windows.client.dockBack).toHaveBeenCalledWith('history'));
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(within(bottom).getByRole('tab', { name: 'History' })).toBeVisible();
	});

	it('leaves the panel where it was when the window cannot open', async () => {
		const user = userEvent.setup();
		const { windows } = await mount();
		windows.client.tearOff = async () => {
			throw new Error('refused');
		};
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(
			within(right).getByRole('button', { name: 'Tear off Objects into its own window' }),
		);
		expect(within(right).getByRole('tab', { name: 'Objects' })).toBeVisible();
	});
});

describe('the Tear off and Dock back commands', () => {
	it('are built for each panel and run against the windows', async () => {
		const { bridge, windows } = await mount();
		await waitFor(() => expect(bridge.getSnapshot().facts.editorOpen).toBe(true));
		expect(runCommand('view.panel.objects.tearOff', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(bridge.getSnapshot().facts.away.objects).toBe(true));
		expect(windows.open.has('panel-objects-1')).toBe(true);
		// Away now: Tear off is no longer offered and Dock back is.
		expect(runCommand('view.panel.objects.tearOff', bridge.getSnapshot())).toBe(false);
		expect(runCommand('view.panel.objects.dockBack', bridge.getSnapshot())).toBe(true);
		await waitFor(() => expect(bridge.getSnapshot().facts.away.objects).toBe(false));
	});
});

describe('a torn-off panel from floating', () => {
	it('stays in the main window as a floating notice', async () => {
		const user = userEvent.setup();
		const { windows } = await mount({ dock: defaultDock() });
		const left = await screen.findByRole('region', { name: 'Left dock' });
		await user.click(within(left).getByRole('button', { name: 'Float Palette' }));
		const floating = screen.getByRole('region', { name: 'Palette' });
		await user.click(
			within(floating).getByRole('button', { name: 'Tear off Palette into its own window' }),
		);
		await waitFor(() => expect(windows.open.has('panel-palette-1')).toBe(true));
		expect(
			await within(screen.getByRole('region', { name: 'Palette' })).findByText(
				'The Palette panel is open in its own window.',
			),
		).toBeVisible();
	});
});

describe('the bridge to the panel windows', () => {
	it('answers a hello with the editor state and applies a brush chosen in the window', async () => {
		const { hub } = await mount({ dock: dockWithWindow('palette'), open: ['panel-palette-1'] });
		const panel = hub.bridgeFor('panel-palette-1');
		let shared: unknown = null;
		panel.on('editor', (share) => (shared = share));
		panel.send('main-1', 'hello', null);
		expect(shared).toMatchObject({ levelId: expect.any(String), tool: 'paint', ghostsShown: true });
		act(() => panel.send('main-1', 'palette/set', { brush: { group: 'item', kind: 'cookie' } }));
		await waitFor(() => expect(shared).toMatchObject({ brush: { group: 'item', kind: 'cookie' } }));
	});

	it('ignores a message of the wrong shape', async () => {
		const { hub } = await mount({ dock: dockWithWindow('palette'), open: ['panel-palette-1'] });
		const panel = hub.bridgeFor('panel-palette-1');
		let shared: { brush: { kind: string } } | null = null;
		panel.on('editor', (share) => (shared = share as never));
		panel.send('main-1', 'hello', null);
		const before = shared!.brush.kind;
		act(() => {
			panel.send('main-1', 'palette/set', { brush: { group: 'nonsense', kind: 3 } } as never);
			panel.send('main-1', 'objects/choose', { x: 'a' } as never);
			panel.send('main-1', 'script/show', { line: -4 });
		});
		panel.send('main-1', 'hello', null);
		expect(shared!.brush.kind).toBe(before);
	});

	it('reveals a cell and the script line when the torn-off Objects list chooses one', async () => {
		const { hub, client } = await mount({
			dock: dockWithWindow('objects'),
			open: ['panel-objects-1'],
		});
		client.cellLines.set('3,2', 5);
		const panel = hub.bridgeFor('panel-objects-1');
		let focus: unknown = null;
		panel.on('editor', (share) => (focus = share.focus));
		panel.send('main-1', 'hello', null);
		expect(focus).toBeNull();
		act(() => panel.send('main-1', 'objects/choose', { x: 3, y: 2 }));
		await waitFor(() => expect(focus).toMatchObject({ line: 5 }));
	});

	it('shares the proposals toggle both ways', async () => {
		const { hub } = await mount({ dock: dockWithWindow('proposals'), open: ['panel-proposals-1'] });
		const panel = hub.bridgeFor('panel-proposals-1');
		let shown: unknown = null;
		panel.on('editor', (share) => (shown = share.ghostsShown));
		panel.send('main-1', 'hello', null);
		expect(shown).toBe(true);
		act(() => panel.send('main-1', 'proposals/shown', { shown: false }));
		await waitFor(() => expect(shown).toBe(false));
	});
});

/** The window record the last save holds for a panel in the active workspace. */
function savedWindow(docks: { save: unknown }, panel: string) {
	const saved = vi.mocked(docks.save as (d: DockSettings) => Promise<void>).mock.calls.at(-1)?.[0];
	return saved?.workspaces[saved.active]?.panels[panel]?.window ?? null;
}

describe('remembering where a torn-off window is', () => {
	it('records the first window where Rust opened it and saves it with the workspace', async () => {
		const user = userEvent.setup();
		const { docks } = await mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(
			within(right).getByRole('button', { name: 'Tear off Objects into its own window' }),
		);
		await waitFor(() => expect(docks.save).toHaveBeenCalled(), { timeout: 2000 });
		expect(savedWindow(docks, 'objects')).toEqual({ x: 100, y: 120, w: 520, h: 720 });
	});

	it('records a window that moves or resizes, and asks for it again where it was left', async () => {
		const user = userEvent.setup();
		const { docks, windows } = await mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(
			within(right).getByRole('button', { name: 'Tear off Objects into its own window' }),
		);
		await within(right).findByRole('tab', { name: 'Objects (own window)' });
		act(() => {
			windows.place('panel-objects-1', { x: 5, y: 6, w: 640, h: 480 });
			windows.place('panel-objects-1', { x: 50, y: 60, w: 700, h: 500 });
		});
		await waitFor(
			() => expect(savedWindow(docks, 'objects')).toEqual({ x: 50, y: 60, w: 700, h: 500 }),
			{
				timeout: 3000,
			},
		);
		// Dock it back and tear it off again: the record is passed to Rust, not forgotten.
		await user.click(within(right).getByRole('button', { name: 'Dock back' }));
		await within(right).findByRole('tab', { name: 'Objects' });
		await user.click(
			within(right).getByRole('button', { name: 'Tear off Objects into its own window' }),
		);
		await waitFor(() =>
			expect(windows.opened.at(-1)).toEqual({
				panel: 'objects',
				asked: { x: 50, y: 60, w: 700, h: 500 },
			}),
		);
	});

	it('keeps the recorded position when the platform reports a size only', async () => {
		const user = userEvent.setup();
		const { docks, windows } = await mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		await user.click(
			within(right).getByRole('button', { name: 'Tear off Objects into its own window' }),
		);
		await within(right).findByRole('tab', { name: 'Objects (own window)' });
		act(() => windows.place('panel-objects-1', { x: 0, y: 0, w: 333, h: 444 }, false));
		await waitFor(
			() => expect(savedWindow(docks, 'objects')).toEqual({ x: 100, y: 120, w: 333, h: 444 }),
			{
				timeout: 3000,
			},
		);
	});

	it('records where a window was when it closed, before the panel comes back', async () => {
		const { docks, windows } = await mount({
			dock: dockWithWindow('history'),
			open: ['panel-history-1'],
		});
		await screen.findByRole('tab', { name: 'History (own window)' });
		act(() => {
			windows.place('panel-history-1', { x: 9, y: 8, w: 410, h: 390 });
			windows.close('panel-history-1');
		});
		await waitFor(() => expect(screen.getByRole('tab', { name: 'History' })).toBeVisible());
		await waitFor(
			() => expect(savedWindow(docks, 'history')).toEqual({ x: 9, y: 8, w: 410, h: 390 }),
			{
				timeout: 3000,
			},
		);
	});

	it('opens a panel the saved workspace has in a window at its recorded place', async () => {
		const dock = dockWithWindow('proposals');
		dock.workspaces.Paint!.panels.proposals!.window = { x: 7, y: 8, w: 450, h: 350 };
		const { windows } = await mount({ dock });
		await waitFor(() =>
			expect(windows.opened).toContainEqual({
				panel: 'proposals',
				asked: { x: 7, y: 8, w: 450, h: 350 },
			}),
		);
	});
});
