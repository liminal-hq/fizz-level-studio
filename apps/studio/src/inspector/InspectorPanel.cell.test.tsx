// Tests for the Inspector's account of a selected cell, one state at a time
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { InspectorPanel } from './InspectorPanel';

const doc = (word: string, group: string, note: string): WordDoc => ({
	word,
	kind: 'tile',
	syntax: `${word} x=A..B y=A..B`,
	example: '',
	note: `${group}: ${note}`,
	group,
});

const words = [
	doc('fill', 'Ground and solids', 'Solid ground. The basic filler for terrain.'),
	doc('grass', 'Scenery and rooms', 'Grass. Not solid; ground cover for the overworld.'),
];

const text = [
	'script fizz1 0',
	'level test',
	'terrain',
	'  pool 4, flat 8',
	'edits',
	'  paint grass x=3 y=1',
].join('\n');

const sections: ViewSection[] = [
	{ id: 'terrain', label: 'Terrain', kind: 'tiles', affects: 'cells', lines: [[3, 4]], count: 1 },
	{ id: 'edits', label: 'Edits', kind: 'tiles', affects: 'cells', lines: [[5, 6]], count: 1 },
];

const view = levelView(6, 4, {
	sections,
	cell_sections: Array.from({ length: 24 }, (_, i) => (i < 6 ? 0 : i === 9 ? 1 : 255)),
	cells: Array.from({ length: 24 }, (_, i) => (i < 6 ? 1 : i === 9 ? 2 : 0)),
});

const cellThing = (x: number, y: number, name: string): Thing => ({
	kind: 'cell',
	name,
	x,
	y,
	layer: 'tiles',
	index: 0,
	line: null,
});

function show(
	selected: Thing,
	line: number | null,
	over: Partial<Parameters<typeof InspectorPanel>[0]> = {},
) {
	const onShowLine = vi.fn();
	const onBrush = vi.fn();
	render(
		<InspectorPanel
			snapshot={levelSnapshot({ text }, view)}
			thing={selected}
			words={words}
			onShowLine={onShowLine}
			onBrush={onBrush}
			lookupCellLine={() => Promise.resolve(line)}
			{...over}
		/>,
	);
	return { onShowLine, onBrush };
}

describe('a selected cell in the Inspector', () => {
	it('describes a terrain tile: name, language description, line text, layer and brush', async () => {
		const user = userEvent.setup();
		const { onShowLine, onBrush } = show(cellThing(2, 0, 'fill'), 4);
		expect(screen.getByRole('heading', { name: 'Cell 2, 0 · fill' })).toBeInTheDocument();
		expect(screen.getByText('Ground and solids')).toBeInTheDocument();
		expect(screen.getByText('Solid ground. The basic filler for terrain.')).toBeInTheDocument();
		expect(screen.getByText('fill x=A..B y=A..B')).toBeInTheDocument();
		const facts = screen.getByRole('group', { name: 'About this cell' });
		expect(await within(facts).findByText('Terrain, line 4')).toBeInTheDocument();
		expect(within(facts).getByText('pool 4, flat 8')).toBeInTheDocument();
		expect(within(facts).getByText(/Ground, slopes and pools/)).toBeInTheDocument();
		await user.click(within(facts).getByRole('button', { name: 'Show in script' }));
		expect(onShowLine).toHaveBeenCalledWith(4);
		await user.click(within(facts).getByRole('button', { name: 'Use the fill brush' }));
		expect(onBrush).toHaveBeenCalledWith({ group: 'tile', kind: 'fill' });
	});

	it('shows a painted-over tile on the edits layer with the edits line', async () => {
		show(cellThing(3, 1, 'grass'), 6);
		const facts = screen.getByRole('group', { name: 'About this cell' });
		expect(await within(facts).findByText('Edits, line 6')).toBeInTheDocument();
		expect(within(facts).getByText('paint grass x=3 y=1')).toBeInTheDocument();
		expect(within(facts).getByText(/Made in the studio/)).toBeInTheDocument();
	});

	it('says an empty cell is empty, what could be placed, and which layer a paint would write', () => {
		show(cellThing(5, 3, 'empty'), null);
		expect(screen.getByText('Empty: nothing is painted here.')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Brushes you can place here, from the Palette: Terrain, Hazards, Treats and Enemies.',
			),
		).toBeInTheDocument();
		expect(
			screen.getByText('A paint here is added to Edits, at the end of the script.'),
		).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /brush/ })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Show in script' })).toBeNull();
	});

	it('says a locked layer is locked, with the lock note', async () => {
		show(cellThing(2, 0, 'fill'), 4, { lockedLayers: ['terrain'] });
		const facts = screen.getByRole('group', { name: 'About this cell' });
		expect(await within(facts).findByText('Locked')).toBeInTheDocument();
		expect(
			within(facts).getByText(
				'This layer is locked. It cannot be changed, by you or by Claude. Unlock it in Layers.',
			),
		).toBeInTheDocument();
	});

	it('warns on an empty cell when the layer a paint writes to is locked', () => {
		show(cellThing(5, 3, 'empty'), null, { lockedLayers: ['edits'] });
		expect(screen.getByRole('status')).toHaveTextContent('This layer is locked.');
	});

	it('says a hidden layer is hidden on the canvas, and still describes the real tile', async () => {
		// The canvas masks hidden cells, so the selection may carry `empty`; the model reads the real tile.
		show(cellThing(2, 0, 'empty'), 4, { hiddenLayers: ['terrain'] });
		expect(screen.getByRole('heading', { name: 'Cell 2, 0 · fill' })).toBeInTheDocument();
		const facts = screen.getByRole('group', { name: 'About this cell' });
		expect(await within(facts).findByText('Hidden')).toBeInTheDocument();
		expect(
			within(facts).getByText('This layer is hidden on the canvas. Hiding is for your view only.'),
		).toBeInTheDocument();
	});

	it('keeps the Fizz 2 note for a Fizz 2 level, with no layer or line', () => {
		const fizz2 = levelView(6, 4, { cells: view.cells });
		show(cellThing(2, 0, 'fill'), null, {
			snapshot: levelSnapshot({ target: 'fizz2', text }, fizz2),
		});
		expect(
			screen.getByText('Things in a Fizz 2 level are changed in its script for now.'),
		).toBeInTheDocument();
		expect(screen.queryByText('Layer')).toBeNull();
		expect(screen.queryByText('Last set by')).toBeNull();
	});

	it('says no line sets a tile the script never wrote', async () => {
		show(cellThing(2, 0, 'fill'), null, {
			snapshot: levelSnapshot({ text }, levelView(6, 4)),
		});
		expect(await screen.findByText('No line of the script sets this cell.')).toBeInTheDocument();
	});

	it('links the brush button to the description for assistive technology', () => {
		show(cellThing(2, 0, 'fill'), 4);
		const button = screen.getByRole('button', { name: 'Use the fill brush' });
		expect(button).toHaveAccessibleDescription('Solid ground. The basic filler for terrain.');
	});
});
