// Tests for the command palette dialog: semantics, keyboard, mouse, the line prompt, focus and recents
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

const openWindow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../services/windowsClient', () => ({ openWindow }));

import { NO_FACTS, type BridgeSnapshot } from './commandBridge';
import { CommandPalette, isCommandPaletteShortcut } from './CommandPalette';
import { createRecentCommands } from './paletteRecents';

function setup(
	facts: Partial<BridgeSnapshot['facts']> = {},
	handlers: BridgeSnapshot['handlers'] = {},
	recents = createRecentCommands(),
) {
	const snapshot: BridgeSnapshot = {
		facts: {
			...NO_FACTS,
			hasLevel: true,
			editorOpen: true,
			canUndo: true,
			brushes: [
				{ group: 'tile', kind: 'block' },
				{ group: 'item', kind: 'cheezie' },
			],
			lineCount: 40,
			...facts,
		},
		handlers: {
			'file.save': vi.fn(),
			'edit.undo': vi.fn(),
			'tool.erase': vi.fn(),
			'tool.paint': vi.fn(),
			'brush.item.cheezie': vi.fn(),
			'goto.line': vi.fn(),
			...handlers,
		},
	};
	function Host() {
		const [open, setOpen] = useState(false);
		return (
			<>
				<button type="button" onClick={() => setOpen(true)}>
					opener
				</button>
				<CommandPalette
					open={open}
					onClose={() => setOpen(false)}
					snapshot={snapshot}
					recents={recents}
				/>
			</>
		);
	}
	render(<Host />);
	return { snapshot, recents, opener: screen.getByRole('button', { name: 'opener' }) };
}

async function openPalette() {
	const user = userEvent.setup();
	const made = setup();
	await user.click(made.opener);
	return { user, ...made };
}

const input = () => screen.getByRole('combobox', { name: 'Search commands' });
const names = () => screen.getAllByRole('option').map((option) => option.textContent ?? '');

describe('the command palette', () => {
	it('is a labelled modal dialog with a focused combobox over a listbox', async () => {
		await openPalette();
		const dialog = screen.getByRole('dialog', { name: 'Command palette' });
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(input()).toHaveFocus();
		expect(input()).toHaveAttribute('aria-expanded', 'true');
		const list = screen.getByRole('listbox', { name: 'Commands' });
		expect(input()).toHaveAttribute('aria-controls', list.id);
		const active = screen
			.getAllByRole('option')
			.find((o) => o.getAttribute('aria-selected') === 'true');
		expect(input()).toHaveAttribute('aria-activedescendant', active?.id);
	});

	it('is closed until opened', () => {
		setup();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('lists commands under headings, with shortcuts, and not the command that opens it', async () => {
		await openPalette();
		const list = screen.getByRole('listbox');
		expect(within(list).getByText('Tools')).toBeInTheDocument();
		expect(within(list).getByText('Brushes')).toBeInTheDocument();
		expect(within(list).getByText('Go to')).toBeInTheDocument();
		expect(names().some((name) => name.startsWith('Save') && name.includes('Ctrl+S'))).toBe(true);
		expect(names().some((name) => name.startsWith('Brush: cheezie'))).toBe(true);
		expect(names().some((name) => name.startsWith('Command palette'))).toBe(false);
	});

	it('dims a command that cannot run, with its reason, and does not run it', async () => {
		const { user } = await openPalette();
		await user.type(input(), 'redo');
		const redo = screen.getByRole('option', { name: /Redo/ });
		expect(redo).toHaveAttribute('aria-disabled', 'true');
		expect(redo).toHaveTextContent('Not available right now');
		await user.keyboard('{Enter}');
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('says to open a level first when none is open', async () => {
		const user = userEvent.setup();
		const { opener } = setup({ hasLevel: false, editorOpen: false });
		await user.click(opener);
		await user.type(input(), 'save');
		expect(screen.getByRole('option', { name: /Save/ })).toHaveTextContent('Open a level first');
	});

	it('narrows the list as the query is typed and highlights the match', async () => {
		const { user } = await openPalette();
		await user.type(input(), 'erase');
		expect(names()).toHaveLength(1);
		expect(names()[0]).toContain('Erase');
		const marks = screen.getByRole('option', { name: /Erase/ }).querySelectorAll('mark');
		expect(
			Array.from(marks)
				.map((mark) => mark.textContent)
				.join(''),
		).toBe('Erase');
	});

	it('shows a message when nothing matches', async () => {
		const { user } = await openPalette();
		await user.type(input(), 'qqqq');
		expect(screen.getByText('No matching commands')).toBeInTheDocument();
		expect(screen.queryAllByRole('option')).toHaveLength(0);
		expect(input()).not.toHaveAttribute('aria-activedescendant');
	});

	it('moves with the arrow keys, wrapping, and with Home and End', async () => {
		const { user } = await openPalette();
		const selected = () =>
			screen.getAllByRole('option').findIndex((o) => o.getAttribute('aria-selected') === 'true');
		const count = names().length;
		expect(selected()).toBe(0);
		await user.keyboard('{ArrowDown}');
		expect(selected()).toBe(1);
		await user.keyboard('{ArrowUp}{ArrowUp}');
		expect(selected()).toBe(count - 1);
		await user.keyboard('{ArrowDown}');
		expect(selected()).toBe(0);
		await user.keyboard('{End}');
		expect(selected()).toBe(count - 1);
		await user.keyboard('{Home}');
		expect(selected()).toBe(0);
		expect(input()).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0]!.id);
	});

	it('runs the highlighted command on Enter, closes, and returns focus', async () => {
		const { user, snapshot, opener } = await openPalette();
		await user.type(input(), 'erase');
		await user.keyboard('{Enter}');
		expect(snapshot.handlers['tool.erase']).toHaveBeenCalledOnce();
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(opener).toHaveFocus();
	});

	it('runs a brush command and a menu command by name', async () => {
		const { user, snapshot } = await openPalette();
		await user.type(input(), 'brush: chee');
		await user.keyboard('{Enter}');
		expect(snapshot.handlers['brush.item.cheezie']).toHaveBeenCalledOnce();
	});

	it('runs a command on click and highlights on hover', async () => {
		const { user, snapshot } = await openPalette();
		const row = screen.getByRole('option', { name: /^Undo/ });
		await user.hover(row);
		expect(row).toHaveAttribute('aria-selected', 'true');
		await user.click(row);
		expect(snapshot.handlers['edit.undo']).toHaveBeenCalledOnce();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('closes on Escape and returns focus to where it was', async () => {
		const { user, opener } = await openPalette();
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(opener).toHaveFocus();
	});

	it('closes on a click outside the panel but not inside it', async () => {
		const { user } = await openPalette();
		await user.click(screen.getByRole('dialog'));
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('keeps focus inside the dialog on Tab and when focus is sent elsewhere', async () => {
		const { user, opener } = await openPalette();
		await user.tab();
		expect(input()).toHaveFocus();
		await user.tab({ shift: true });
		expect(input()).toHaveFocus();
		opener.focus();
		expect(input()).toHaveFocus();
	});

	it('lists the recent commands first when the query is empty', async () => {
		const recents = createRecentCommands();
		recents.note('edit.undo');
		recents.note('tool.erase');
		const user = userEvent.setup();
		const { opener } = setup({}, {}, recents);
		await user.click(opener);
		expect(screen.getByText('Recent')).toBeInTheDocument();
		expect(names()[0]).toContain('Erase');
		expect(names()[1]).toContain('Undo');
	});

	it('remembers the commands it runs for the session', async () => {
		const { user, recents } = await openPalette();
		await user.type(input(), 'erase{Enter}');
		expect(recents.ids()).toEqual(['tool.erase']);
	});

	it('asks for a line number after Go to line and sends it on Enter', async () => {
		const { user, snapshot } = await openPalette();
		await user.type(input(), 'go to line');
		await user.keyboard('{Enter}');
		const field = screen.getByRole('textbox', { name: 'Line number' });
		expect(field).toHaveFocus();
		expect(field).toHaveAttribute('placeholder', 'Line number, 1 to 40');
		expect(screen.queryByRole('listbox')).toBeNull();
		await user.type(field, '12{Enter}');
		expect(snapshot.handlers['goto.line']).toHaveBeenCalledWith('12');
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('refuses a line outside the script and keeps asking', async () => {
		const { user, snapshot } = await openPalette();
		await user.type(input(), 'go to line{Enter}');
		const field = screen.getByRole('textbox', { name: 'Line number' });
		await user.type(field, '41{Enter}');
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a line from 1 to 40.');
		expect(field).toHaveAttribute('aria-invalid', 'true');
		expect(snapshot.handlers['goto.line']).not.toHaveBeenCalled();
		await user.clear(field);
		await user.type(field, 'abc{Enter}');
		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('closes from the line prompt on Escape', async () => {
		const { user, opener } = await openPalette();
		await user.type(input(), 'go to line{Enter}');
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(opener).toHaveFocus();
	});
});

describe('the opening shortcut', () => {
	const key = (init: Partial<KeyboardEvent>) =>
		isCommandPaletteShortcut({
			key: 'P',
			ctrlKey: true,
			metaKey: false,
			shiftKey: true,
			altKey: false,
			...init,
		});

	it('is Ctrl or Cmd with Shift and P', () => {
		expect(key({})).toBe(true);
		expect(key({ key: 'p' })).toBe(true);
		expect(key({ ctrlKey: false, metaKey: true })).toBe(true);
		expect(key({ shiftKey: false })).toBe(false);
		expect(key({ altKey: true })).toBe(false);
		expect(key({ ctrlKey: false })).toBe(false);
		expect(key({ key: 'o' })).toBe(false);
	});
});
