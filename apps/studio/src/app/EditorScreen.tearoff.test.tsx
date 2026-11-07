// Tests for dragging a panel out into a window and back, from the editor's side, over a fake plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A real drag across windows cannot be driven here (the pointer, the ghost and the compositor are
// native), so these tests play the plugin's side: the features it reports, the drop report it gives,
// the events it sends. What they prove is the decision logic and the wiring in the editor.

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandBridgeContext, createCommandBridge } from '../commands/commandBridge';
import { sendToWindow } from '../panels/dock/dockLayout';
import { createBridgeHub } from '../panels/windows/fakePanelBridge';
import {
	fakeDockClient,
	findRailEntry,
	openDock,
	queryRailEntry,
	railEntry,
} from '../test/dockFixtures';
import { levelSnapshot } from '../test/levelFixtures';
import { fakePanelWindows } from '../test/panelWindowFixtures';
import { createFakeTearoff, type FakeTearoff } from '../services/fakeTearoffClient';
import type { TearoffFeatures } from '../services/tearoffClient';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

function box(l: number, t: number, w: number, h: number): DOMRect {
	return {
		left: l,
		top: t,
		right: l + w,
		bottom: t + h,
		x: l,
		y: t,
		width: w,
		height: h,
	} as DOMRect;
}

afterEach(() => vi.restoreAllMocks());

async function mount(features: Partial<TearoffFeatures>, dock = openDock()) {
	const snapshot = levelSnapshot();
	const client = new FakeLevelClient(snapshot);
	const docks = fakeDockClient(dock);
	const windows = fakePanelWindows();
	const bridge = createCommandBridge();
	const hub = createBridgeHub();
	const tearoff: FakeTearoff = createFakeTearoff(features);
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<EditorScreen
				snapshot={snapshot}
				client={client}
				docks={docks}
				panelWindows={windows.client}
				panelBridge={hub.bridgeFor('main-1')}
				tearoff={tearoff}
			/>
		</CommandBridgeContext.Provider>,
	);
	await screen.findByRole('region', { name: 'Left dock' });
	// Let the plugin's answer about its features arrive.
	await act(async () => {});
	return { windows, hub, tearoff, docks };
}

const ghostDesktop = { ghost: true, cursorFollow: true, hitTest: true, windowPosition: true };
const down = (el: Element, x: number, y: number) =>
	fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: x, clientY: y });
const move = (x: number, y: number) =>
	fireEvent.pointerMove(document, { pointerId: 1, clientX: x, clientY: y });
const up = (x: number, y: number) =>
	fireEvent.pointerUp(document, { pointerId: 1, clientX: x, clientY: y });

/** The header of the dock group showing `title`. */
function headerOf(region: string, title: string): HTMLElement {
	return within(screen.getByRole('region', { name: region }))
		.getByRole('heading', { name: title })
		.closest<HTMLElement>('[data-strip]')!;
}

/** What the dock last announced to a screen reader. */
const live = () =>
	[...document.querySelectorAll('[role="status"]')].map((el) => el.textContent).join(' ');

describe('dragging a panel out of the window', () => {
	it('tears a docked panel off at the drop point from its header grip (ghost)', async () => {
		const { tearoff, windows } = await mount(ghostDesktop);
		tearoff.dropReport = {
			cursor: { x: 2300, y: 400 },
			scaleFactor: 1,
			cursorStale: false,
			hit: null,
		};
		const header = headerOf('Left dock', 'Palette');
		down(header, 100, 10);
		act(() => {
			move(60, 40);
			move(-30, 40);
		});
		await waitFor(() => expect(tearoff.begun).toHaveLength(1));
		expect(tearoff.begun[0]!.payload).toMatchObject({
			panel: 'palette',
			source: 'header',
			title: 'Palette',
		});
		act(() => up(-60, 40));
		await waitFor(() => expect(windows.client.tearOff).toHaveBeenCalled());
		const [panel, asked] = (windows.client.tearOff as ReturnType<typeof vi.fn>).mock.calls[0]!;
		expect(panel).toBe('palette');
		// The window's top-left is the cursor less where the card was held, in physical pixels.
		expect(asked).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
		expect((asked as { x: number }).x).toBeGreaterThan(2000);
		await waitFor(() => expect(live()).toMatch(/Palette is now in a window of its own/));
	});

	it('does the same from a rail entry', async () => {
		const { tearoff, windows } = await mount(ghostDesktop);
		tearoff.dropReport = {
			cursor: { x: 2000, y: 300 },
			scaleFactor: 1,
			cursorStale: false,
			hit: null,
		};
		down(railEntry('Objects', 'right'), 1000, 60);
		act(() => {
			move(960, 60);
			move(1200, 60);
		});
		await waitFor(() => expect(tearoff.begun[0]?.payload.panel).toBe('objects'));
		expect(tearoff.begun[0]!.payload.source).toBe('tab');
		act(() => up(1200, 60));
		await waitFor(() =>
			expect(windows.client.tearOff).toHaveBeenCalledWith('objects', expect.anything()),
		);
	});

	it('tears the Script off from its tab, with the scriptTab source', async () => {
		const { tearoff, windows } = await mount(ghostDesktop);
		const tab = (await screen.findAllByRole('tab'))[0]!;
		tearoff.dropReport = {
			cursor: { x: 700, y: 2000 },
			scaleFactor: 1,
			cursorStale: false,
			hit: null,
		};
		down(tab, 300, 700);
		act(() => {
			move(300, 740);
			move(300, 1500);
		});
		await waitFor(() =>
			expect(tearoff.begun[0]?.payload).toMatchObject({ panel: 'script', source: 'scriptTab' }),
		);
		act(() => up(300, 1500));
		await waitFor(() =>
			expect(windows.client.tearOff).toHaveBeenCalledWith('script', expect.anything()),
		);
	});

	it('cancels the ghost and tears nothing off when the drag is cancelled with Escape', async () => {
		const { tearoff, windows } = await mount(ghostDesktop);
		down(headerOf('Left dock', 'Palette'), 100, 10);
		act(() => {
			move(60, 40);
			move(-30, 40);
		});
		await waitFor(() => expect(tearoff.begun).toHaveLength(1));
		act(() => {
			fireEvent.keyDown(document, { key: 'Escape' });
		});
		await waitFor(() => expect(tearoff.ended).toEqual(['cancel']));
		expect(windows.client.tearOff).not.toHaveBeenCalled();
		expect(live()).toMatch(/Move cancelled/);
	});

	it('on Wayland opens the window hidden and has the compositor drag it, leaving the panel away', async () => {
		const { tearoff, windows } = await mount({ toplevelDrag: true });
		down(headerOf('Left dock', 'Palette'), 100, 10);
		act(() => {
			move(60, 40);
			move(-30, 40);
		});
		await waitFor(() => expect(tearoff.toplevel).toHaveLength(1));
		expect(windows.client.tearOff).toHaveBeenCalledWith('palette', null, { hidden: true });
		expect(tearoff.toplevel[0]).toMatchObject({
			label: 'panel-palette-1',
			payload: { panel: 'palette' },
		});
		expect(tearoff.begun).toEqual([]);
		// The panel is away at once: its rail entry says so.
		expect(await findRailEntry('Palette (own window)')).toBeInTheDocument();
	});

	it('on Wayland puts the panel back when the compositor cancels the drag', async () => {
		const { tearoff, windows } = await mount({ toplevelDrag: true });
		down(headerOf('Left dock', 'Palette'), 100, 10);
		act(() => {
			move(60, 40);
			move(-30, 40);
		});
		await waitFor(() => expect(tearoff.toplevel).toHaveLength(1));
		act(() =>
			tearoff.emit.toplevelEnded({
				seq: 1,
				window: 'panel-palette-1',
				source: 'main-1',
				outcome: 'cancelled',
				target: null,
				region: null,
				payload: null,
				reason: null,
			}),
		);
		await waitFor(() => expect(windows.client.dockBack).toHaveBeenCalledWith('palette'));
		await waitFor(() => expect(queryRailEntry('Palette (own window)')).toBeNull());
	});

	it('says why, and leaves the panel menu, where the desktop cannot drag a window', async () => {
		const { tearoff, windows } = await mount({});
		down(headerOf('Left dock', 'Palette'), 100, 10);
		act(() => {
			move(60, 40);
			move(-30, 40);
		});
		await waitFor(() => expect(live()).toMatch(/Tear off/));
		expect(tearoff.calls).not.toContain('begin');
		expect(windows.client.tearOff).not.toHaveBeenCalled();
		// The drag is over: the pointer moving on does nothing.
		act(() => up(-60, 40));
		expect(windows.client.tearOff).not.toHaveBeenCalled();
		expect(
			within(screen.getByRole('region', { name: 'Left dock' })).getByRole('button', {
				name: 'Palette menu',
			}),
		).toBeInTheDocument();
	});
});

describe('the drop regions the main window registers', () => {
	it('names each dock, group, rail and rail entry once the plugin can hit-test', async () => {
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
			this: Element,
		) {
			return box(0, 0, 50, 50);
		});
		const { tearoff } = await mount(ghostDesktop);
		await waitFor(() => expect(tearoff.regions.length).toBeGreaterThan(0));
		const ids = tearoff.regions.at(-1)!.map((region) => region.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				'zone:left',
				'group:left:0',
				'rail:left',
				'rail:left:0:0',
				'rail:left:0:1',
				'level',
			]),
		);
	});

	it('registers none where nothing can hit-test or drag a window', async () => {
		const { tearoff } = await mount({});
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(tearoff.regions).toEqual([]);
	});
});

describe('dragging a panel back from its own window', () => {
	const torn = () => {
		const dock = openDock();
		return { ...dock, workspaces: { Paint: sendToWindow(dock.workspaces.Paint!, 'layers') } };
	};

	it('docks it where the panel window let go, and says so and marks it', async () => {
		const { hub } = await mount(ghostDesktop, torn());
		const panel = hub.bridgeFor('panel-layers-1');
		await findRailEntry('Layers (own window)');
		act(() =>
			panel.send('main-1', 'dockBackTo', { panel: 'layers', zone: 'right', group: 0, index: 1 }),
		);
		await waitFor(() => expect(live()).toMatch(/Layers moved to the Right dock/));
		const right = within(screen.getByRole('group', { name: 'Right rail' }));
		const names = right.getAllByRole('button').map((b) => b.getAttribute('title') ?? b.textContent);
		expect(names.slice(0, 2).join(' ')).toMatch(/Objects[\s\S]*Layers/);
		// The entry is marked as landed for a moment.
		expect(railEntry('Layers', 'right')).toHaveAttribute('data-landed');
	});

	it('ignores a message that is not a place a panel can land', async () => {
		const { hub, docks } = await mount(ghostDesktop, torn());
		const panel = hub.bridgeFor('panel-layers-1');
		await findRailEntry('Layers (own window)');
		act(() => {
			panel.send('main-1', 'dockBackTo', { panel: 'nope', zone: 'right', group: 0, index: 0 });
			panel.send('main-1', 'dockBackTo', {
				panel: 'layers',
				zone: 'top' as never,
				group: 0,
				index: 0,
			});
			panel.send('main-1', 'dockBackTo', { panel: 'layers', zone: 'left', group: -1, index: 0 });
		});
		expect(queryRailEntry('Layers (own window)')).not.toBeNull();
		expect(docks.save).not.toHaveBeenCalled();
	});

	it('shows where the panel would land while its window hovers over a region, and stops after', async () => {
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
			this: Element,
		) {
			return box(0, 0, 50, 50);
		});
		const { hub, tearoff } = await mount(ghostDesktop, torn());
		await waitFor(() => expect(tearoff.regions.length).toBeGreaterThan(0));
		const panel = hub.bridgeFor('panel-layers-1');
		const shell = () => document.querySelector('[data-level]')!.parentElement!;
		act(() => panel.send('main-1', 'dockHint', { panel: 'layers', region: 'group:left:0' }));
		await waitFor(() => expect(shell()).toHaveAttribute('data-dragging'));
		act(() => panel.send('main-1', 'dockHint', { panel: 'layers', region: null }));
		await waitFor(() => expect(shell()).not.toHaveAttribute('data-dragging'));
	});

	it('on Wayland docks a panel the compositor dropped on a region of this window', async () => {
		const { tearoff } = await mount({ toplevelDrag: true }, torn());
		await findRailEntry('Layers (own window)');
		act(() =>
			tearoff.emit.dropped({
				window: 'main-1',
				payload: { kind: 'panel', panel: 'layers', source: 'header', title: 'Layers' },
				x: 10,
				y: 10,
				region: 'zone:bottom',
			}),
		);
		await waitFor(() => expect(live()).toMatch(/Layers moved to the Bottom dock/));
	});

	it('on Wayland ignores a drop over no region, and a payload that is not a panel', async () => {
		const { tearoff } = await mount({ toplevelDrag: true }, torn());
		await findRailEntry('Layers (own window)');
		act(() => {
			tearoff.emit.dropped({
				window: 'main-1',
				payload: { kind: 'panel', panel: 'layers' },
				x: 1,
				y: 1,
				region: null,
			});
			tearoff.emit.dropped({
				window: 'main-1',
				payload: { kind: 'tab' },
				x: 1,
				y: 1,
				region: 'zone:left',
			});
		});
		expect(queryRailEntry('Layers (own window)')).not.toBeNull();
	});
});
