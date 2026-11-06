// Pure snapping for floating panels: to the area's edges, an inner margin and other panels' edges
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { HEADER_HEIGHT, clampRect, type Rect, type ResizeHandle, type Size } from './panelGeometry';

/** How close an edge must come to a target before it locks to it. */
export const SNAP_DISTANCE = 8;

/** The gap a panel keeps from the area's edge when it snaps to the margin. */
export const SNAP_MARGIN = 8;

/** A line to draw where an edge is locked: a vertical line at `at` px or a horizontal one. */
export interface Guide {
	axis: 'x' | 'y';
	at: number;
}

export interface Snapped {
	rect: Rect;
	guides: Guide[];
}

interface Nearest {
	delta: number;
	at: number;
}

/** The nearest target to any of `edges`, within the snap distance, as how far to shift. */
function nearest(edges: readonly number[], targets: readonly number[]): Nearest | null {
	let best: Nearest | null = null;
	for (const edge of edges) {
		for (const target of targets) {
			const delta = target - edge;
			if (Math.abs(delta) <= SNAP_DISTANCE && (!best || Math.abs(delta) < Math.abs(best.delta))) {
				best = { delta, at: target };
			}
		}
	}
	return best;
}

/** The places a left or top edge locks to along one axis. */
function startTargets(others: readonly [number, number][]): number[] {
	return [0, SNAP_MARGIN, ...others.flatMap(([from, to]) => [from, to])];
}

/** The places a right or bottom edge locks to along one axis. */
function endTargets(length: number, others: readonly [number, number][]): number[] {
	return [length, length - SNAP_MARGIN, ...others.flatMap(([from, to]) => [from, to])];
}

const spans = (others: readonly Rect[], axis: 'x' | 'y'): [number, number][] =>
	others.map((o) => (axis === 'x' ? [o.x, o.x + o.w] : [o.y, o.y + o.h]));

/**
 * A moved panel's rectangle with its edges locked to whatever is within the snap distance: the
 * area's edges, the margin inside them and `others`' edges (their rectangles as they show, so a
 * collapsed panel is only its header tall). `height` is the panel's shown height. Each axis snaps
 * on its own and reports the line it locked to.
 */
export function snapMove(rect: Rect, height: number, area: Size, others: readonly Rect[]): Snapped {
	const guides: Guide[] = [];
	let { x, y } = rect;
	const sx = nearest(
		[rect.x, rect.x + rect.w],
		[...startTargets(spans(others, 'x')), ...endTargets(area.w, spans(others, 'x'))],
	);
	if (sx) {
		x = rect.x + sx.delta;
		guides.push({ axis: 'x', at: sx.at });
	}
	const sy = nearest(
		[rect.y, rect.y + height],
		[...startTargets(spans(others, 'y')), ...endTargets(area.h, spans(others, 'y'))],
	);
	if (sy) {
		y = rect.y + sy.delta;
		guides.push({ axis: 'y', at: sy.at });
	}
	return { rect: { ...rect, x, y }, guides };
}

/**
 * A resized panel's rectangle with the edges `handle` moves locked to the same kinds of target:
 * the right and bottom edges to the far targets, the left and top edges to the near ones. The
 * edges that stay where they are never snap. Defaults to the bottom-right corner.
 */
export function snapResize(
	rect: Rect,
	area: Size,
	others: readonly Rect[],
	handle: ResizeHandle = 'se',
): Snapped {
	const guides: Guide[] = [];
	let { x, y, w, h } = rect;
	if (handle.includes('e')) {
		const sx = nearest([rect.x + rect.w], endTargets(area.w, spans(others, 'x')));
		if (sx) {
			w = rect.w + sx.delta;
			guides.push({ axis: 'x', at: sx.at });
		}
	} else if (handle.includes('w')) {
		const sx = nearest([rect.x], startTargets(spans(others, 'x')));
		if (sx) {
			x = rect.x + sx.delta;
			w = rect.w - sx.delta;
			guides.push({ axis: 'x', at: sx.at });
		}
	}
	if (handle.includes('s')) {
		const sy = nearest([rect.y + rect.h], endTargets(area.h, spans(others, 'y')));
		if (sy) {
			h = rect.h + sy.delta;
			guides.push({ axis: 'y', at: sy.at });
		}
	} else if (handle.includes('n')) {
		const sy = nearest([rect.y], startTargets(spans(others, 'y')));
		if (sy) {
			y = rect.y + sy.delta;
			h = rect.h - sy.delta;
			guides.push({ axis: 'y', at: sy.at });
		}
	}
	return { rect: { x, y, w, h }, guides };
}

/** Snaps a move, then keeps the result inside the area and above the minimum size. */
export function snapMoveWithin(
	rect: Rect,
	min: Size,
	area: Size,
	others: readonly Rect[],
	collapsed: boolean,
): Snapped {
	const height = collapsed ? HEADER_HEIGHT : rect.h;
	const snapped = snapMove(rect, height, area, others);
	return { rect: clampRect(snapped.rect, min, area, collapsed), guides: snapped.guides };
}

/** Ctrl+Shift+0 (Command on a Mac) resets the layout. */
export function isResetLayoutKey(
	event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): boolean {
	if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return false;
	return event.code === 'Digit0' || event.key === '0' || event.key === ')';
}
