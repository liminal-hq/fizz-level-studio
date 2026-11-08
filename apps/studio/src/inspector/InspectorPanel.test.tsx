// Tests for the Inspector panel: what each kind of selection shows
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { InspectorPanel } from './InspectorPanel';

const view = levelView(12, 8, {
	items: [
		{ kind: 'soda', x: 3, y: 1, generator: null, line: 5 },
		{ kind: 'cookie', x: 6, y: 2, generator: 'pogo-cache', line: 8 },
	],
	spawns: [
		{ kind: 'gloop', x: 5, y: null, dir: null, ride: false, on_ground: true, line: 11 },
		{ kind: 'drone', x: 8.5, y: 4, dir: 1, ride: false, on_ground: false, line: 12 },
		{ kind: 'ent', x: 9, y: 3, dir: null, ride: true, on_ground: false, line: 13 },
	],
	start: { x: 2, y: 1, line: 3 },
});
const snapshot = levelSnapshot({}, view);

const thing = (over: Partial<Thing>): Thing => ({
	kind: 'item',
	name: 'soda',
	x: 3,
	y: 1,
	layer: 'objects',
	index: 0,
	line: 5,
	...over,
});

const words = [
	{
		word: 'soda',
		kind: 'item',
		syntax: 'soda x=N y=N',
		example: '',
		note: 'A soda restores health.',
	},
];

function show(selected: Thing | null, over: Partial<Parameters<typeof InspectorPanel>[0]> = {}) {
	const onShowLine = vi.fn();
	render(
		<InspectorPanel
			snapshot={snapshot}
			thing={selected}
			words={words}
			onShowLine={onShowLine}
			{...over}
		/>,
	);
	return { onShowLine };
}

describe('the Inspector panel', () => {
	it('says how to select something when nothing is selected', () => {
		show(null);
		expect(screen.getByRole('group', { name: 'Selected thing' })).toBeInTheDocument();
		expect(
			screen.getByText(
				'Nothing selected. Inspect (Q) a thing on the level, or choose one in Objects.',
			),
		).toBeInTheDocument();
	});

	it('shows an item’s name and kind, position, line and quick help', () => {
		show(thing({}));
		expect(screen.getByRole('heading', { name: 'Soda · treat' })).toBeInTheDocument();
		expect(screen.getByText('A soda restores health.')).toBeInTheDocument();
		const fields = screen.getByRole('group', { name: 'Selected thing' });
		expect(within(fields).getByText('x').nextElementSibling).toHaveTextContent('3');
		expect(within(fields).getByText('y').nextElementSibling).toHaveTextContent('1');
		expect(screen.getByText('Line 5')).toBeInTheDocument();
		expect(screen.queryByText('Facing')).toBeNull();
	});

	it('shows an enemy with no row standing on the ground, at the row it rests on', () => {
		show(thing({ kind: 'enemy', name: 'gloop', index: 0, line: 11, x: 5, y: 1 }));
		expect(screen.getByRole('heading', { name: 'Gloop · enemy' })).toBeInTheDocument();
		expect(screen.getByText('y').nextElementSibling).toHaveTextContent('1');
		expect(screen.getByText(/Stands on the ground/)).toBeInTheDocument();
		// The Builder's default facing is left.
		expect(screen.getByText('Facing').nextElementSibling).toHaveTextContent('Left');
	});

	it('shows an enemy’s facing and its fractional column as written', () => {
		show(thing({ kind: 'enemy', name: 'drone', index: 1, line: 12, x: 8, y: 4 }));
		expect(screen.getByText('x').nextElementSibling).toHaveTextContent('8.5');
		expect(screen.getByText('Facing').nextElementSibling).toHaveTextContent('Right');
		expect(screen.queryByText(/Stands on the ground/)).toBeNull();
	});

	it('says a rider has no facing', () => {
		show(thing({ kind: 'enemy', name: 'ent', index: 2, line: 13, x: 9, y: 3 }));
		expect(screen.getByText('Facing').nextElementSibling).toHaveTextContent(
			'A rider has no facing',
		);
	});

	it('shows the start by its own name, with its place and line', () => {
		show(thing({ kind: 'start', name: 'start', index: 0, line: 3, x: 2, y: 1 }));
		expect(screen.getByRole('heading', { name: 'Start' })).toBeInTheDocument();
		expect(screen.getByText('Line 3')).toBeInTheDocument();
		expect(screen.queryByText('Facing')).toBeNull();
	});

	it('names what made a generated item and sends the person to its line', async () => {
		const user = userEvent.setup();
		const { onShowLine } = show(thing({ name: 'cookie', index: 1, x: 6, y: 2, line: 8 }));
		expect(
			screen.getByText('Made by the pogo-cache on line 8: edit that line in the script.'),
		).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Show in script' }));
		expect(onShowLine).toHaveBeenCalledWith(8);
	});

	it('shows a cell with its tile and the line that last set it', async () => {
		const lookup = vi.fn().mockResolvedValue(7);
		const { onShowLine } = show(
			thing({ kind: 'cell', name: 'fill', x: 4, y: 0, layer: 'tiles', line: null }),
			{ lookupCellLine: lookup },
		);
		expect(screen.getByRole('heading', { name: 'Cell 4, 0 · fill' })).toBeInTheDocument();
		expect(screen.getByText('Tiles are painted, not edited here.')).toBeInTheDocument();
		expect(await screen.findByText('Line 7')).toBeInTheDocument();
		expect(lookup).toHaveBeenCalledWith(4, 0);
		await userEvent.setup().click(screen.getByRole('button', { name: 'Show in script' }));
		expect(onShowLine).toHaveBeenCalledWith(7);
	});

	it('shows no line for a cell no statement set', async () => {
		const lookup = vi.fn().mockResolvedValue(null);
		show(thing({ kind: 'cell', name: 'empty', x: 4, y: 5, layer: 'tiles', line: null }), {
			lookupCellLine: lookup,
		});
		await waitFor(() => expect(lookup).toHaveBeenCalled());
		expect(screen.queryByRole('button', { name: 'Show in script' })).toBeNull();
	});

	it('falls back to the empty state when the entry is no longer in the view', () => {
		show(thing({ index: 9 }));
		expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
	});

	it('says a Fizz 2 level’s things are changed in its script', () => {
		const fizz2 = levelSnapshot({ target: 'fizz2' }, view);
		show(thing({ kind: 'start', name: 'start', index: 0, line: 3 }), { snapshot: fizz2 });
		expect(
			screen.getByText('Things in a Fizz 2 level are changed in its script for now.'),
		).toBeInTheDocument();
	});
});
