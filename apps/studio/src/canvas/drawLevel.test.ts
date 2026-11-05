// Tests for drawing a level, including a timing bound on a 220 by 32 level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { drawLevel, restingRow, type CanvasColours, type DrawContext } from './drawLevel';
import type { DrawOptions } from './drawLevel';

interface Call {
	op: string;
	args: unknown[];
	fill: string;
	stroke: string;
}

/** A recording stand-in for the 2D context. */
function recorder(): { ctx: DrawContext; calls: Call[] } {
	const calls: Call[] = [];
	const state = { fillStyle: '', strokeStyle: '' };
	const note =
		(op: string) =>
		(...args: unknown[]) => {
			calls.push({ op, args, fill: state.fillStyle, stroke: state.strokeStyle });
		};
	const ctx = {
		get fillStyle() {
			return state.fillStyle;
		},
		set fillStyle(value: string) {
			state.fillStyle = value;
		},
		get strokeStyle() {
			return state.strokeStyle;
		},
		set strokeStyle(value: string) {
			state.strokeStyle = value;
		},
		lineWidth: 1,
		font: '',
		textAlign: 'start',
		textBaseline: 'alphabetic',
		fillRect: note('fillRect'),
		strokeRect: note('strokeRect'),
		fillText: note('fillText'),
		beginPath: note('beginPath'),
		moveTo: note('moveTo'),
		lineTo: note('lineTo'),
		closePath: note('closePath'),
		arc: note('arc'),
		fill: note('fill'),
		stroke: note('stroke'),
		setLineDash: note('setLineDash'),
	} as unknown as DrawContext;
	return { ctx, calls };
}

/** A context that does no work, to time the drawing loops themselves. */
function nullContext(): DrawContext {
	const nothing = () => {};
	return {
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		font: '',
		textAlign: 'start',
		textBaseline: 'alphabetic',
		fillRect: nothing,
		strokeRect: nothing,
		fillText: nothing,
		beginPath: nothing,
		moveTo: nothing,
		lineTo: nothing,
		closePath: nothing,
		arc: nothing,
		fill: nothing,
		stroke: nothing,
		setLineDash: nothing,
	} as unknown as DrawContext;
}

const colours: CanvasColours = {
	background: 'bg',
	grid: 'grid',
	glyph: 'glyph',
	cursor: 'cursor',
	selection: 'selection',
	preview: 'preview',
	item: 'item',
	spawn: 'spawn',
	start: 'start',
	ink: 'ink',
	ghostPaint: 'ghostPaint',
	ghostClear: 'ghostClear',
	ghostPlace: 'ghostPlace',
	ghostEdge: 'ghostEdge',
};

const options = (overrides: Partial<DrawOptions> = {}): DrawOptions => ({
	viewport: { zoom: 4, scrollX: 0, scrollY: 0 },
	window: { width: 400, height: 200 },
	tileColours: ['', 'fillColour', 'grassColour', 'spikeColour'],
	colours,
	cursor: null,
	selection: null,
	preview: [],
	...overrides,
});

describe('drawLevel', () => {
	it('clears to the background and draws row 0 at the bottom', () => {
		const view = levelView(4, 3);
		const { ctx, calls } = recorder();
		drawLevel(ctx, view, options({ window: { width: 64, height: 48 } }));
		expect(calls[0]).toMatchObject({ op: 'fillRect', args: [0, 0, 64, 48], fill: 'bg' });
		const floor = calls.filter((c) => c.op === 'fillRect' && c.fill === 'fillColour');
		expect(floor).toHaveLength(4);
		// Three rows of 16 px: row 0 is the last one, at y = 32.
		expect(floor.map((c) => c.args)).toEqual([0, 1, 2, 3].map((x) => [x * 16, 32, 16, 16]));
	});

	it('draws a glyph for each filled cell once cells are large enough, and none when small', () => {
		const view = levelView(4, 3, { start: null });
		const big = recorder();
		drawLevel(big.ctx, view, options({ viewport: { zoom: 4, scrollX: 0, scrollY: 0 } }));
		expect(big.calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])).toEqual([
			'F',
			'F',
			'F',
			'F',
		]);
		const small = recorder();
		drawLevel(small.ctx, view, options({ viewport: { zoom: 2, scrollX: 0, scrollY: 0 } }));
		expect(small.calls.some((c) => c.op === 'fillText')).toBe(false);
		expect(small.calls.some((c) => c.op === 'stroke')).toBe(false);
	});

	it('draws a grid at high zoom', () => {
		const { ctx, calls } = recorder();
		drawLevel(ctx, levelView(4, 3), options());
		expect(calls.some((c) => c.op === 'stroke')).toBe(true);
		expect(calls.filter((c) => c.op === 'lineTo').length).toBeGreaterThan(0);
	});

	it('draws items, spawns, the start, the selection and the cursor', () => {
		const view = levelView(6, 4, {
			items: [{ kind: 'cheezie', x: 2, y: 2 }],
			spawns: [{ kind: 'gloop', x: 4, y: null, dir: null, ride: false }],
			start: { x: 1, y: 1 },
		});
		const { ctx, calls } = recorder();
		drawLevel(
			ctx,
			view,
			options({
				cursor: { x: 0, y: 0 },
				selection: { x0: 1, y0: 1, x1: 2, y1: 2 },
				preview: [{ x: 3, y: 1 }],
			}),
		);
		expect(calls.some((c) => c.op === 'arc')).toBe(true);
		const letters = calls.filter((c) => c.op === 'fillText').map((c) => c.args[0]);
		expect(letters).toEqual(expect.arrayContaining(['C', 'G', 'B']));
		expect(calls.filter((c) => c.op === 'strokeRect').length).toBe(3);
		expect(calls.some((c) => c.op === 'fillRect' && c.fill === 'preview')).toBe(true);
	});

	it('draws ghosts as translucent cells by what they would do, and none unless given', () => {
		const view = levelView(6, 4, { start: null });
		const none = recorder();
		drawLevel(none.ctx, view, options());
		expect(none.calls.some((c) => c.fill === 'ghostPaint' || c.stroke === 'ghostClear')).toBe(
			false,
		);

		const { ctx, calls } = recorder();
		drawLevel(
			ctx,
			view,
			options({
				ghosts: [
					{ x: 1, y: 2, op: 'paint', word: 'grass' },
					{ x: 2, y: 2, op: 'clear', word: null },
					{ x: 3, y: 2, op: 'place', word: 'cheezie' },
					{ x: 90, y: 2, op: 'paint', word: 'grass' },
				],
			}),
		);
		// y = 2 of 4 rows is row 1 from the top: 16 px down, at 16 px a cell.
		const washes = calls.filter((c) => c.op === 'fillRect' && c.fill === 'ghostPaint');
		expect(washes.map((c) => c.args)).toEqual([[16, 16, 16, 16]]);
		expect(calls.some((c) => c.op === 'strokeRect' && c.stroke === 'ghostClear')).toBe(true);
		expect(calls.some((c) => c.op === 'arc')).toBe(true);
	});

	it('draws item ghosts as discs and a paste outline dashed', () => {
		const { ctx, calls } = recorder();
		drawLevel(
			ctx,
			levelView(6, 4),
			options({
				preview: [{ x: 1, y: 2 }],
				previewShape: 'item',
				paste: { x0: 2, y0: 1, x1: 4, y1: 2 },
			}),
		);
		expect(calls.some((c) => c.op === 'arc' && c.fill === 'preview')).toBe(true);
		expect(calls.some((c) => c.op === 'fillRect' && c.fill === 'preview')).toBe(false);
		const ops = calls.map((c) => c.op);
		const dash = ops.indexOf('setLineDash');
		expect(dash).toBeGreaterThan(-1);
		expect(ops[dash + 1]).toBe('strokeRect');
		expect(calls[ops.lastIndexOf('setLineDash')]?.args).toEqual([[]]);
	});

	it('skips cells that are scrolled out of the window', () => {
		const view = levelView(100, 4);
		const { ctx, calls } = recorder();
		drawLevel(
			ctx,
			view,
			options({
				viewport: { zoom: 4, scrollX: 16 * 90, scrollY: 0 },
				window: { width: 160, height: 64 },
			}),
		);
		const floor = calls.filter((c) => c.op === 'fillRect' && c.fill === 'fillColour');
		expect(floor.length).toBeLessThanOrEqual(11);
		expect(floor.length).toBeGreaterThan(0);
	});

	it('draws an enemy with no row on top of the ground in its column', () => {
		expect(restingRow(levelView(6, 4), 2)).toBe(1);
		const empty = levelView(6, 4, { cells: new Array<number>(24).fill(0) });
		expect(empty.cells.length).toBe(24);
		expect(restingRow(empty, 2)).toBe(0);
	});
});

describe('drawing speed', () => {
	// The whole of a 220 by 32 level (7,040 cells) at 1x, then a redraw after one edit, against a
	// context that does no work: this times our loops, not the browser's rasteriser. On the dev
	// machine each draw takes well under 1 ms; the bound is generous so a loaded CI machine passes.
	it('draws 7,040 cells and redraws after one edit within a generous bound', () => {
		const width = 220;
		const height = 32;
		const view = levelView(width, height);
		for (let i = 0; i < view.cells.length; i++) view.cells[i] = i % 4;
		const ctx = nullContext();
		const full = options({
			viewport: { zoom: 1, scrollX: 0, scrollY: 0 },
			window: { width: width * 4, height: height * 4 },
		});
		drawLevel(ctx, view, full);

		const start = performance.now();
		drawLevel(ctx, view, full);
		const first = performance.now() - start;

		view.cells[5 * width + 100] = 3;
		const again = performance.now();
		drawLevel(ctx, view, full);
		const afterEdit = performance.now() - again;

		expect(first).toBeLessThan(20);
		expect(afterEdit).toBeLessThan(20);
	});
});
