// Tests for tearing the Script panel off into its own window and docking it back
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PanelWindowClient } from '../services/panelWindowClient';

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

import { PanelWindowScreen } from './PanelWindowScreen';
import { ScriptPanel } from './ScriptPanel';
import { TornOffNotice } from './TornOffNotice';
import { usePanelDock } from './usePanelDock';

/** A panel client that keeps its own list of open windows and lets a test close one. */
function fakeClient(initiallyOpen: string[] = []) {
	const open = new Set(initiallyOpen);
	let closed: (label: string) => void = () => {};
	const client: PanelWindowClient = {
		open: async () => [...open],
		tearOff: vi.fn(async (panel: string) => void open.add(`panel-${panel}-1`)),
		dockBack: vi.fn(async (panel: string) => void open.delete(`panel-${panel}-1`)),
		onClosed: (listener) => {
			closed = listener;
			return () => {};
		},
	};
	return { client, close: (label: string) => closed(label) };
}

/** The main window's Script panel as the editor wires it. */
function Harness({ client }: { client: PanelWindowClient }) {
	const dock = usePanelDock('script', client);
	return dock.tornOff ? (
		<TornOffNotice messageId="panel.scriptTornOff" onDockBack={dock.dockBack} />
	) : (
		<ScriptPanel text="a\n" diagnostics={[]} onTearOff={dock.tearOff} />
	);
}

describe('tearing the Script panel off', () => {
	it('opens the panel window, shows a notice in its place, and docks back', async () => {
		const user = userEvent.setup();
		const fake = fakeClient();
		render(<Harness client={fake.client} />);

		await user.click(screen.getByRole('button', { name: 'Tear off' }));
		expect(fake.client.tearOff).toHaveBeenCalledWith('script');
		expect(await screen.findByText('The Script panel is open in its own window.')).toBeVisible();
		expect(screen.queryByRole('textbox', { name: 'Script text' })).toBeNull();

		await user.click(screen.getByRole('button', { name: 'Dock back' }));
		expect(fake.client.dockBack).toHaveBeenCalledWith('script');
		expect(await screen.findByRole('textbox', { name: 'Script text' })).toBeVisible();
	});

	it('docks back by itself when the panel window closes some other way', async () => {
		const fake = fakeClient(['panel-script-1']);
		render(<Harness client={fake.client} />);
		expect(await screen.findByText('The Script panel is open in its own window.')).toBeVisible();

		act(() => fake.close('panel-script-1'));
		await waitFor(() => expect(screen.getByRole('textbox', { name: 'Script text' })).toBeVisible());
	});

	it('ignores another panel closing, and a window that fails to open', async () => {
		const user = userEvent.setup();
		const fake = fakeClient();
		fake.client.tearOff = vi.fn(async () => {
			throw new Error('refused');
		});
		render(<Harness client={fake.client} />);
		await user.click(screen.getByRole('button', { name: 'Tear off' }));
		act(() => fake.close('panel-game-view-1'));
		expect(screen.getByRole('textbox', { name: 'Script text' })).toBeVisible();
	});
});

describe('the panel window', () => {
	it('shows the panel and a Dock back button that closes the window', async () => {
		const user = userEvent.setup();
		const fake = fakeClient(['panel-script-1']);
		render(<PanelWindowScreen windowLabel="panel-script-1" client={fake.client} />);
		expect(screen.getByText('The script will appear here.')).toBeVisible();
		await user.click(screen.getByRole('button', { name: 'Dock back' }));
		expect(fake.client.dockBack).toHaveBeenCalledWith('script');
	});

	it('shows nothing for a panel it has no screen for', () => {
		const { container } = render(<PanelWindowScreen windowLabel="panel-game-view-1" />);
		expect(container).toBeEmptyDOMElement();
	});
});
