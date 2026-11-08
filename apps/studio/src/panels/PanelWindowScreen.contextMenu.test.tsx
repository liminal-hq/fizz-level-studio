// Tests for the right-click menus in a torn-off panel's window: Dock back, the text field menu, and nothing else
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import { ContextMenuHost } from '../app/ContextMenuHost';
import { createCommandBridge } from '../commands/commandBridge';
import { createFakeTearoff } from '../services/fakeTearoffClient';
import { levelSnapshot } from '../test/levelFixtures';
import { fakePanelWindows } from '../test/panelWindowFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { PanelWindowScreen } from './PanelWindowScreen';
import { createBridgeHub } from './windows/fakePanelBridge';

const share: EditorShare = {
	levelId: 'level-1',
	tool: 'paint',
	brush: { group: 'tile', kind: 'wall' },
	spacing: 1,
	ghostsShown: true,
	hiddenLayers: [],
	focus: null,
	selectedThing: null,
	deletedName: null,
};

function mount(label: string) {
	const hub = createBridgeHub();
	const main = hub.bridgeFor('main-1');
	main.on('hello', (_none, from) => main.send(from, 'editor', share));
	const windows = fakePanelWindows([label]);
	render(
		<ContextMenuHost bridge={createCommandBridge()} nativeMenu={{ allowed: async () => false }}>
			<PanelWindowScreen
				windowLabel={label}
				client={windows.client}
				levels={new FakeLevelClient(levelSnapshot())}
				bridge={hub.bridgeFor(label)}
				tearoff={createFakeTearoff()}
			/>
		</ContextMenuHost>,
	);
	return windows;
}

const rows = () => [...screen.getByRole('menu').querySelectorAll('[role^="menuitem"] .label')];

describe('a panel window', () => {
	it('offers Dock back on its header, and nothing the window cannot do', async () => {
		const windows = mount('panel-history-1');
		const title = await screen.findByRole('heading', { name: 'History' });
		expect(fireEvent.contextMenu(title)).toBe(false);
		await screen.findByRole('menu', { name: 'History menu' });
		expect(rows().map((row) => row.textContent)).toEqual(['Dock back']);
		fireEvent.click(rows()[0]!);
		await waitFor(() => expect(windows.client.dockBack).toHaveBeenCalledWith('history'));
	});

	it('offers the script tab’s own menu in the Script panel’s window', async () => {
		const windows = mount('panel-script-1');
		const tab = await screen.findByRole('tab');
		fireEvent.contextMenu(tab);
		await screen.findByRole('menu', { name: 'Script tab menu' });
		expect(rows().map((row) => row.textContent)).toEqual([
			'Close the level script tab',
			'Dock back',
		]);
		fireEvent.click(rows()[1]!);
		await waitFor(() => expect(windows.client.dockBack).toHaveBeenCalledWith('script'));
	});

	it('blocks the native menu where it has no menu of its own', async () => {
		mount('panel-history-1');
		await screen.findByRole('heading', { name: 'History' });
		expect(fireEvent.contextMenu(document.body)).toBe(false);
		await act(async () => {});
		expect(screen.queryByRole('menu')).toBeNull();
	});
});
