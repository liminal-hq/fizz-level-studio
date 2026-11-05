// Tests for the stroke helpers: spaced cells, and the item runs written for them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { itemEdits, spacedCells, visitedOnce } from './runs';
import { lineCells } from './tool';

const row = (from: number, to: number, y: number) => lineCells({ x: from, y }, { x: to, y });

describe('spacedCells', () => {
	it('keeps the first cell and every step after it', () => {
		expect(spacedCells(row(0, 7, 2), 3).map((c) => c.x)).toEqual([0, 3, 6]);
		expect(spacedCells(row(0, 3, 2), 1).map((c) => c.x)).toEqual([0, 1, 2, 3]);
	});

	it('counts a cell once however often the pointer crossed it', () => {
		const path = [...row(0, 4, 0), ...row(4, 0, 0)];
		expect(visitedOnce(path)).toHaveLength(5);
		expect(spacedCells(path, 2).map((c) => c.x)).toEqual([0, 2, 4]);
	});
});

describe('itemEdits', () => {
	it('writes one row line for an even run, with by only past 1', () => {
		expect(itemEdits('choc', spacedCells(row(46, 52, 8), 3))).toEqual([
			{ kind: 'row', item: 'choc', x: [46, 52], y: 8, by: 3 },
		]);
		expect(itemEdits('choc', row(17, 20, 7))).toEqual([
			{ kind: 'row', item: 'choc', x: [17, 20], y: 7, by: 1 },
		]);
	});

	it('writes one row per row of a drag across rows', () => {
		const cells = [...row(2, 4, 1), ...row(2, 4, 2)];
		expect(itemEdits('cookie', cells)).toEqual([
			{ kind: 'row', item: 'cookie', x: [2, 4], y: 1, by: 1 },
			{ kind: 'row', item: 'cookie', x: [2, 4], y: 2, by: 1 },
		]);
	});

	it('places lone cells and cells too far apart for a step', () => {
		expect(
			itemEdits('soda', [
				{ x: 1, y: 3 },
				{ x: 30, y: 3 },
				{ x: 5, y: 6 },
			]),
		).toEqual([
			{
				kind: 'place',
				item: 'soda',
				x: [
					[1, 1],
					[30, 30],
				],
				y: [[3, 3]],
			},
			{ kind: 'place', item: 'soda', x: [[5, 5]], y: [[6, 6]] },
		]);
	});

	it('lands every row on its step, so the language accepts it', () => {
		for (let step = 1; step <= 8; step++) {
			const [edit] = itemEdits('cheezie', spacedCells(row(3, 40, 1), step));
			expect(edit?.kind).toBe('row');
			if (edit?.kind === 'row') expect((edit.x[1] - edit.x[0]) % edit.by).toBe(0);
		}
	});
});
