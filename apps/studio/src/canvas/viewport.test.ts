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
	fitCamera,
	fitZoom,
	frameViewport,
	moveCursor,
	NO_INSETS,
	panBy,
	pixelToCell,
	revealCell,
	uncoveredRect,
	zoomAt,
	type Size,
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

describe('panBy', () => {
	// Zoom 8 is 32 px a cell: the 20 by 10 level is 640 by 320 px in a 200 by 100 window.
	it('moves the map with the pointer, whatever the zoom', () => {
		expect(panBy(at(8, 100, 50), 30, 10, window, level)).toEqual(at(8, 70, 40));
		expect(panBy(at(8, 100, 50), -30, -10, window, level)).toEqual(at(8, 130, 60));
		// At 4x the level is 320 by 160, so the same drag shows the same pixels of it.
		expect(panBy(at(4, 100, 50), 30, 10, window, level)).toEqual(at(4, 70, 40));
	});

	it('stops at each edge of the level', () => {
		expect(panBy(at(8, 10, 10), 500, 500, window, level)).toEqual(at(8, 0, 0));
		expect(panBy(at(8, 430, 210), -500, -500, window, level)).toEqual(at(8, 440, 220));
	});

	it('leaves a level that fits centred', () => {
		const fits = at(1, -60, -30);
		expect(panBy(fits, 80, -80, window, level)).toEqual(fits);
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

describe('covered margins', () => {
	// A 300 by 200 frame with a 60 px dock on the left, 40 px on the right and 50 px along the
	// bottom leaves 200 by 150 uncovered, starting 60 px in.
	const frame = { width: 300, height: 200 };
	const insets = { top: 0, right: 40, bottom: 50, left: 60 };
	const visible = uncoveredRect(frame, insets);
	const seen: Size = { width: visible.width, height: visible.height };

	it('leaves the frame less its insets uncovered', () => {
		expect(visible).toEqual({ x: 60, y: 0, width: 200, height: 150 });
		expect(uncoveredRect(frame, NO_INSETS)).toEqual({ x: 0, y: 0, width: 300, height: 200 });
	});

	it('never reports a negative or out-of-frame rectangle', () => {
		const over = uncoveredRect(frame, { top: 0, right: 400, bottom: 900, left: 250 });
		expect(over).toEqual({ x: 250, y: 0, width: 0, height: 0 });
		expect(uncoveredRect(frame, { top: -5, right: -5, bottom: 0, left: -5 })).toEqual({
			x: 0,
			y: 0,
			width: 300,
			height: 200,
		});
	});

	it('centres a small level in the uncovered rectangle, not under the docks', () => {
		const camera = at(1);
		const framed = frameViewport({ ...camera, ...clampScroll(camera, seen, level) }, visible);
		// At 1x the 20 by 10 level is 80 by 40 pixels.
		const origin = cellOrigin({ x: 0, y: level.height - 1 }, framed, level);
		expect(origin).toEqual({ x: 60 + (200 - 80) / 2, y: (150 - 40) / 2 });
	});

	it('clamps the scroll so the level never slides under a dock out of reach', () => {
		// At 8x the level is 640 by 320; scrolled as far as it goes, its far corner meets the
		// uncovered rectangle's, not the frame's.
		const camera = at(8, 9999, 9999);
		const framed = frameViewport({ ...camera, ...clampScroll(camera, seen, level) }, visible);
		const far = cellOrigin({ x: level.width - 1, y: 0 }, framed, level);
		expect(far.x + 32).toBe(visible.x + visible.width);
		expect(far.y + 32).toBe(visible.y + visible.height);
		const near = at(8, -9999, -9999);
		const start = frameViewport({ ...near, ...clampScroll(near, seen, level) }, visible);
		expect(cellOrigin({ x: 0, y: level.height - 1 }, start, level)).toEqual({ x: 60, y: 0 });
	});

	it('finds the cell under a frame pixel through the frame viewport', () => {
		const camera = at(4, 16, 0);
		const framed = frameViewport(camera, visible);
		// The uncovered rectangle's top-left pixel shows the cell the camera's scroll names.
		expect(pixelToCell(visible.x, visible.y, framed, level)).toEqual(
			pixelToCell(0, 0, camera, level),
		);
		// A pixel under the left dock still maps to the cell drawn there.
		expect(pixelToCell(10, 0, framed, level)).toEqual({ x: -3, y: level.height - 1 });
	});

	it('zooms about the pointer in uncovered coordinates', () => {
		const before = at(4, 40, 20);
		const px = 150;
		const py = 80;
		const cell = pixelToCell(px, py, frameViewport(before, visible), level);
		const after = zoomAt(before, 8, px - visible.x, py - visible.y, seen, level);
		expect(pixelToCell(px, py, frameViewport(after, visible), level)).toEqual(cell);
	});
});

describe('fitZoom', () => {
	const cells = { width: 12, height: 8 };

	it('is the largest whole zoom at which the level fits the window', () => {
		// 4 px a cell at 1x: each zoom step adds 48 by 32 px to a 12 by 8 level.
		expect(fitZoom(cells, { width: 640, height: 384 })).toBe(12);
		expect(fitZoom(cells, { width: 48, height: 32 })).toBe(1);
		expect(fitZoom(cells, { width: 96, height: 32 })).toBe(1);
		expect(fitZoom(cells, { width: 96, height: 64 })).toBe(2);
	});

	it('stops at 16x however much room there is', () => {
		expect(fitZoom(cells, { width: 5000, height: 5000 })).toBe(16);
	});

	it('is 1x for a level too big for the window, and for an empty one', () => {
		expect(fitZoom(cells, { width: 10, height: 10 })).toBe(1);
		expect(fitZoom({ width: 0, height: 0 }, { width: 640, height: 384 })).toBe(1);
	});

	it('centres the fitted level, and the middle of a level that is too big', () => {
		const fit = fitCamera(cells, { width: 640, height: 384 });
		expect(fit.zoom).toBe(12);
		expect(fit.scrollX).toBe((12 * 48 - 640) / 2);
		// Clamping leaves a fitted camera where it is (it is already centred).
		const clamped = clampScroll(fit, { width: 640, height: 384 }, cells);
		expect(clamped.scrollX).toBe(fit.scrollX);
		expect(Math.abs(clamped.scrollY - fit.scrollY)).toBe(0);
		const big = fitCamera({ width: 400, height: 300 }, { width: 640, height: 384 });
		expect(big.zoom).toBe(1);
		expect(big.scrollX).toBe((400 * 4 - 640) / 2);
	});
});
