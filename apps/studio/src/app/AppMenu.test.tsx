// Tests for the application menu button in the title bar: its rows, activation, keyboard and plain-text state
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
	CommandBridgeContext,
	createCommandBridge,
	type CommandBridge,
} from '../commands/commandBridge';

const openWindow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../services/windowsClient', () => ({ openWindow }));

import { AppMenu } from './AppMenu';

function setup(prepare?: (bridge: CommandBridge) => void, menuBar = false) {
	const bridge = createCommandBridge();
	prepare?.(bridge);
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<AppMenu menuBar={menuBar} />
		</CommandBridgeContext.Provider>,
	);
	return { bridge, button: screen.queryByRole('button', { name: 'Fizz Level Studio' }) };
}

describe('the application menu', () => {
	it('shows the real app mark beside the name', () => {
		const { button } = setup();
		const mark = button!.querySelector('img');
		expect(mark).not.toBeNull();
		expect(mark!.getAttribute('src')).toMatch(/app-mark|^data:image\/svg\+xml/);
	});

	it('opens to File, Edit, View, Window and Help', async () => {
		const user = userEvent.setup();
		const { button } = setup();
		await user.click(button!);
		for (const name of ['File', 'Edit', 'View', 'Window', 'Help']) {
			expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
		}
	});

	it('opens Preferences from the File menu', async () => {
		const user = userEvent.setup();
		const { button } = setup();
		await user.click(button!);
		await user.click(screen.getByRole('menuitem', { name: 'File' }));
		const row = screen.getByRole('menuitem', { name: /Preferences/ });
		expect(row).toHaveTextContent('Ctrl+,');
		await user.click(row);
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
	});

	it('runs a published handler and disables rows nothing can do', async () => {
		const user = userEvent.setup();
		const save = vi.fn();
		const { button } = setup((bridge) => {
			bridge.setFacts({ hasLevel: true });
			bridge.setHandlers({ 'file.save': save });
		});
		await user.click(button!);
		await user.click(screen.getByRole('menuitem', { name: 'File' }));
		expect(screen.getByRole('menuitem', { name: /Quit/ })).not.toHaveAttribute('aria-disabled');
		expect(screen.getByRole('menuitem', { name: /Close level/ })).toHaveAttribute(
			'aria-disabled',
			'true',
		);
		await user.click(screen.getByRole('menuitem', { name: /Save/ }));
		expect(save).toHaveBeenCalledOnce();
	});

	it('follows facts published after it was drawn', async () => {
		const user = userEvent.setup();
		const { bridge, button } = setup((b) => b.setHandlers({ 'edit.undo': () => {} }));
		act(() => bridge.setFacts({ canUndo: true }));
		await user.click(button!);
		await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
		expect(screen.getByRole('menuitem', { name: /Undo/ })).not.toHaveAttribute('aria-disabled');
	});

	it('toggles on F10 and opens the named menu on Alt+W', async () => {
		const { button } = setup();
		fireEvent.keyDown(window, { key: 'F10' });
		expect(await screen.findByRole('menu')).toBeInTheDocument();
		fireEvent.keyDown(window, { key: 'F10' });
		expect(screen.queryByRole('menu')).toBeNull();
		fireEvent.keyDown(window, { key: 'w', altKey: true });
		expect((await screen.findAllByRole('menuitem', { name: /Tear off/ })).length).toBeGreaterThan(
			0,
		);
		fireEvent.keyDown(window, { key: 'h', altKey: true });
		expect(await screen.findByRole('menuitem', { name: /About/ })).toBeInTheDocument();
		expect(button).toBeInTheDocument();
	});

	it('lists the Help and Window rows', async () => {
		const user = userEvent.setup();
		const { button } = setup((bridge) => bridge.setFacts({ editorOpen: true }));
		await user.click(button!);
		await user.click(screen.getByRole('menuitem', { name: 'Help' }));
		await user.click(screen.getByRole('menuitem', { name: 'About Fizz Level Studio' }));
		expect(openWindow).toHaveBeenCalledWith({ kind: 'about' });
	});

	it('is plain text that opens nothing while the menu bar is showing', () => {
		setup(undefined, true);
		expect(screen.queryByRole('button', { name: 'Fizz Level Studio' })).toBeNull();
		expect(screen.getByText('Fizz Level Studio')).toBeInTheDocument();
		fireEvent.keyDown(window, { key: 'F10' });
		fireEvent.keyDown(window, { key: 'w', altKey: true });
		expect(screen.queryByRole('menu')).toBeNull();
	});
});
