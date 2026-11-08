// Tests for keeping the selection on the same thing as the level changes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { resolveThing } from './resolveThing';

const soda: Thing = {
	kind: 'item',
	name: 'soda',
	x: 3,
	y: 1,
	layer: 'objects',
	index: 1,
	line: 6,
};
const gloop: Thing = {
	kind: 'enemy',
	name: 'gloop',
	x: 5,
	y: 1,
	layer: 'objects',
	index: 0,
	line: 9,
};

const item = (kind: string, x: number, y: number, line: number) => ({
	kind,
	x,
	y,
	line,
	generator: null,
});

const base = levelView(12, 8, {
	items: [item('cheezie', 1, 1, 5), item('soda', 3, 1, 6)],
	spawns: [{ kind: 'gloop', x: 5, y: 1, dir: null, ride: false, on_ground: false, line: 9 }],
	start: { x: 2, y: 1, line: 3 },
});

describe('resolveThing', () => {
	it('is the same selection when nothing about it changed', () => {
		expect(resolveThing(soda, base)).toBe(soda);
		expect(resolveThing(gloop, base)).toBe(gloop);
	});

	it('follows the thing the person moved: same index and word, new cell', () => {
		const moved = { ...base, items: [base.items[0]!, item('soda', 4, 1, 6)] };
		expect(resolveThing(soda, moved)).toEqual({ ...soda, x: 4 });
	});

	it('follows a move that split its statement: new cell and a new line', () => {
		const split = { ...base, items: [base.items[0]!, item('soda', 4, 2, 7)] };
		expect(resolveThing(soda, split)).toEqual({ ...soda, x: 4, y: 2, line: 7 });
	});

	it('finds the thing by its word and cell when an outside edit shifted the list', () => {
		const shifted = {
			...base,
			items: [item('soda', 9, 1, 4), item('cheezie', 1, 1, 5), item('soda', 3, 1, 7)],
		};
		expect(resolveThing(soda, shifted)).toEqual({ ...soda, index: 2, line: 7 });
	});

	it('takes the match with the nearest line when twins share a cell', () => {
		const twins = {
			...base,
			items: [item('soda', 3, 1, 2), item('cheezie', 1, 1, 5), item('soda', 3, 1, 40)],
		};
		expect(resolveThing({ ...soda, index: 5, line: 6 }, twins)).toMatchObject({ index: 0 });
	});

	it('lets go of a thing that is no longer there', () => {
		expect(resolveThing(soda, { ...base, items: [] })).toBeNull();
		expect(resolveThing(gloop, { ...base, spawns: [] })).toBeNull();
		const gone = { ...base, items: [item('cheezie', 1, 1, 5), item('cheezie', 8, 1, 6)] };
		expect(resolveThing(soda, gone)).toBeNull();
	});

	it('keeps the start while the level has one, and follows it', () => {
		const start: Thing = {
			kind: 'start',
			name: 'start',
			x: 2,
			y: 1,
			layer: 'objects',
			index: 0,
			line: 3,
		};
		expect(resolveThing(start, base)).toBe(start);
		expect(resolveThing(start, { ...base, start: { x: 4, y: 2, line: 3 } })).toMatchObject({
			x: 4,
			y: 2,
		});
		expect(resolveThing(start, { ...base, start: null })).toBeNull();
	});

	it('keeps a cell selected, with its tile word as it is now', () => {
		const cell: Thing = {
			kind: 'cell',
			name: 'empty',
			x: 4,
			y: 0,
			layer: 'tiles',
			index: 0,
			line: null,
		};
		expect(resolveThing(cell, base)).toEqual({ ...cell, name: 'fill' });
		expect(resolveThing({ ...cell, x: 40 }, base)).toBeNull();
	});
});
