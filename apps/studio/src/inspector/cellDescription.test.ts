// Tests for the model behind the Inspector's account of a selected cell
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { describeCell, lineTextOf, tileWordAt, type CellDescriptionInput } from './cellDescription';

const doc = (word: string, kind: string, group: string, note: string): WordDoc => ({
	word,
	kind,
	syntax: `${word} x=A..B y=A..B`,
	example: '',
	note: group === '' ? note : `${group}: ${note}`,
	group,
});

const words: WordDoc[] = [
	doc('fill', 'tile', 'Ground and solids', 'Solid ground. The basic filler for terrain.'),
	doc('grass', 'tile', 'Scenery and rooms', 'Grass. Not solid; ground cover for the overworld.'),
	doc('spike', 'tile', 'Hazards', 'Spikes. Touching them kills Ben.'),
	doc('empty', 'tile', 'Ground and solids', 'Nothing. `clear` writes it.'),
	doc('soda', 'item', '', 'A soda restores health.'),
];

const text = [
	'script fizz1 0',
	'level test',
	'terrain',
	'  flat 8',
	'edits',
	'  paint grass x=3 y=1',
].join('\n');

const sections: ViewSection[] = [
	{ id: 'terrain', label: 'Terrain', kind: 'tiles', affects: 'cells', lines: [[3, 4]], count: 1 },
	{ id: 'edits', label: 'Edits', kind: 'tiles', affects: 'cells', lines: [[5, 6]], count: 1 },
];

function input(over: Partial<CellDescriptionInput> = {}): CellDescriptionInput {
	// Row 0 is fill (written by terrain); the cell at 3,1 is grass (written by edits); the rest is empty.
	const view = levelView(6, 4, {
		sections,
		cell_sections: Array.from({ length: 24 }, (_, i) => (i < 6 ? 0 : i === 9 ? 1 : 255)),
		cells: Array.from({ length: 24 }, (_, i) => (i < 6 ? 1 : i === 9 ? 2 : 0)),
	});
	return { view, text, words, x: 0, y: 0, line: 4, locked: [], hidden: [], ...over };
}

describe('lineTextOf', () => {
	it('reads a line from 1 and trims it', () => {
		expect(lineTextOf(text, 4)).toBe('flat 8');
		expect(lineTextOf('a\r\nb\r\n', 1)).toBe('a');
	});
	it('is null for no line or a line past the end', () => {
		expect(lineTextOf(text, null)).toBeNull();
		expect(lineTextOf(text, 0)).toBeNull();
		expect(lineTextOf(text, 99)).toBeNull();
	});
});

describe('tileWordAt', () => {
	it('names the tile in the whole view and is null outside the level', () => {
		const { view } = input();
		expect(tileWordAt(view, 0, 0)).toBe('fill');
		expect(tileWordAt(view, 3, 1)).toBe('grass');
		expect(tileWordAt(view, 6, 0)).toBeNull();
		expect(tileWordAt(view, 0, -1)).toBeNull();
	});
});

describe('describeCell', () => {
	it('describes a terrain tile with the language’s words, its line, layer and brush', () => {
		const cell = describeCell(input());
		expect(cell.tile).toBe('fill');
		expect(cell.empty).toBe(false);
		expect(cell.category).toBe('Ground and solids');
		expect(cell.note).toBe('Solid ground. The basic filler for terrain.');
		expect(cell.syntax).toBe('fill x=A..B y=A..B');
		expect(cell.line).toBe(4);
		expect(cell.lineText).toBe('flat 8');
		expect(cell.layer).toEqual({ id: 'terrain', label: 'Terrain', locked: false, hidden: false });
		expect(cell.brush).toEqual({ group: 'tile', kind: 'fill' });
		expect(cell.placeable).toEqual([]);
		expect(cell.paintLayer).toBeNull();
	});

	it('says a painted-over tile belongs to the edits layer and shows the edits line', () => {
		const cell = describeCell(input({ x: 3, y: 1, line: 6 }));
		expect(cell.tile).toBe('grass');
		expect(cell.layer?.id).toBe('edits');
		expect(cell.lineText).toBe('paint grass x=3 y=1');
		expect(cell.note).toBe('Grass. Not solid; ground cover for the overworld.');
	});

	it('takes the real tile from the whole view, whatever name the selection carried', () => {
		expect(describeCell(input({ x: 3, y: 1, line: 6 }), 'empty').tile).toBe('grass');
		expect(describeCell(input({ x: 50, y: 50, line: null }), 'rock').tile).toBe('rock');
	});

	it('marks the layer locked or hidden from the lists it is given', () => {
		const cell = describeCell(input({ locked: ['terrain'], hidden: ['terrain', 'edits'] }));
		expect(cell.layer).toMatchObject({ locked: true, hidden: true });
	});

	it('describes an empty cell: no brush, what can be placed, and the layer a paint writes to', () => {
		const cell = describeCell(input({ x: 5, y: 3, line: null, locked: ['edits'] }));
		expect(cell.empty).toBe(true);
		expect(cell.brush).toBeNull();
		expect(cell.layer).toBeNull();
		expect(cell.line).toBeNull();
		expect(cell.lineText).toBeNull();
		expect(cell.placeable).toEqual(['terrain', 'hazards', 'treats', 'enemies']);
		expect(cell.paintLayer).toEqual({ id: 'edits', label: 'Edits', locked: true, hidden: false });
	});

	it('names no paint layer in a level without layers', () => {
		const view = levelView(6, 4);
		const cell = describeCell({ ...input(), view, x: 5, y: 3, line: null });
		expect(cell.paintLayer).toBeNull();
	});

	it('falls back to the layer holding the line when the view has no owner for the cell', () => {
		const base = input({ x: 0, y: 0, line: 4 });
		const view = { ...base.view, cell_sections: [] };
		expect(describeCell({ ...base, view }).layer?.id).toBe('terrain');
	});

	it('has no category or description for a word the language does not document', () => {
		const cell = describeCell({ ...input(), words: [] });
		expect(cell.category).toBeNull();
		expect(cell.note).toBeNull();
		expect(cell.syntax).toBeNull();
		expect(cell.brush).toEqual({ group: 'tile', kind: 'fill' });
	});

	it('offers no brush for a tile the level’s palette does not have', () => {
		const cell = describeCell(input({ x: 50, y: 50, line: null }), 'rock');
		expect(cell.tile).toBe('rock');
		expect(cell.brush).toBeNull();
	});
});
