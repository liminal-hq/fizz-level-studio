// Tests for the pure editing tools
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { copyArea } from './clip';
import { coalesce } from './runs';
import {
	initialToolState,
	lineCells,
	reduceTool,
	thingAt,
	type Cell,
	type PointerPhase,
	type ToolContext,
	type ToolId,
	type ToolState,
} from './tool';

const context: ToolContext = {
	view: levelView(12, 8),
	brush: { group: 'tile', kind: 'grass' },
	spacing: 1,
	clip: null,
};
const itemContext = (spacing: number): ToolContext => ({
	...context,
	brush: { group: 'item', kind: 'cheezie' },
	spacing,
});

function gesture(tool: ToolId, cells: Cell[], ctx: ToolContext = context) {
	let state: ToolState = initialToolState;
	let result = reduceTool(tool, state, 'down', cells[0]!, ctx);
	state = result.state;
	for (const cell of cells.slice(1)) {
		result = reduceTool(tool, state, 'move', cell, ctx);
		state = result.state;
	}
	return reduceTool(tool, state, 'up', cells[cells.length - 1]!, ctx);
}

describe('lineCells', () => {
	it('includes both ends and leaves no gap', () => {
		const cells = lineCells({ x: 0, y: 0 }, { x: 5, y: 2 });
		expect(cells[0]).toEqual({ x: 0, y: 0 });
		expect(cells[cells.length - 1]).toEqual({ x: 5, y: 2 });
		for (let i = 1; i < cells.length; i++) {
			expect(Math.abs(cells[i]!.x - cells[i - 1]!.x)).toBeLessThanOrEqual(1);
			expect(Math.abs(cells[i]!.y - cells[i - 1]!.y)).toBeLessThanOrEqual(1);
		}
	});

	it('is one cell for a click', () => {
		expect(lineCells({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual([{ x: 3, y: 3 }]);
	});
});

describe('coalesce', () => {
	it('folds a horizontal run into one range', () => {
		const cells = [2, 3, 4, 5].map((x) => ({ x, y: 1 }));
		expect(coalesce(cells)).toEqual([{ x: [[2, 5]], y: [1, 1] }]);
	});

	it('folds a filled rectangle into one block', () => {
		const cells = [0, 1, 2].flatMap((x) => [4, 5].map((y) => ({ x, y })));
		expect(coalesce(cells)).toEqual([{ x: [[0, 2]], y: [4, 5] }]);
	});

	it('keeps separate runs on one row in one edit with several ranges', () => {
		const cells = [0, 1, 5, 6].map((x) => ({ x, y: 2 }));
		expect(coalesce(cells)).toEqual([
			{
				x: [
					[0, 1],
					[5, 6],
				],
				y: [2, 2],
			},
		]);
	});

	it('does not invent cells for an L shape', () => {
		const cells = [
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 0, y: 1 },
		];
		const covered = new Set<string>();
		for (const block of coalesce(cells)) {
			for (const [x0, x1] of block.x) {
				for (let x = x0; x <= x1; x++) {
					for (let y = block.y[0]; y <= block.y[1]; y++) covered.add(`${x},${y}`);
				}
			}
		}
		expect([...covered].sort()).toEqual(['0,0', '0,1', '1,0']);
	});

	it('removes duplicate visits', () => {
		const cells = [3, 3, 4, 4, 3].map((x) => ({ x, y: 0 }));
		expect(coalesce(cells)).toEqual([{ x: [[3, 4]], y: [0, 0] }]);
	});
});

describe('paint', () => {
	it('sends nothing until release, then one paint edit for a horizontal drag', () => {
		let state: ToolState = initialToolState;
		const down = reduceTool('paint', state, 'down', { x: 2, y: 3 }, context);
		expect(down.edits).toEqual([]);
		state = down.state;
		const move = reduceTool('paint', state, 'move', { x: 6, y: 3 }, context);
		expect(move.edits).toEqual([]);
		const up = reduceTool('paint', move.state, 'up', { x: 6, y: 3 }, context);
		expect(up.edits).toEqual([{ kind: 'paint', tile: 'grass', x: [[2, 6]], y: [[3, 3]] }]);
		expect(up.state.active).toBe(false);
		expect(up.state.path).toEqual([]);
	});

	it('paints a single click as a one-cell edit', () => {
		expect(gesture('paint', [{ x: 4, y: 4 }]).edits).toEqual([
			{ kind: 'paint', tile: 'grass', x: [[4, 4]], y: [[4, 4]] },
		]);
	});

	it('fills the gap when the pointer jumps', () => {
		const cells = gesture('paint', [
			{ x: 0, y: 2 },
			{ x: 9, y: 2 },
		]);
		expect(cells.edits).toEqual([{ kind: 'paint', tile: 'grass', x: [[0, 9]], y: [[2, 2]] }]);
	});

	it('ignores cells outside the level', () => {
		const result = gesture('paint', [
			{ x: 10, y: 1 },
			{ x: 14, y: 1 },
		]);
		expect(result.edits).toEqual([{ kind: 'paint', tile: 'grass', x: [[10, 11]], y: [[1, 1]] }]);
	});

	it('ignores movement when no button is down', () => {
		const result = reduceTool('paint', initialToolState, 'move', { x: 1, y: 1 }, context);
		expect(result.state).toBe(initialToolState);
		expect(result.edits).toEqual([]);
	});
});

describe('erase', () => {
	it('sends clear edits', () => {
		const result = gesture('erase', [
			{ x: 1, y: 0 },
			{ x: 3, y: 0 },
		]);
		expect(result.edits).toEqual([{ kind: 'clear', x: [[1, 3]], y: [[0, 0]] }]);
	});
});

describe('paint with an item brush', () => {
	it('drops one item per visited cell, as one row line', () => {
		const result = gesture(
			'paint',
			[
				{ x: 2, y: 3 },
				{ x: 6, y: 3 },
			],
			itemContext(1),
		);
		expect(result.edits).toEqual([{ kind: 'row', item: 'cheezie', x: [2, 6], y: 3, by: 1 }]);
	});

	it('steps by the spacing along the drag', () => {
		const result = gesture(
			'paint',
			[
				{ x: 2, y: 3 },
				{ x: 8, y: 3 },
			],
			itemContext(3),
		);
		expect(result.edits).toEqual([{ kind: 'row', item: 'cheezie', x: [2, 8], y: 3, by: 3 }]);
	});

	it('writes a row going left the same way', () => {
		const result = gesture(
			'paint',
			[
				{ x: 8, y: 3 },
				{ x: 2, y: 3 },
			],
			itemContext(3),
		);
		expect(result.edits).toEqual([{ kind: 'row', item: 'cheezie', x: [2, 8], y: 3, by: 3 }]);
	});

	it('places a single click as one item', () => {
		expect(gesture('paint', [{ x: 4, y: 4 }], itemContext(1)).edits).toEqual([
			{ kind: 'place', item: 'cheezie', x: [[4, 4]], y: [[4, 4]] },
		]);
	});
});

describe('paint with an enemy brush', () => {
	const enemy: ToolContext = { ...context, brush: { group: 'enemy', kind: 'drone' } };

	it('places one enemy on press and none while dragging', () => {
		const down = reduceTool('paint', initialToolState, 'down', { x: 5, y: 4 }, enemy);
		expect(down.edits).toEqual([{ kind: 'spawn', enemy: 'drone', x: 5, y: 4 }]);
		expect(reduceTool('paint', down.state, 'move', { x: 7, y: 4 }, enemy).edits).toEqual([]);
		expect(reduceTool('paint', down.state, 'up', { x: 7, y: 4 }, enemy).edits).toEqual([]);
	});

	it('places nothing outside the level', () => {
		expect(reduceTool('paint', initialToolState, 'down', { x: 40, y: 4 }, enemy).edits).toEqual([]);
	});
});

describe('pick', () => {
	it('reads the tile under the pointer and sends no edit', () => {
		const down = reduceTool('pick', initialToolState, 'down', { x: 3, y: 0 }, context);
		expect(down.pick).toEqual({ group: 'tile', kind: 'fill' });
		expect(down.edits).toEqual([]);
		const empty = reduceTool('pick', down.state, 'move', { x: 3, y: 4 }, context);
		expect(empty.pick).toEqual({ group: 'tile', kind: 'empty' });
		const up = reduceTool('pick', empty.state, 'up', { x: 3, y: 4 }, context);
		expect(up.pick).toBeNull();
	});

	it('reads an item or an enemy before the tile beneath it', () => {
		const view = levelView(12, 8, {
			items: [{ kind: 'soda', x: 3, y: 1, line: 9 }],
			spawns: [{ kind: 'gloop', x: 5, y: 1, dir: null, ride: false, line: 12 }],
		});
		const on = { ...context, view };
		expect(reduceTool('pick', initialToolState, 'down', { x: 3, y: 1 }, on).pick).toEqual({
			group: 'item',
			kind: 'soda',
		});
		expect(reduceTool('pick', initialToolState, 'down', { x: 5, y: 1 }, on).pick).toEqual({
			group: 'enemy',
			kind: 'gloop',
		});
	});

	it('reads nothing outside the level', () => {
		expect(reduceTool('pick', initialToolState, 'down', { x: -1, y: 0 }, context).pick).toBeNull();
	});
});

describe('thingAt', () => {
	const view = levelView(12, 8, {
		items: [
			{ kind: 'soda', x: 3, y: 1, line: null },
			{ kind: 'cheezie', x: 5, y: 1, line: null },
		],
		spawns: [
			{ kind: 'gloop', x: 5, y: 1, dir: null, ride: false, line: null },
			{ kind: 'bat', x: 7, y: null, dir: null, ride: false, line: null },
		],
		start: { x: 2, y: 1, line: null },
	});

	it('finds an item on the objects layer', () => {
		expect(thingAt(view, { x: 3, y: 1 })).toEqual({
			kind: 'item',
			name: 'soda',
			x: 3,
			y: 1,
			layer: 'objects',
		});
	});

	it('puts an item above an enemy on the same cell, and an enemy above the start', () => {
		expect(thingAt(view, { x: 5, y: 1 })).toMatchObject({ kind: 'item', name: 'cheezie' });
		const start = {
			...view,
			spawns: [{ kind: 'slug', x: 2, y: 1, dir: null, ride: false, line: null }],
		};
		expect(thingAt(start, { x: 2, y: 1 })).toMatchObject({ kind: 'enemy', name: 'slug' });
	});

	it('finds an enemy with no row on its column’s resting row', () => {
		// Row 0 is the floor, so the bat rests on row 1.
		expect(thingAt(view, { x: 7, y: 1 })).toMatchObject({ kind: 'enemy', name: 'bat', y: 1 });
		expect(thingAt(view, { x: 7, y: 4 })).toMatchObject({ kind: 'cell', name: 'empty' });
	});

	it('finds Ben’s start', () => {
		expect(thingAt(view, { x: 2, y: 1 })).toEqual({
			kind: 'start',
			name: 'start',
			x: 2,
			y: 1,
			layer: 'objects',
		});
	});

	it('selects the cell itself, with its tile or empty, when nothing is on it', () => {
		expect(thingAt(view, { x: 9, y: 0 })).toEqual({
			kind: 'cell',
			name: 'fill',
			x: 9,
			y: 0,
			layer: 'tiles',
		});
		expect(thingAt(view, { x: 9, y: 5 })).toMatchObject({ kind: 'cell', name: 'empty' });
	});

	it('finds nothing outside the level', () => {
		expect(thingAt(view, { x: -1, y: 0 })).toBeNull();
		expect(thingAt(view, { x: 12, y: 0 })).toBeNull();
		expect(thingAt(view, { x: 0, y: 8 })).toBeNull();
	});
});

describe('inspect', () => {
	it('edits nothing, reads no brush and leaves Select’s rectangle alone', () => {
		const outlined = { ...initialToolState, selection: { x0: 1, y0: 1, x1: 2, y1: 2 } };
		for (const phase of ['down', 'move', 'up'] as const) {
			const result = reduceTool('inspect', outlined, phase, { x: 3, y: 0 }, context);
			expect(result).toEqual({ state: outlined, edits: [], pick: null });
		}
	});
});

describe('select', () => {
	it('outlines a rectangle between the anchor and the pointer, and edits nothing', () => {
		let state: ToolState = initialToolState;
		const phases: Array<[PointerPhase, Cell]> = [
			['down', { x: 5, y: 4 }],
			['move', { x: 2, y: 1 }],
			['up', { x: 2, y: 1 }],
		];
		let edits = 0;
		for (const [phase, cell] of phases) {
			const result = reduceTool('select', state, phase, cell, context);
			edits += result.edits.length;
			state = result.state;
		}
		expect(edits).toBe(0);
		expect(state.selection).toEqual({ x0: 2, y0: 1, x1: 5, y1: 4 });
		expect(state.active).toBe(false);
	});

	it('clamps the rectangle to the level', () => {
		const result = gesture('select', [
			{ x: 1, y: 1 },
			{ x: 40, y: 40 },
		]);
		expect(result.state.selection).toEqual({ x0: 1, y0: 1, x1: 11, y1: 7 });
	});
});

describe('stamp', () => {
	const view = levelView(12, 8, {
		items: [{ kind: 'cheezie', x: 2, y: 3, line: 9 }],
		spawns: [{ kind: 'gloop', x: 3, y: 1, dir: null, ride: false, line: 12 }],
	});
	const clip = copyArea(view, { x0: 1, y0: 0, x1: 3, y1: 3 });
	const pasting: ToolContext = { ...context, view, clip };

	it('pastes the copied area with its top-left cell on the pressed cell', () => {
		const result = reduceTool('stamp', initialToolState, 'down', { x: 6, y: 6 }, pasting);
		expect(result.edits).toEqual([
			{ kind: 'paint', tile: 'fill', x: [[6, 8]], y: [[3, 3]] },
			{ kind: 'place', item: 'cheezie', x: [[7, 7]], y: [[6, 6]] },
			{ kind: 'spawn', enemy: 'gloop', x: 8, y: 4 },
		]);
	});

	it('cuts a paste at the edge of the level', () => {
		const result = reduceTool('stamp', initialToolState, 'down', { x: 11, y: 6 }, pasting);
		expect(result.edits).toEqual([{ kind: 'paint', tile: 'fill', x: [[11, 11]], y: [[3, 3]] }]);
	});

	it('pastes nothing without a copy, outside the level or on release', () => {
		expect(reduceTool('stamp', initialToolState, 'down', { x: 7, y: 2 }, context).edits).toEqual(
			[],
		);
		expect(reduceTool('stamp', initialToolState, 'down', { x: 99, y: 2 }, pasting).edits).toEqual(
			[],
		);
		expect(reduceTool('stamp', initialToolState, 'up', { x: 1, y: 2 }, pasting).edits).toEqual([]);
	});
});
