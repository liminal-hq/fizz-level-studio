// Tests for a torn-off panel's window: the real panel, the level read from Rust, and the bridge to the main window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, waitFor } from '@testing-library/react';
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

import { levelSnapshot } from '../test/levelFixtures';
import { fakePanelWindows } from '../test/panelWindowFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { PanelWindowScreen } from './PanelWindowScreen';
import { createBridgeHub } from './windows/fakePanelBridge';

const share = (overrides: Partial<EditorShare> = {}): EditorShare => ({
	levelId: 'level-1',
	tool: 'paint',
	brush: { group: 'tile', kind: 'wall' },
	spacing: 1,
	ghostsShown: true,
	focus: null,
	...overrides,
});

/** A panel window with a main window that answers hello as the editor does. */
function mount(label: string, state: EditorShare | null = share()) {
	const hub = createBridgeHub();
	const main = hub.bridgeFor('main-1');
	if (state) main.on('hello', (_none, from) => main.send(from, 'editor', state));
	const heard: Array<{ topic: string; payload: unknown }> = [];
	for (const topic of [
		'palette/set',
		'objects/choose',
		'script/show',
		'proposals/shown',
	] as const) {
		main.on(topic, (payload) => heard.push({ topic, payload }));
	}
	const snapshot = levelSnapshot();
	const levels = new FakeLevelClient(snapshot);
	const windows = fakePanelWindows([label]);
	render(
		<PanelWindowScreen
			windowLabel={label}
			client={windows.client}
			levels={levels}
			bridge={hub.bridgeFor(label)}
		/>,
	);
	return { hub, main, levels, windows, heard };
}

describe('a panel window', () => {
	it('waits for the main window, then shows the real panel with the level', async () => {
		mount('panel-script-1');
		expect(await screen.findByRole('textbox', { name: 'Script text' })).toBeVisible();
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
