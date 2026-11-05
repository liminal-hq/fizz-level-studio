// Tests for the canvas geometry and the cell cursor
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	cellOrigin,
	cellPx,
	clampScroll,
	clampZoom,
	moveCursor,
	pixelToCell,
	revealCell,
	zoomAt,
	type Viewport,
} from './viewport';

const level = { width: 20, height: 10 };
const window = { width: 200, height: 100 };
const at = (zoom: number, scrollX = 0, scrollY = 0): Viewport => ({ zoom, scrollX, scrollY });

describe('zoom', () => {
	it('rounds to whole steps within 1x to 16x', () => {
		expect(clampZoom(0)).toBe(1);
		expect(clampZoom(2.4)).toBe(2);
		expect(clampZoom(99)).toBe(16);
		expect(cellPx(4)).toBe(16);
	});

	it('keeps the point under the pointer fixed', () => {
		const before = at(4, 40, 20);
		const cell = pixelToCell(90, 50, before, level);
		const after = zoomAt(before, 8, 90, 50, window, level);
		expect(after.zoom).toBe(8);
		expect(pixelToCell(90, 50, after, level)).toEqual(cell);
	});

	it('does nothing at the limits', () => {
		const top = at(16);
		expect(zoomAt(top, 17, 0, 0, window, level)).toBe(top);
	});
});

describe('scroll', () => {
	it('clamps to the level and centres a level smaller than the window', () => {
		expect(clampScroll(at(8, 9999, -50), window, level)).toEqual({
			scrollX: 640 - 200,
			scrollY: 0,
		});
		expect(clampScroll(at(1, 0, 0), window, level)).toEqual({ scrollX: -60, scrollY: -30 });
	});

	it('reveals a cell the least amount', () => {
		const view = at(8, 0, 0);
		const moved = revealCell(view, { x: 15, y: 9 }, window, level);
		expect(moved.scrollX).toBe(15 * 32 + 32 - 200);
		expect(moved.scrollY).toBe(0);
		expect(revealCell(moved, { x: 15, y: 9 }, window, level)).toEqual(moved);
	});
});

describe('cells and pixels', () => {
	it('puts row 0 at the bottom', () => {
		const view = at(4);
		expect(pixelToCell(0, 0, view, level)).toEqual({ x: 0, y: 9 });
		expect(pixelToCell(17, 159, view, level)).toEqual({ x: 1, y: 0 });
		expect(cellOrigin({ x: 1, y: 0 }, view, level)).toEqual({ x: 16, y: 144 });
	});

	it('round-trips a cell through its origin', () => {
		const view = at(6, 30, 12);
		const origin = cellOrigin({ x: 7, y: 3 }, view, level);
		expect(pixelToCell(origin.x + 1, origin.y + 1, view, level)).toEqual({ x: 7, y: 3 });
	});
});

describe('moveCursor', () => {
	it('steps with the arrows, Up towards larger y', () => {
		expect(moveCursor({ x: 5, y: 5 }, 'ArrowRight', level)).toEqual({ x: 6, y: 5 });
		expect(moveCursor({ x: 5, y: 5 }, 'ArrowLeft', level)).toEqual({ x: 4, y: 5 });
		expect(moveCursor({ x: 5, y: 5 }, 'ArrowUp', level)).toEqual({ x: 5, y: 6 });
		expect(moveCursor({ x: 5, y: 5 }, 'ArrowDown', level)).toEqual({ x: 5, y: 4 });
	});

	it('stops at the edges', () => {
		expect(moveCursor({ x: 0, y: 0 }, 'ArrowLeft', level)).toEqual({ x: 0, y: 0 });
		expect(moveCursor({ x: 0, y: 0 }, 'ArrowDown', level)).toEqual({ x: 0, y: 0 });
		expect(moveCursor({ x: 19, y: 9 }, 'ArrowRight', level)).toEqual({ x: 19, y: 9 });
		expect(moveCursor({ x: 19, y: 9 }, 'ArrowUp', level)).toEqual({ x: 19, y: 9 });
	});

	it('jumps to the row ends with Home and End', () => {
		expect(moveCursor({ x: 7, y: 3 }, 'Home', level)).toEqual({ x: 0, y: 3 });
		expect(moveCursor({ x: 7, y: 3 }, 'End', level)).toEqual({ x: 19, y: 3 });
	});

	it('ignores other keys', () => {
		const cursor = { x: 2, y: 2 };
		expect(moveCursor(cursor, 'a', level)).toBe(cursor);
	});
});
