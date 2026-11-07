// Canvas geometry: zoom, scroll, cell and pixel conversion and the keyboard cursor
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Cell } from '../tools/tool';

/** Pixels per cell at 1x. Zoom is a whole number from 1 to 16. */
export const BASE_CELL_PX = 4;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 16;
/** The grid appears once a cell is at least this many pixels across. */
export const GRID_MIN_CELL_PX = 12;
/** Glyphs appear once a cell is at least this many pixels across. */
export const GLYPH_MIN_CELL_PX = 12;
export const DEFAULT_ZOOM = 4;

/** Where the canvas looks: a zoom and the pixel offset of the level's top-left corner. */
export interface Viewport {
	zoom: number;
	scrollX: number;
	scrollY: number;
}

export interface Size {
	width: number;
	height: number;
}

/**
 * How far in from each edge of the canvas's frame something lies over it (the docks, their rails
 * and the status line), in pixels. The canvas draws under them, but the camera treats only the
 * rectangle they leave as the window.
 */
export interface Insets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** A rectangle of the frame, in pixels from its top-left corner. */
export interface FrameRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * The part of the frame nothing covers: the frame less its insets, never negative. An inset larger
 * than the frame is held to it, so the rectangle always lies inside the frame.
 */
export function uncoveredRect(frame: Size, insets: Insets): FrameRect {
	const left = Math.min(Math.max(0, insets.left), frame.width);
	const top = Math.min(Math.max(0, insets.top), frame.height);
	const right = Math.min(Math.max(0, insets.right), frame.width - left);
	const bottom = Math.min(Math.max(0, insets.bottom), frame.height - top);
	return {
		x: left,
		y: top,
		width: frame.width - left - right,
		height: frame.height - top - bottom,
	};
}

/**
 * The camera's viewport as the whole frame sees it. The camera fits, clamps and centres against the
 * uncovered rectangle and measures its scroll from that rectangle's top-left corner, so the frame,
 * which starts `uncovered.x` and `uncovered.y` pixels further out, scrolls that much less. Drawing
 * and the pointer's cell use this one, with pixels measured from the frame's own corner.
 */
export function frameViewport(viewport: Viewport, uncovered: FrameRect): Viewport {
	return {
		zoom: viewport.zoom,
		scrollX: viewport.scrollX - uncovered.x,
		scrollY: viewport.scrollY - uncovered.y,
	};
}

/**
 * The largest whole zoom, from 1 to 16, at which the whole level fits in `window` (in pixels). A level
 * too large for the window even at 1x is shown at 1x (and centred by `fitCamera`).
 */
export function fitZoom(level: Size, window: Size): number {
	if (level.width <= 0 || level.height <= 0) return MIN_ZOOM;
	for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom -= 1) {
		const world = worldSize(level, zoom);
		if (world.width <= window.width && world.height <= window.height) return zoom;
	}
	return MIN_ZOOM;
}

/**
 * The camera that fits the level: `fitZoom`, with the level centred in the window (a level too large
 * for the window is centred too, so its middle is what shows).
 */
export function fitCamera(level: Size, window: Size): Viewport {
	const zoom = fitZoom(level, window);
	const world = worldSize(level, zoom);
	return {
		zoom,
		scrollX: (world.width - window.width) / 2 || 0,
		scrollY: (world.height - window.height) / 2 || 0,
	};
}

export function clampZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
}

export function cellPx(zoom: number): number {
	return clampZoom(zoom) * BASE_CELL_PX;
}

/** The level's size in pixels at `zoom`. */
export function worldSize(level: Size, zoom: number): Size {
	const size = cellPx(zoom);
	return { width: level.width * size, height: level.height * size };
}

/** Keeps a scroll offset inside the level; a level smaller than the window is centred. */
export function clampScroll(
	viewport: Viewport,
	window: Size,
	level: Size,
): Pick<Viewport, 'scrollX' | 'scrollY'> {
	const world = worldSize(level, viewport.zoom);
	const clamp = (value: number, inner: number, outer: number) =>
		outer <= inner ? -(inner - outer) / 2 : Math.min(Math.max(value, 0), outer - inner);
	return {
		scrollX: clamp(viewport.scrollX, window.width, world.width),
		scrollY: clamp(viewport.scrollY, window.height, world.height),
	};
}

/** The cell under a pixel of the canvas (row 0 is the bottom); it may lie outside the level. */
export function pixelToCell(px: number, py: number, viewport: Viewport, level: Size): Cell {
	const size = cellPx(viewport.zoom);
	return {
		x: Math.floor((px + viewport.scrollX) / size),
		y: level.height - 1 - Math.floor((py + viewport.scrollY) / size),
	};
}

/** The top-left pixel of a cell on the canvas. */
export function cellOrigin(cell: Cell, viewport: Viewport, level: Size): { x: number; y: number } {
	const size = cellPx(viewport.zoom);
	return {
		x: cell.x * size - viewport.scrollX,
		y: (level.height - 1 - cell.y) * size - viewport.scrollY,
	};
}

/** Changes the zoom so the level point under the pixel `(px, py)` stays under it. */
export function zoomAt(
	viewport: Viewport,
	zoom: number,
	px: number,
	py: number,
	window: Size,
	level: Size,
): Viewport {
	const next = clampZoom(zoom);
	if (next === viewport.zoom) return viewport;
	const ratio = cellPx(next) / cellPx(viewport.zoom);
	const moved: Viewport = {
		zoom: next,
		scrollX: (px + viewport.scrollX) * ratio - px,
		scrollY: (py + viewport.scrollY) * ratio - py,
	};
	return { ...moved, ...clampScroll(moved, window, level) };
}

/** Scrolls the least amount that brings a cell fully into the window. */
export function revealCell(viewport: Viewport, cell: Cell, window: Size, level: Size): Viewport {
	const size = cellPx(viewport.zoom);
	const left = cell.x * size;
	const top = (level.height - 1 - cell.y) * size;
	let { scrollX, scrollY } = viewport;
	if (left < scrollX) scrollX = left;
	else if (left + size > scrollX + window.width) scrollX = left + size - window.width;
	if (top < scrollY) scrollY = top;
	else if (top + size > scrollY + window.height) scrollY = top + size - window.height;
	return { ...viewport, ...clampScroll({ ...viewport, scrollX, scrollY }, window, level) };
}

/**
 * Moves the cell cursor for a key: the arrows step one cell (Up goes towards the top of the level,
 * where `y` is larger), Home and End jump to the ends of the row. Anything else, or a move past the
 * edge, leaves the cursor where it is.
 */
export function moveCursor(cursor: Cell, key: string, level: Size): Cell {
	const clampX = (x: number) => Math.min(Math.max(x, 0), level.width - 1);
	const clampY = (y: number) => Math.min(Math.max(y, 0), level.height - 1);
	switch (key) {
		case 'ArrowLeft':
			return { x: clampX(cursor.x - 1), y: cursor.y };
		case 'ArrowRight':
			return { x: clampX(cursor.x + 1), y: cursor.y };
		case 'ArrowUp':
			return { x: cursor.x, y: clampY(cursor.y + 1) };
		case 'ArrowDown':
			return { x: cursor.x, y: clampY(cursor.y - 1) };
		case 'Home':
			return { x: 0, y: cursor.y };
		case 'End':
			return { x: level.width - 1, y: cursor.y };
		default:
			return cursor;
	}
}
