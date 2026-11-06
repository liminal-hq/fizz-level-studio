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
		tiles: ['empty', 'fill', 'grass', 'spike'],
		words,
		brush: { group: 'tile' as const, kind: 'fill' },
		onBrush: vi.fn(),
		spacing: 1,
		onSpacing: vi.fn(),
	});
	const section = (name: string) => screen.getByRole('group', { name });

	it('lists the brushes in labelled sections, each as a listbox', () => {
		render(<PalettePanel {...props()} />);
		const headings = screen.getAllByRole('heading').map((h) => h.textContent);
		expect(headings).toEqual(['Terrain', 'Hazards', 'Treats', 'Enemies', 'Markers'].slice(0, 4));
		const terrain = within(section('Terrain')).getByRole('listbox', { name: 'Terrain' });
		expect(within(terrain).getByRole('option', { name: 'grass' })).toHaveAttribute(
			'title',
			'Grassy ground',
		);
		expect(within(terrain).queryByRole('option', { name: 'empty' })).toBeNull();
		expect(within(terrain).queryByRole('option', { name: 'spike' })).toBeNull();
		expect(within(section('Hazards')).getByRole('option', { name: 'spike' })).toBeInTheDocument();
		expect(within(section('Treats')).getByRole('option', { name: 'soda' })).toBeInTheDocument();
		expect(within(section('Enemies')).getByRole('option', { name: 'gloop' })).toBeInTheDocument();
	});

	it('lights the current brush and no other', () => {
		render(<PalettePanel {...props()} />);
		expect(screen.getByRole('option', { name: 'fill' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('option', { name: 'grass' })).toHaveAttribute('aria-selected', 'false');
		expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);
	});

	it('chooses a tile, an item or an enemy as the brush when it is clicked', async () => {
		const p = props();
		render(<PalettePanel {...p} />);
		await userEvent.click(screen.getByRole('option', { name: 'grass' }));
		await userEvent.click(screen.getByRole('option', { name: 'soda' }));
		await userEvent.click(screen.getByRole('option', { name: 'gloop' }));
		expect(p.onBrush.mock.calls.map(([brush]) => brush)).toEqual([
			{ group: 'tile', kind: 'grass' },
			{ group: 'item', kind: 'soda' },
			{ group: 'enemy', kind: 'gloop' },
		]);
	});

	it('moves with the arrow keys, Home and End, and chooses with Enter or Space', async () => {
		const user = userEvent.setup();
		const p = props();
		render(<PalettePanel {...p} />);
		const fill = screen.getByRole('option', { name: 'fill' });
		const grass = screen.getByRole('option', { name: 'grass' });
		// One tab stop per section: the lit entry, so grass is out of the Tab order.
		expect(fill).toHaveAttribute('tabindex', '0');
		expect(grass).toHaveAttribute('tabindex', '-1');
		fill.focus();
		await user.keyboard('{ArrowDown}');
		expect(grass).toHaveFocus();
		expect(grass).toHaveAttribute('tabindex', '0');
		await user.keyboard('{ArrowUp}{End}');
		expect(grass).toHaveFocus();
		await user.keyboard('{Home}');
		expect(fill).toHaveFocus();
		await user.keyboard('{End}{Enter}');
		expect(p.onBrush).toHaveBeenLastCalledWith({ group: 'tile', kind: 'grass' });
		await user.keyboard(' ');
		expect(p.onBrush).toHaveBeenCalledTimes(2);
	});

	it('folds and unfolds a section with its heading', async () => {
		const user = userEvent.setup();
		render(<PalettePanel {...props()} />);
		const fold = screen.getByRole('button', { name: 'Treats' });
		expect(fold).toHaveAttribute('aria-expanded', 'true');
		await user.click(fold);
		expect(fold).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('option', { name: 'soda' })).toBeNull();
		expect(screen.getByRole('option', { name: 'gloop' })).toBeInTheDocument();
		await user.click(fold);
		expect(screen.getByRole('option', { name: 'soda' })).toBeInTheDocument();
	});

	it('opens a folded section and lights the entry when Pick changes the brush into it', async () => {
		const user = userEvent.setup();
		const p = props();
		const { rerender } = render(<PalettePanel {...p} />);
		await user.click(screen.getByRole('button', { name: 'Enemies' }));
		expect(screen.queryByRole('option', { name: 'gloop' })).toBeNull();
		rerender(<PalettePanel {...p} brush={{ group: 'enemy', kind: 'gloop' }} />);
		expect(screen.getByRole('option', { name: 'gloop' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('button', { name: 'Enemies' })).toHaveAttribute(
			'aria-expanded',
			'true',
		);
	});

	it('shows the spacing stepper with the Treats, live only for an item brush', async () => {
		const user = userEvent.setup();
		const p = props();
		const { rerender } = render(<PalettePanel {...p} />);
		const further = within(section('Treats')).getByRole('button', {
			name: 'Place items further apart',
		});
		expect(further).toBeDisabled();
		expect(within(section('Terrain')).queryByRole('group', { name: 'Item spacing' })).toBeNull();
		rerender(<PalettePanel {...p} brush={{ group: 'item', kind: 'soda' }} spacing={3} />);
		expect(screen.getByRole('group', { name: 'Item spacing' })).toHaveTextContent('Every 3 cells');
		await user.click(further);
		expect(p.onSpacing).toHaveBeenCalledWith(4);
	});

	it('says so when the words are not available, and still offers the built-in lists', () => {
		render(<PalettePanel {...props()} words={[]} />);
		expect(screen.getByRole('option', { name: 'grass' })).toBeInTheDocument();
		expect(screen.getByText('The word list is not available.')).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'cheezie' })).toBeInTheDocument();
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
