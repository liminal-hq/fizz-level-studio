// Tests for the floating panels' geometry
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	HEADER_HEIGHT,
	clampRect,
	clampSize,
	isMeasured,
	keyDelta,
	moveRect,
	resizeRect,
	resizeRectFrom,
	type ResizeHandle,
} from './panelGeometry';

const area = { w: 1000, h: 600 };
const min = { w: 200, h: 120 };

describe('clampSize', () => {
	it('holds a size between the minimum and the area', () => {
		expect(clampSize({ w: 50, h: 50 }, min, area)).toEqual({ w: 200, h: 120 });
		expect(clampSize({ w: 5000, h: 5000 }, min, area)).toEqual(area);
		expect(clampSize({ w: 300, h: 200 }, min, area)).toEqual({ w: 300, h: 200 });
	});

	it('lets the minimum win in an area smaller than it', () => {
		expect(clampSize({ w: 300, h: 300 }, min, { w: 100, h: 100 })).toEqual(min);
	});
});

describe('clampRect', () => {
	it('pulls a panel back inside the area', () => {
		expect(clampRect({ x: -20, y: -5, w: 300, h: 200 }, min, area)).toEqual({
			x: 0,
			y: 0,
			w: 300,
			h: 200,
		});
		expect(clampRect({ x: 900, y: 550, w: 300, h: 200 }, min, area)).toEqual({
			x: 700,
			y: 400,
			w: 300,
			h: 200,
		});
	});

	it('lets a collapsed panel reach the bottom edge by its header', () => {
		const rect = clampRect({ x: 0, y: 590, w: 300, h: 200 }, min, area, true);
		expect(rect.y).toBe(area.h - HEADER_HEIGHT);
		expect(rect.h).toBe(200);
	});

	it('rounds to whole pixels', () => {
		expect(clampRect({ x: 10.6, y: 3.2, w: 300, h: 200 }, min, area)).toMatchObject({
			x: 11,
			y: 3,
		});
	});
});

describe('moveRect', () => {
	it('moves by the pointer travel and stops at the edges', () => {
		const start = { x: 100, y: 100, w: 300, h: 200 };
		expect(moveRect(start, 50, -30, min, area)).toMatchObject({ x: 150, y: 70 });
		expect(moveRect(start, 5000, 5000, min, area)).toMatchObject({ x: 700, y: 400 });
		expect(moveRect(start, -5000, -5000, min, area)).toMatchObject({ x: 0, y: 0 });
	});
});

describe('resizeRect', () => {
	const start = { x: 100, y: 100, w: 300, h: 200 };

	it('grows and shrinks from the corner', () => {
		expect(resizeRect(start, 40, 20, min, area)).toEqual({ x: 100, y: 100, w: 340, h: 220 });
		expect(resizeRect(start, -40, -20, min, area)).toEqual({ x: 100, y: 100, w: 260, h: 180 });
	});

	it('stops at the minimum size', () => {
		expect(resizeRect(start, -5000, -5000, min, area)).toEqual({ x: 100, y: 100, ...min });
	});

	it('stops at the area edge', () => {
		expect(resizeRect(start, 5000, 5000, min, area)).toEqual({ x: 100, y: 100, w: 900, h: 500 });
	});
});

describe('resizeRectFrom', () => {
	const start = { x: 100, y: 100, w: 300, h: 200 };

	it('moves only the east edge for e', () => {
		expect(resizeRectFrom(start, 'e', 40, 99, min, area)).toEqual({ ...start, w: 340 });
	});

	it('moves only the south edge for s', () => {
		expect(resizeRectFrom(start, 's', 99, 20, min, area)).toEqual({ ...start, h: 220 });
	});

	it('moves the west edge and the position together, keeping the right edge', () => {
		expect(resizeRectFrom(start, 'w', -40, 99, min, area)).toEqual({
			x: 60,
			y: 100,
			w: 340,
			h: 200,
		});
		expect(resizeRectFrom(start, 'w', 40, 99, min, area)).toEqual({
			x: 140,
			y: 100,
			w: 260,
			h: 200,
		});
	});

	it('moves the north edge and the position together, keeping the bottom edge', () => {
		expect(resizeRectFrom(start, 'n', 99, -30, min, area)).toEqual({
			x: 100,
			y: 70,
			w: 300,
			h: 230,
		});
		expect(resizeRectFrom(start, 'n', 99, 30, min, area)).toEqual({
			x: 100,
			y: 130,
			w: 300,
			h: 170,
		});
	});

	it('moves two edges from a corner', () => {
		expect(resizeRectFrom(start, 'ne', 10, -10, min, area)).toEqual({
			x: 100,
			y: 90,
			w: 310,
			h: 210,
		});
		expect(resizeRectFrom(start, 'nw', -10, -10, min, area)).toEqual({
			x: 90,
			y: 90,
			w: 310,
			h: 210,
		});
		expect(resizeRectFrom(start, 'se', 10, 10, min, area)).toEqual({
			x: 100,
			y: 100,
			w: 310,
			h: 210,
		});
		expect(resizeRectFrom(start, 'sw', -10, 10, min, area)).toEqual({
			x: 90,
			y: 100,
			w: 310,
			h: 210,
		});
	});

	it('holds the opposite edge at the minimum size', () => {
		const right = start.x + start.w;
		const bottom = start.y + start.h;
		const w = resizeRectFrom(start, 'w', 5000, 0, min, area);
		expect(w).toEqual({ x: right - min.w, y: 100, w: min.w, h: 200 });
		const n = resizeRectFrom(start, 'n', 0, 5000, min, area);
		expect(n).toEqual({ x: 100, y: bottom - min.h, w: 300, h: min.h });
		const nw = resizeRectFrom(start, 'nw', 5000, 5000, min, area);
		expect(nw).toEqual({ x: right - min.w, y: bottom - min.h, ...min });
		expect(resizeRectFrom(start, 'e', -5000, 0, min, area)).toEqual({ ...start, w: min.w });
		expect(resizeRectFrom(start, 's', 0, -5000, min, area)).toEqual({ ...start, h: min.h });
		expect(resizeRectFrom(start, 'ne', -5000, 5000, min, area)).toEqual({
			x: 100,
			y: bottom - min.h,
			...min,
		});
		expect(resizeRectFrom(start, 'sw', 5000, -5000, min, area)).toEqual({
			x: right - min.w,
			y: 100,
			...min,
		});
	});

	it('stops the moving edges at the area, keeping the opposite edges', () => {
		expect(resizeRectFrom(start, 'w', -5000, 0, min, area)).toEqual({
			x: 0,
			y: 100,
			w: 400,
			h: 200,
		});
		expect(resizeRectFrom(start, 'n', 0, -5000, min, area)).toEqual({
			x: 100,
			y: 0,
			w: 300,
			h: 300,
		});
		expect(resizeRectFrom(start, 'e', 5000, 0, min, area)).toEqual({ ...start, w: 900 });
		expect(resizeRectFrom(start, 's', 0, 5000, min, area)).toEqual({ ...start, h: 500 });
		expect(resizeRectFrom(start, 'nw', -5000, -5000, min, area)).toEqual({
			x: 0,
			y: 0,
			w: 400,
			h: 300,
		});
		expect(resizeRectFrom(start, 'se', 5000, 5000, min, area)).toEqual({
			...start,
			w: 900,
			h: 500,
		});
	});

	it('never gives a negative or sub-minimum size, even in an area smaller than the minimum', () => {
		const tiny = { w: 100, h: 80 };
		for (const handle of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeHandle[]) {
			for (const [dx, dy] of [
				[5000, 5000],
				[-5000, -5000],
				[5000, -5000],
				[-5000, 5000],
			] as const) {
				const out = resizeRectFrom({ x: 0, y: 0, w: 200, h: 120 }, handle, dx, dy, min, tiny);
				expect(out.w).toBeGreaterThanOrEqual(min.w);
				expect(out.h).toBeGreaterThanOrEqual(min.h);
				expect(out.x).toBeGreaterThanOrEqual(0);
				expect(out.y).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it('matches resizeRect for the south-east corner', () => {
		for (const [dx, dy] of [
			[40, 20],
			[-5000, -5000],
			[5000, 5000],
		] as const) {
			expect(resizeRectFrom(start, 'se', dx, dy, min, area)).toEqual(
				resizeRect(start, dx, dy, min, area),
			);
		}
	});
});

describe('keyDelta', () => {
	it('maps the arrow keys to steps, larger with Shift', () => {
		expect(keyDelta('ArrowLeft', false)).toEqual({ dx: -8, dy: 0 });
		expect(keyDelta('ArrowDown', true)).toEqual({ dx: 0, dy: 32 });
		expect(keyDelta('a', false)).toBeNull();
	});
});

describe('isMeasured', () => {
	it('is false for an area not yet laid out', () => {
		expect(isMeasured({ w: 0, h: 0 })).toBe(false);
		expect(isMeasured(area)).toBe(true);
	});
});
