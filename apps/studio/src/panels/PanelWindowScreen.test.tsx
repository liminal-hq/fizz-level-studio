// Tests for a torn-off panel's window: the real panel, the level read from Rust, and the bridge to the main window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EditorShare } from './windows/panelBridge';

vi.mock('@tauri-apps/api/window', () => {
	const win = {
		minimize: async () => {},
		toggleMaximize: async () => {},
		close: async () => {},
		startDragging: async () => {},
		setAlwaysOnTop: async () => {},
		isAlwaysOnTop: async () => false,
		isMaximized: async () => false,
		onResized: async () => () => {},
		isFocused: async () => true,
		onFocusChanged: async () => () => {},
	};
	return { getCurrentWindow: () => win };
});

import { levelSnapshot, levelView } from '../test/levelFixtures';
import { fakePanelWindows } from '../test/panelWindowFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { PanelWindowScreen } from './PanelWindowScreen';
import { createBridgeHub } from './windows/fakePanelBridge';
import { createFakeTearoff, type FakeTearoff } from '../services/fakeTearoffClient';
import type { TearoffFeatures } from '../services/tearoffClient';

const share = (overrides: Partial<EditorShare> = {}): EditorShare => ({
	levelId: 'level-1',
	tool: 'paint',
	brush: { group: 'tile', kind: 'wall' },
	spacing: 1,
	ghostsShown: true,
	hiddenLayers: [],
	focus: null,
	selectedThing: null,
	deletedName: null,
	...overrides,
});

/** A panel window with a main window that answers hello as the editor does. */
function mount(
	label: string,
	state: EditorShare | null = share(),
	tearoff: FakeTearoff = createFakeTearoff(),
	snapshot = levelSnapshot(),
) {
	const hub = createBridgeHub();
	const main = hub.bridgeFor('main-1');
	if (state) main.on('hello', (_none, from) => main.send(from, 'editor', state));
	const heard: Array<{ topic: string; payload: unknown }> = [];
	for (const topic of [
		'palette/set',
		'objects/choose',
		'objects/select',
		'inspector/edit',
		'inspector/endStep',
		'script/show',
		'proposals/shown',
		'dockBackTo',
		'dockHint',
	] as const) {
		main.on(topic, (payload) => heard.push({ topic, payload }));
	}
	const levels = new FakeLevelClient(snapshot);
	const windows = fakePanelWindows([label]);
	render(
		<PanelWindowScreen
			windowLabel={label}
			client={windows.client}
			levels={levels}
			bridge={hub.bridgeFor(label)}
			tearoff={tearoff}
		/>,
	);
	return { hub, main, levels, windows, heard, tearoff };
}

describe('a panel window', () => {
	it('waits for the main window, then shows the real panel with the level', async () => {
		mount('panel-script-1');
		expect(await screen.findByRole('textbox', { name: 'Script text' })).toBeVisible();
	});

	it('shows the selected thing in the Inspector’s window, and Show in script goes to the main window', async () => {
		const user = userEvent.setup();
		const thing = {
			kind: 'start' as const,
			name: 'start',
			x: 1,
			y: 1,
			layer: 'objects' as const,
			index: 0,
			line: 2,
		};
		const { heard } = mount('panel-inspector-1', share({ selectedThing: thing }));
		expect(await screen.findByRole('heading', { name: 'Start' })).toBeVisible();
		await user.click(screen.getByRole('button', { name: 'Show in script' }));
		expect(heard).toContainEqual({ topic: 'script/show', payload: { line: 2 } });
	});

	describe('changing the thing from the Inspector’s window', () => {
		const soda = {
			kind: 'item' as const,
			name: 'soda',
			x: 3,
			y: 1,
			layer: 'objects' as const,
			index: 0,
			line: 5,
		};
		const withSoda = levelSnapshot(
			{},
			levelView(12, 8, { items: [{ kind: 'soda', x: 3, y: 1, generator: null, line: 5 }] }),
		);

		it('asks the main window to move it, and shows what the main window answers', async () => {
			const user = userEvent.setup();
			const { main, heard } = mount(
				'panel-inspector-1',
				share({ selectedThing: soda }),
				createFakeTearoff(),
				withSoda,
			);
			main.on('inspector/edit', (message, from) =>
				main.send(from, 'inspector/result', {
					serial: message.serial,
					result: { ok: false, problem: { text: 'No, thank you.' } },
				}),
			);
			await user.click(await screen.findByRole('button', { name: 'Increase x' }));
			expect(await screen.findByRole('alert')).toHaveTextContent('No, thank you.');
			expect(heard).toContainEqual({
				topic: 'inspector/edit',
				payload: {
					serial: 1,
					spec: { op: 'move', x: 4, y: 1 },
					mergeKey: expect.stringMatching(/^thing:item:0:move:/),
				},
			});
		});

		it('tells the main window when the run of changes is over', async () => {
			const user = userEvent.setup();
			const { main, heard } = mount(
				'panel-inspector-1',
				share({ selectedThing: soda }),
				createFakeTearoff(),
				withSoda,
			);
			main.on('inspector/edit', (message, from) =>
				main.send(from, 'inspector/result', { serial: message.serial, result: { ok: true } }),
			);
			await user.click(await screen.findByRole('button', { name: 'Increase x' }));
			await user.click(document.body);
			expect(heard.map((h) => h.topic)).toContain('inspector/endStep');
		});
	});

	it('says nothing is selected in the Inspector’s window while nothing is', async () => {
		mount('panel-inspector-1');
		expect(await screen.findByText(/Nothing selected/)).toBeVisible();
	});

	it('sends the thing chosen in the Objects window as well as its cell', async () => {
		const user = userEvent.setup();
		const { heard } = mount('panel-objects-1');
		await user.click(await screen.findByRole('button', { name: /Ben’s start/ }));
		expect(heard.map((h) => h.topic)).toEqual(['objects/choose', 'objects/select']);
		expect(heard[1]!.payload).toMatchObject({ kind: 'start', index: 0 });
	});

	it('shows the Script window’s one tab, and closing it docks the panel back', async () => {
		const user = userEvent.setup();
		const { windows } = mount('panel-script-1');
		expect(await screen.findByRole('tab', { name: 'test.fizz' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
		await user.click(screen.getByRole('button', { name: 'Close test.fizz' }));
		expect(windows.client.dockBack).toHaveBeenCalledWith('script');
	});

	it('shows no tab in the window of another panel', async () => {
		mount('panel-history-1');
		await screen.findByRole('button', { name: /Undo/ });
		expect(screen.queryByRole('tab')).toBeNull();
	});

	it('says so while the main window has no level open', async () => {
		mount('panel-script-1', share({ levelId: null }));
		expect(
			await screen.findByText('Open a level in the main window to use this panel.'),
		).toBeVisible();
	});

	it('asks again until the main window answers', async () => {
		vi.useFakeTimers();
		try {
			const hub = createBridgeHub();
			const main = hub.bridgeFor('main-1');
			let hellos = 0;
			main.on('hello', (_none, from) => {
				hellos += 1;
				if (hellos > 2) main.send(from, 'editor', share());
			});
			render(
				<PanelWindowScreen
					windowLabel="panel-script-1"
					client={fakePanelWindows().client}
					levels={new FakeLevelClient(levelSnapshot())}
					bridge={hub.bridgeFor('panel-script-1')}
				/>,
			);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(2500);
			});
			expect(hellos).toBeGreaterThanOrEqual(3);
			expect(screen.getByRole('textbox', { name: 'Script text' })).toBeVisible();
		} finally {
			vi.useRealTimers();
		}
	});

	it('closes itself, which docks the panel back, from Dock back', async () => {
		const user = userEvent.setup();
		const { windows } = mount('panel-objects-1');
		await user.click(screen.getByRole('button', { name: 'Dock back' }));
		expect(windows.client.dockBack).toHaveBeenCalledWith('objects');
	});

	it('sends the brush chosen in the Palette window to the main window', async () => {
		const user = userEvent.setup();
		const { heard } = mount('panel-palette-1');
		await screen.findByRole('group', { name: 'Terrain' });
		await user.click(screen.getAllByRole('option', { selected: false })[0]!);
		await waitFor(() => expect(heard.some((h) => h.topic === 'palette/set')).toBe(true));
		expect(heard.find((h) => h.topic === 'palette/set')!.payload).toMatchObject({
			brush: { group: 'tile' },
		});
	});

	it('shows the brush the main window reports and follows its changes', async () => {
		const { main } = mount('panel-palette-1', share({ brush: { group: 'item', kind: 'cookie' } }));
		await screen.findByRole('group', { name: 'Treats' });
		expect(screen.getByRole('option', { name: 'cookie' })).toHaveAttribute('aria-selected', 'true');
		act(() =>
			main.send('panel-palette-1', 'editor', share({ brush: { group: 'enemy', kind: 'bat' } })),
		);
		await waitFor(() =>
			expect(screen.getByRole('option', { name: 'bat' })).toHaveAttribute('aria-selected', 'true'),
		);
	});

	it('sends the object chosen in the Objects window to the main window', async () => {
		const user = userEvent.setup();
		const { heard } = mount('panel-objects-1');
		const start = await screen.findByRole('button', { name: /^Ben’s start/ });
		await user.click(start);
		expect(heard).toContainEqual({ topic: 'objects/choose', payload: { x: 1, y: 1 } });
	});

	it('undoes through Rust and follows the snapshot it gets back', async () => {
		const user = userEvent.setup();
		const { levels } = mount('panel-history-1');
		await screen.findByRole('button', { name: /^Undo/ });
		expect(screen.getByRole('button', { name: /^Undo/ })).toBeDisabled();
		await levels.applyEdit(
			'level-1',
			{ kind: 'paint', tile: 'wall', x: [[1, 1]], y: [[1, 1]] },
			1n,
		);
		levels.emit();
		await waitFor(() => expect(screen.getByRole('button', { name: /^Undo/ })).toBeEnabled());
		await user.click(screen.getByRole('button', { name: /^Undo/ }));
		await waitFor(() => expect(screen.getByRole('button', { name: /^Undo/ })).toBeDisabled());
	});

	it('shows the proposals Rust reports and sends the toggle to the main window', async () => {
		const user = userEvent.setup();
		const { heard } = mount('panel-proposals-1');
		const toggle = await screen.findByRole('switch');
		await user.click(toggle);
		expect(heard).toContainEqual({ topic: 'proposals/shown', payload: { shown: false } });
	});

	it('shows nothing for a panel it does not have', () => {
		const { container } = render(<PanelWindowScreen windowLabel="panel-game-view-1" />);
		expect(container).toBeEmptyDOMElement();
	});
});

const ghostDesktop: Partial<TearoffFeatures> = {
	ghost: true,
	cursorFollow: true,
	hitTest: true,
	windowPosition: true,
};
const down = (el: Element, x: number, y: number) =>
	fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: x, clientY: y });
const move = (x: number, y: number) =>
	fireEvent.pointerMove(document, { pointerId: 1, clientX: x, clientY: y });
const up = (x: number, y: number) =>
	fireEvent.pointerUp(document, { pointerId: 1, clientX: x, clientY: y });
const settle = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe('dragging a panel window back to the main window', () => {
	async function startDrag(label: string, tearoff: FakeTearoff) {
		const view = mount(label, share(), tearoff);
		const handle =
			label === 'panel-script-1'
				? await screen.findByRole('tab', { name: 'test.fizz' })
				: screen.getByRole('heading', { name: 'Objects' });
		await settle();
		return { ...view, handle };
	}

	it('starts from the Script’s tab, with the scriptTab source, and docks where it is let go', async () => {
		const tearoff = createFakeTearoff(ghostDesktop);
		const { handle, heard } = await startDrag('panel-script-1', tearoff);
		tearoff.hit = { window: 'main-1', region: 'group:right:0', x: 5, y: 5 };
		tearoff.dropReport = {
			cursor: { x: 100, y: 100 },
			scaleFactor: 1,
			cursorStale: false,
			hit: { window: 'main-1', region: 'rail:left:0:1', x: 5, y: 5 },
		};
		down(handle, 20, 10);
		move(60, 10);
		await settle();
		expect(tearoff.begun[0]!.payload).toMatchObject({ panel: 'script', source: 'scriptTab' });
		act(() => up(60, 10));
		await settle();
		expect(tearoff.ended).toEqual(['drop']);
		expect(heard).toContainEqual({
			topic: 'dockBackTo',
			payload: { panel: 'script', zone: 'left', group: 0, index: 1 },
		});
	});

	it('tells the main window where the panel would land while the ghost is over a region', async () => {
		const tearoff = createFakeTearoff(ghostDesktop);
		const { handle, heard } = await startDrag('panel-objects-1', tearoff);
		tearoff.hit = { window: 'main-1', region: 'group:right:0', x: 5, y: 5 };
		down(handle, 20, 10);
		move(60, 10);
		await settle(200);
		expect(heard).toContainEqual({
			topic: 'dockHint',
			payload: { panel: 'objects', region: 'group:right:0' },
		});
		expect(tearoff.updates.at(-1)!.label).toMatch(/dock here/);
		tearoff.hit = null;
		await settle(200);
		expect(heard.filter((h) => h.topic === 'dockHint').at(-1)!.payload).toEqual({
			panel: 'objects',
			region: null,
		});
		act(() => up(60, 10));
		await settle();
	});

	it('docks back to where it was when let go over the level', async () => {
		const tearoff = createFakeTearoff(ghostDesktop);
		const { handle, windows } = await startDrag('panel-objects-1', tearoff);
		tearoff.dropReport = {
			cursor: { x: 1, y: 1 },
			scaleFactor: 1,
			cursorStale: false,
			hit: { window: 'main-1', region: 'level', x: 5, y: 5 },
		};
		down(handle, 20, 10);
		move(60, 10);
		await settle();
		act(() => up(60, 10));
		await settle();
		expect(windows.client.dockBack).toHaveBeenCalledWith('objects');
	});

	it('changes nothing when let go over nothing, or over a region of another window', async () => {
		const tearoff = createFakeTearoff(ghostDesktop);
		const { handle, windows, heard } = await startDrag('panel-objects-1', tearoff);
		tearoff.dropReport = {
			cursor: { x: 1, y: 1 },
			scaleFactor: 1,
			cursorStale: false,
			hit: { window: 'main-2', region: 'zone:left', x: 5, y: 5 },
		};
		down(handle, 20, 10);
		move(60, 10);
		await settle();
		act(() => up(60, 10));
		await settle();
		expect(windows.client.dockBack).not.toHaveBeenCalled();
		expect(heard.filter((h) => h.topic === 'dockBackTo')).toEqual([]);
	});

	it('cancels the ghost with Escape and sends no drop', async () => {
		const tearoff = createFakeTearoff(ghostDesktop);
		const { handle, heard } = await startDrag('panel-objects-1', tearoff);
		down(handle, 20, 10);
		move(60, 10);
		await settle();
		act(() => {
			fireEvent.keyDown(document, { key: 'Escape' });
		});
		await settle();
		expect(tearoff.ended).toEqual(['cancel']);
		expect(heard.filter((h) => h.topic === 'dockBackTo')).toEqual([]);
	});

	it('is still a click when the pointer barely moves', async () => {
		const tearoff = createFakeTearoff(ghostDesktop);
		const { handle } = await startDrag('panel-objects-1', tearoff);
		down(handle, 20, 10);
		move(21, 10);
		act(() => up(21, 10));
		await settle();
		expect(tearoff.calls).not.toContain('begin');
	});

	it('on Wayland has the compositor drag this window, with its own label', async () => {
		const tearoff = createFakeTearoff({ toplevelDrag: true });
		const { handle } = await startDrag('panel-objects-1', tearoff);
		down(handle, 20, 10);
		move(60, 10);
		await settle();
		expect(tearoff.toplevel[0]).toMatchObject({
			label: 'panel-objects-1',
			payload: { panel: 'objects', source: 'header' },
		});
		expect(tearoff.begun).toEqual([]);
	});

	it('starts nothing where the desktop has no route, and Dock back is still there', async () => {
		const tearoff = createFakeTearoff();
		const { handle } = await startDrag('panel-objects-1', tearoff);
		down(handle, 20, 10);
		move(60, 10);
		await settle();
		act(() => up(60, 10));
		expect(tearoff.calls).toEqual([]);
		expect(screen.getByRole('button', { name: 'Dock back' })).toBeInTheDocument();
	});
});
