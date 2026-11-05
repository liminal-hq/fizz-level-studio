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
