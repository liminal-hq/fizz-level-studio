// Tests for the Palette, the script line's completion and the Ghosts panel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GhostsPanel } from './GhostsPanel';
import { PalettePanel } from './PalettePanel';
import { ScriptPanel } from './ScriptPanel';

const doc = (word: string, kind: string, note = ''): WordDoc => ({
	word,
	kind,
	syntax: `${word} <args>`,
	example: word,
	note,
});

const words = [
	doc('paint', 'statement'),
	doc('path', 'tile'),
	doc('place', 'statement'),
	doc('grass', 'tile', 'Grassy ground'),
	doc('cheezie', 'item'),
	doc('soda', 'item'),
	doc('gloop', 'enemy'),
];

describe('PalettePanel', () => {
	const props = () => ({
		tiles: ['empty', 'fill', 'grass'],
		words,
		brush: { group: 'tile' as const, kind: 'fill' },
		onBrush: vi.fn(),
	});

	it('lists the level tiles, then the documented items and enemies on their tabs', async () => {
		render(<PalettePanel {...props()} />);
		const region = screen.getByRole('region', { name: 'Palette' });
		expect(within(region).getByRole('button', { name: 'grass' })).toHaveAttribute(
			'title',
			'Grassy ground',
		);
		expect(within(region).queryByRole('button', { name: 'empty' })).toBeNull();
		await userEvent.click(within(region).getByRole('tab', { name: 'Items' }));
		expect(within(region).getByRole('button', { name: 'soda' })).toBeInTheDocument();
		await userEvent.click(within(region).getByRole('tab', { name: 'Enemies' }));
		expect(within(region).getByRole('button', { name: 'gloop' })).toBeInTheDocument();
		expect(within(region).queryByRole('button', { name: 'soda' })).toBeNull();
	});

	it('marks the current brush as pressed', () => {
		render(<PalettePanel {...props()} />);
		expect(screen.getByRole('button', { name: 'fill' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'grass' })).toHaveAttribute('aria-pressed', 'false');
	});

	it('chooses a tile, an item or an enemy as the brush when it is clicked', async () => {
		const p = props();
		render(<PalettePanel {...p} />);
		await userEvent.click(screen.getByRole('button', { name: 'grass' }));
		await userEvent.click(screen.getByRole('tab', { name: 'Items' }));
		await userEvent.click(screen.getByRole('button', { name: 'soda' }));
		await userEvent.click(screen.getByRole('tab', { name: 'Enemies' }));
		await userEvent.click(screen.getByRole('button', { name: 'gloop' }));
		expect(p.onBrush.mock.calls.map(([brush]) => brush)).toEqual([
			{ group: 'tile', kind: 'grass' },
			{ group: 'item', kind: 'soda' },
			{ group: 'enemy', kind: 'gloop' },
		]);
	});

	it('says so when the words are not available, and still offers the built-in lists', async () => {
		render(<PalettePanel {...props()} words={[]} />);
		expect(screen.getByRole('button', { name: 'grass' })).toBeInTheDocument();
		await userEvent.click(screen.getByRole('tab', { name: 'Items' }));
		expect(screen.getByText('The word list is not available.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'cheezie' })).toBeInTheDocument();
	});
});

describe('completion in the Script panel', () => {
	const mount = () => render(<ScriptPanel text="" diagnostics={[]} words={words} />);

	it('has no field without words', () => {
		render(<ScriptPanel text="" diagnostics={[]} />);
		expect(screen.queryByRole('combobox')).toBeNull();
	});

	it('offers paint for pa as a listbox, with the field keeping focus', async () => {
		const user = userEvent.setup();
		mount();
		const field = screen.getByRole('combobox', { name: 'Script line' });
		expect(field).toHaveAttribute('aria-expanded', 'false');
		await user.type(field, 'pa');
		expect(field).toHaveAttribute('aria-expanded', 'true');
		const options = within(screen.getByRole('listbox', { name: 'Word suggestions' })).getAllByRole(
			'option',
		);
		expect(options.map((o) => o.textContent)).toEqual(['paintstatement', 'pathtile']);
		expect(options[0]).toHaveAttribute('aria-selected', 'true');
		expect(field).toHaveAttribute('aria-activedescendant', options[0]?.id);
		expect(field).toHaveFocus();
	});

	it('accepts the highlighted word with Tab, and the next one after ArrowDown with Enter', async () => {
		const user = userEvent.setup();
		mount();
		const field = screen.getByRole('combobox', { name: 'Script line' });
		await user.type(field, 'pa');
		await user.keyboard('{Tab}');
		expect(field).toHaveValue('paint');
		expect(field).toHaveFocus();
		expect(field).toHaveAttribute('aria-expanded', 'false');

		await user.type(field, ' pa');
		await user.keyboard('{ArrowDown}{Enter}');
		expect(field).toHaveValue('paint path');
	});

	it('moves up and wraps, and closes with Escape without clearing the text', async () => {
		const user = userEvent.setup();
		mount();
		const field = screen.getByRole('combobox', { name: 'Script line' });
		await user.type(field, 'pa');
		await user.keyboard('{ArrowUp}');
		expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
		await user.keyboard('{Escape}');
		expect(field).toHaveAttribute('aria-expanded', 'false');
		expect(field).toHaveValue('pa');
	});

	it('accepts a suggestion that is clicked', async () => {
		const user = userEvent.setup();
		mount();
		const field = screen.getByRole('combobox', { name: 'Script line' });
		await user.type(field, 'pa');
		await user.click(screen.getByRole('option', { name: /^path/ }));
		expect(field).toHaveValue('path');
	});

	it('completes the word at the caret in the middle of a line', async () => {
		const user = userEvent.setup();
		mount();
		const field = screen.getByRole('combobox', { name: 'Script line' });
		await user.type(field, 'paint gr x=1');
		await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
		expect(screen.getByRole('option', { name: /^grass/ })).toBeInTheDocument();
		await user.keyboard('{Tab}');
		expect(field).toHaveValue('paint grass x=1');
	});
});

describe('GhostsPanel', () => {
	const proposals: GhostProposal[] = [
		{
			id: 'h1',
			title: 'A ledge',
			why: 'for a jump',
			lines: ['paint grass x=1 y=1'],
			cells: [{ x: 1, y: 1, op: 'paint', word: 'grass' }],
		},
		{ id: 'h2', title: 'Two', why: null, lines: [], cells: [] },
	];

	it('lists the proposals with their cell counts and reasons, and offers no accept or reject', () => {
		render(<GhostsPanel proposals={proposals} shown onToggle={vi.fn()} onRefresh={vi.fn()} />);
		expect(screen.getByText('A ledge')).toBeInTheDocument();
		expect(screen.getByText('1 cell')).toBeInTheDocument();
		expect(screen.getByText('0 cells')).toBeInTheDocument();
		expect(screen.getByText('for a jump')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /accept|reject/i })).toBeNull();
	});

	it('toggles the lens and refreshes on request', async () => {
		const onToggle = vi.fn();
		const onRefresh = vi.fn();
		render(<GhostsPanel proposals={[]} shown onToggle={onToggle} onRefresh={onRefresh} />);
		const toggle = screen.getByRole('switch', { name: 'Show Claude’s proposals on the canvas' });
		expect(toggle).toBeChecked();
		await userEvent.click(toggle);
		expect(onToggle).toHaveBeenCalledWith(false);
		await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(screen.getByText('Nothing proposed')).toBeInTheDocument();
	});
});
