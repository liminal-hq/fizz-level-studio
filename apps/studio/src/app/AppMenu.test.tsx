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
	NO_FACTS,
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

	it('opens to one flat list, with no File, Edit or View headings', async () => {
		const user = userEvent.setup();
		const { button } = setup((bridge) => bridge.setFacts({ editorOpen: true, hasLevel: true }));
		await user.click(button!);
		const names = screen.getAllByRole('menuitem').map((row) => row.textContent ?? '');
		const starts = (label: string) => names.findIndex((name) => name.startsWith(label));
		for (const label of [
			'New level',
			'Open level',
			'Save',
			'Close level',
			'Undo',
			'Redo',
			'Undo history',
			'Panels',
			'Window',
			'Command palette',
			'Preferences',
			'Help',
			'Keyboard shortcuts',
			'About',
			'Quit',
		]) {
			expect(starts(label), label).toBeGreaterThanOrEqual(0);
		}
		for (const heading of ['File', 'Edit', 'View']) {
			expect(
				names.some((name) => name === heading),
				heading,
			).toBe(false);
		}
		// The design's order, and no Edit or Zoom rows.
		expect(starts('New level')).toBeLessThan(starts('Save'));
		expect(starts('Save')).toBeLessThan(starts('Undo'));
		expect(starts('Undo history')).toBeLessThan(starts('Panels'));
		expect(starts('Command palette')).toBeLessThan(starts('Preferences'));
		expect(starts('About')).toBeLessThan(starts('Quit'));
		for (const absent of ['Zoom', 'Fit', 'Cut', 'Copy', 'Paste', 'Go to line']) {
			expect(
				names.some((name) => name.startsWith(absent)),
				absent,
			).toBe(false);
		}
	});

	it('opens Preferences from its row, with its keys', async () => {
		const user = userEvent.setup();
		const { button } = setup();
		await user.click(button!);
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
		expect(screen.getByRole('menuitem', { name: /^Undo(?! history)/ })).not.toHaveAttribute(
			'aria-disabled',
		);
	});

	it('toggles on F10, and has no letter keys because it names no menus', async () => {
		const { button } = setup((bridge) => bridge.setFacts({ editorOpen: true }));
		fireEvent.keyDown(window, { key: 'F10' });
		expect(await screen.findByRole('menu')).toBeInTheDocument();
		fireEvent.keyDown(window, { key: 'F10' });
		expect(screen.queryByRole('menu')).toBeNull();
		fireEvent.keyDown(window, { key: 'w', altKey: true });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(button).toBeInTheDocument();
	});

	it('opens About from its row', async () => {
		const user = userEvent.setup();
		const { button } = setup((bridge) => bridge.setFacts({ editorOpen: true }));
		await user.click(button!);
		await user.click(screen.getByRole('menuitem', { name: 'About Fizz Level Studio…' }));
		expect(openWindow).toHaveBeenCalledWith({ kind: 'about' });
	});

	it('has a Menu bar switch that is checked while the bar is on, and runs its handler', async () => {
		const user = userEvent.setup();
		const toggle = vi.fn();
		const { button } = setup((bridge) => {
			bridge.setFacts({ menuBar: false });
			bridge.setHandlers({ 'view.menuBar': toggle });
		});
		await user.click(button!);
		const row = screen.getByRole('menuitemcheckbox', { name: 'Menu bar' });
		expect(row).toHaveAttribute('aria-checked', 'false');
		await user.click(row);
		expect(toggle).toHaveBeenCalledOnce();
	});

	it('is plain text that opens nothing while the menu bar is showing', () => {
		setup(undefined, true);
		expect(screen.queryByRole('button', { name: 'Fizz Level Studio' })).toBeNull();
		expect(screen.getByText('Fizz Level Studio')).toBeInTheDocument();
		fireEvent.keyDown(window, { key: 'F10' });
		fireEvent.keyDown(window, { key: 'w', altKey: true });
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('lists the panels with ticks, and the Window submenu with the workspaces', async () => {
		const user = userEvent.setup();
		const { button } = setup((bridge) =>
			bridge.setFacts({
				editorOpen: true,
				hasLevel: true,
				panels: { ...NO_FACTS.panels, script: true },
				workspace: { active: 'Paint', names: ['Paint', 'Review', 'Script'] },
			}),
		);
		await user.click(button!);
		await user.click(screen.getByRole('menuitem', { name: 'Panels' }));
		const script = screen.getByRole('menuitemcheckbox', { name: 'Script' });
		expect(script).toHaveAttribute('aria-checked', 'true');
		expect(script.querySelector('svg')).not.toBeNull();
		expect(screen.getByRole('menuitemcheckbox', { name: 'Palette' })).toHaveAttribute(
			'aria-checked',
			'false',
		);
		await user.click(screen.getByRole('menuitem', { name: 'Window' }));
		await user.click(screen.getByRole('menuitem', { name: 'Workspace' }));
		expect(screen.getByRole('menuitemcheckbox', { name: 'Paint' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	it('draws an icon in every top row’s slot', async () => {
		const user = userEvent.setup();
		const { button } = setup((bridge) => bridge.setFacts({ editorOpen: true, hasLevel: true }));
		await user.click(button!);
		for (const row of screen.getAllByRole('menuitem')) {
			expect(row.querySelector('svg'), row.textContent ?? '').not.toBeNull();
		}
	});

	it('leaves the Window and Panels rows out on the start screen', async () => {
		const user = userEvent.setup();
		const { button } = setup();
		await user.click(button!);
		expect(screen.getByRole('menuitem', { name: /New level/ })).toBeInTheDocument();
		expect(screen.queryByRole('menuitem', { name: 'Window' })).toBeNull();
		expect(screen.queryByRole('menuitem', { name: 'Panels' })).toBeNull();
	});
});
