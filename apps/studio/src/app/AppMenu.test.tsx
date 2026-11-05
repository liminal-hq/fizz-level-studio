// Tests for the application menu button in the title bar: its rows, activation and keyboard
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

function setup(prepare?: (bridge: CommandBridge) => void) {
	const bridge = createCommandBridge();
	prepare?.(bridge);
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<AppMenu />
		</CommandBridgeContext.Provider>,
	);
	return { bridge, button: screen.getByRole('button', { name: 'Fizz Level Studio' }) };
}

describe('the application menu', () => {
	it('shows the real app mark beside the name', () => {
		const { button } = setup();
		const mark = button.querySelector('img');
		expect(mark).not.toBeNull();
		expect(mark!.getAttribute('src')).toMatch(/app-mark|^data:image\/svg\+xml/);
	});

	it('opens to File, Edit, View and Window', async () => {
		const user = userEvent.setup();
		const { button } = setup();
		await user.click(button);
		for (const name of ['File', 'Edit', 'View', 'Window']) {
			expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
		}
	});

	it('opens Preferences from the Window menu', async () => {
		const user = userEvent.setup();
		const { button } = setup();
		await user.click(button);
		await user.click(screen.getByRole('menuitem', { name: 'Window' }));
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
		await user.click(button);
		await user.click(screen.getByRole('menuitem', { name: 'File' }));
		expect(screen.getByRole('menuitem', { name: /Quit/ })).toHaveAttribute('aria-disabled', 'true');
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
		await user.click(button);
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
		expect(await screen.findByRole('menuitem', { name: /About/ })).toBeInTheDocument();
		expect(button).toBeInTheDocument();
	});
});
