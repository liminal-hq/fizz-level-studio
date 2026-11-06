// Pure geometry for floating panels: sizes, limits and the moves a pointer or a key makes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Size {
	w: number;
	h: number;
}

/** The height a collapsed panel keeps: its header. */
export const HEADER_HEIGHT = 46;

/** How far an arrow key moves or resizes a panel, and how far with Shift held. */
export const KEY_STEP = 8;
export const KEY_STEP_LARGE = 32;

/** The height a panel takes up on screen: its header alone when it is collapsed. */
export function shownHeight(rect: Rect, collapsed: boolean): number {
	return collapsed ? HEADER_HEIGHT : rect.h;
}

/**
 * Keeps a size between a panel's minimum and the area. A minimum larger than the area wins, so a
 * panel in a very small window stays usable and is cut off rather than squashed.
 */
export function clampSize(size: Size, min: Size, area: Size): Size {
	return {
		w: Math.round(Math.max(min.w, Math.min(size.w, area.w))),
		h: Math.round(Math.max(min.h, Math.min(size.h, area.h))),
	};
}

/**
 * Moves `rect` so the part of it that shows lies inside the area, and keeps its size within the
 * minimum and the area. `collapsed` panels count as only their header tall, so they can sit
 * against the bottom edge.
 */
export function clampRect(rect: Rect, min: Size, area: Size, collapsed = false): Rect {
	const size = clampSize({ w: rect.w, h: rect.h }, min, area);
	const height = collapsed ? HEADER_HEIGHT : size.h;
	const x = Math.max(0, Math.min(Math.round(rect.x), area.w - size.w));
	const y = Math.max(0, Math.min(Math.round(rect.y), area.h - height));
	return { x, y, w: size.w, h: size.h };
}

/** `start` moved by a pointer's travel, kept inside the area. */
export function moveRect(
	start: Rect,
	dx: number,
	dy: number,
	min: Size,
	area: Size,
	collapsed = false,
): Rect {
	return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, min, area, collapsed);
}

/** The edge or corner a resize drag holds: letters name the edges that move with the pointer. */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const RESIZE_HANDLES: readonly ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** Moves one axis' edges: `from` and `to` are the near and far edges, one of them following `delta`. */
function resizeAxis(
	from: number,
	to: number,
	delta: number,
	moves: 'from' | 'to' | null,
	min: number,
	length: number,
): [number, number] {
	if (moves === 'to') {
		// The far edge stops at the minimum size and at the area; the near edge stays put.
		const lower = from + min;
		return [from, Math.max(lower, Math.min(to + delta, Math.max(length, lower)))];
	}
	if (moves === 'from') {
		// The near edge stops at the area and at the minimum size; the far edge stays put.
		const upper = Math.max(0, to - min);
		const next = Math.max(0, Math.min(from + delta, upper));
		// A far edge too close to the origin for the minimum size is pushed out, never a negative size.
		return [next, Math.max(to, next + min)];
	}
	return [from, to];
}

/**
 * `start` with the edges `handle` names moved by a pointer's travel. The opposite edges stay where
 * they are: the minimum size and the area stop the moving edges, never slide the panel. West and
 * north moves change the position as well as the size.
 */
export function resizeRectFrom(
	start: Rect,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	min: Size,
	area: Size,
): Rect {
	const [left, right] = resizeAxis(
		start.x,
		start.x + start.w,
		dx,
		handle.includes('w') ? 'from' : handle.includes('e') ? 'to' : null,
		min.w,
		area.w,
	);
	const [top, bottom] = resizeAxis(
		start.y,
		start.y + start.h,
		dy,
		handle.includes('n') ? 'from' : handle.includes('s') ? 'to' : null,
		min.h,
		area.h,
	);
	return clampRect(
		{
			x: Math.round(left),
			y: Math.round(top),
			w: Math.round(right - left),
			h: Math.round(bottom - top),
		},
		min,
		area,
	);
}

/** `start` with its bottom-right corner moved by a pointer's travel, down to the minimum size. */
export function resizeRect(start: Rect, dx: number, dy: number, min: Size, area: Size): Rect {
	return resizeRectFrom(start, 'se', dx, dy, min, area);
}

export interface KeyDelta {
	dx: number;
	dy: number;
}

/** The step an arrow key asks for, or null for any other key. Shift takes a larger step. */
export function keyDelta(key: string, shift: boolean): KeyDelta | null {
	const step = shift ? KEY_STEP_LARGE : KEY_STEP;
	switch (key) {
		case 'ArrowLeft':
			return { dx: -step, dy: 0 };
		case 'ArrowRight':
			return { dx: step, dy: 0 };
		case 'ArrowUp':
			return { dx: 0, dy: -step };
		case 'ArrowDown':
			return { dx: 0, dy: step };
		default:
			return null;
	}
}

/** True when the measured area is real: a window not yet laid out reports zero. */
export function isMeasured(area: Size): boolean {
	return area.w > 0 && area.h > 0;
}
