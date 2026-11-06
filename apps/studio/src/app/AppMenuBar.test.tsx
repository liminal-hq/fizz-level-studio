// Tests for the menu bar under the title bar: its menus, activation and keyboard
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
	CommandBridgeContext,
	createCommandBridge,
	type CommandFacts,
	type CommandHandlers,
} from '../commands/commandBridge';

const openWindow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../services/windowsClient', () => ({ openWindow }));

import { AppMenu } from './AppMenu';
import { AppMenuBar } from './AppMenuBar';

function setup(facts: Partial<CommandFacts> = {}, handlers: CommandHandlers = {}) {
	const bridge = createCommandBridge();
	const save = vi.fn();
	bridge.setFacts({ hasLevel: true, editorOpen: true, ...facts });
	bridge.setHandlers({ 'file.save': save, ...handlers });
	render(
		<CommandBridgeContext.Provider value={bridge}>
			<AppMenu menuBar />
			<AppMenuBar />
		</CommandBridgeContext.Provider>,
	);
	return { save, bar: screen.getByRole('menubar', { name: 'Application menu' }) };
}

describe('the application menu bar', () => {
	it('lists File, Edit, View, Window and Help', () => {
		setup();
		for (const name of ['File', 'Edit', 'View', 'Window', 'Help']) {
			expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
		}
	});

	it('leaves the title bar button as plain text that opens nothing', async () => {
		setup();
		expect(screen.queryByRole('button', { name: 'Fizz Level Studio' })).toBeNull();
		expect(screen.getByText('Fizz Level Studio')).toBeInTheDocument();
		fireEvent.keyDown(window, { key: 'F10' });
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('runs a row it opens', async () => {
		const user = userEvent.setup();
		const { save } = setup();
		await user.click(screen.getByRole('menuitem', { name: 'File' }));
		await user.click(screen.getByRole('menuitem', { name: /Save/ }));
		expect(save).toHaveBeenCalledOnce();
	});

	it('opens Preferences from File and shows its shortcut', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole('menuitem', { name: 'File' }));
		const row = screen.getByRole('menuitem', { name: /Preferences/ });
		expect(row).toHaveTextContent('Ctrl+,');
		await user.click(row);
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
	});

	it('opens a menu with its Alt mnemonic and moves between menus with the arrows', async () => {
		// With Undo able to run, focus starts on it; a disabled Undo would leave it on Undo history,
		// whose submenu the right arrow opens.
		setup({ canUndo: true }, { 'edit.undo': () => {} });
		fireEvent.keyDown(window, { key: 'e', altKey: true });
		expect(await screen.findByRole('menuitem', { name: /^Undo(?! history)/ })).toBeInTheDocument();
		fireEvent.keyDown(screen.getByRole('menuitem', { name: /^Undo(?! history)/ }), {
			key: 'ArrowRight',
		});
		expect(await screen.findByRole('menuitemcheckbox', { name: /Palette/ })).toBeInTheDocument();
	});

	it('opens Help with Alt+H and runs About', async () => {
		setup();
		fireEvent.keyDown(window, { key: 'h', altKey: true });
		await userEvent.click(
			await screen.findByRole('menuitem', { name: 'About Fizz Level Studio…' }),
		);
		expect(openWindow).toHaveBeenCalledWith({ kind: 'about' });
	});
});
