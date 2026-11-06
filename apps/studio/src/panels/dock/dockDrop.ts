// Where a dragged panel would land: which dock, which tab group, which place among the group's panels
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The pointer's position is read against the rectangles of the elements the dock draws: a
// `[data-drop-zone]` for each dock (present even when the dock is empty or folded), the dock's
// `[data-rail]` with a `[data-rail-item]` for each panel (where the place among a group's panels
// is chosen), and a `[data-group-zone]` for each tab group. The functions here are pure apart from
// reading those rectangles, so the controller and the tests share them.

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { clampRect, type Rect, type Size } from '../float/panelGeometry';
import { dockPanel, type DockPlacement } from './dockLayout';
import { ZONE_IDS, zoneOf } from './dockModel';

export interface Point {
	x: number;
	y: number;
}

/**
 * The insertion line drawn on a rail, in window coordinates: upright on the bottom rail, and
 * across a side rail, where it has a width (and no height).
 */
export interface InsertionLine {
	x: number;
	top: number;
	height: number;
	width?: number;
}

export type DropTarget =
	| {
			kind: 'zone';
			zone: ZoneId;
			/** The tab group under the pointer, or null when the dock has none (it is empty or folded). */
			group: number | null;
			/** The place among the group's other tabs, or null for the end. */
			index: number | null;
			/** Where the dragged panel would sit, when the pointer is on the dock's rail. */
			line: InsertionLine | null;
	  }
	| { kind: 'level' };

interface Span {
	left: number;
	right: number;
}

/** How many of the other tabs sit left of `x`: the place the dragged tab would take among them. */
export function insertionIndex(tabs: readonly Span[], x: number): number {
	return tabs.filter((tab) => (tab.left + tab.right) / 2 < x).length;
}

/** The x of the line that shows `index`: just before that tab, or just after the last one. */
export function insertionX(tabs: readonly Span[], index: number, stripLeft: number): number {
	if (tabs.length === 0) return stripLeft + 4;
	if (index < tabs.length) return tabs[index]!.left - 3;
	return tabs[tabs.length - 1]!.right + 2;
}

function contains(
	rect: DOMRect | Rect | { left: number; right: number; top: number; bottom: number },
	p: Point,
) {
	const r = rect as { left: number; right: number; top: number; bottom: number };
	return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

interface RailEntry {
	group: number;
	rect: DOMRect;
}

/**
 * The place on a dock's rail under the pointer: before the first entry whose middle is past the
 * pointer, in that entry's group (or after the last entry, in its group). `dragged` is left out.
 */
function railTarget(
	zone: ZoneId,
	rail: HTMLElement,
	railRect: DOMRect,
	point: Point,
	dragged: string,
): DropTarget {
	const across = zone !== 'bottom';
	const entries: RailEntry[] = [...rail.querySelectorAll<HTMLElement>('[data-rail-item]')]
		.filter((entry) => entry.dataset.railItem !== dragged)
		.map((entry) => ({
			group: Number(entry.dataset.railGroup ?? 0),
			rect: entry.getBoundingClientRect(),
		}));
	if (entries.length === 0) return { kind: 'zone', zone, group: null, index: null, line: null };
	const middle = (r: DOMRect) => (across ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2);
	const at = across ? point.y : point.x;
	const group = (entries.find((e) => middle(e.rect) >= at) ?? entries[entries.length - 1]!).group;
	const mates = entries.filter((e) => e.group === group).map((e) => e.rect);
	const index = mates.filter((r) => middle(r) < at).length;
	if (!across) {
		return {
			kind: 'zone',
			zone,
			group,
			index,
			line: {
				x: insertionX(mates, index, railRect.left),
				top: railRect.top + 2,
				height: Math.max(0, railRect.height - 4),
			},
		};
	}
	const y = index < mates.length ? mates[index]!.top - 2 : mates[mates.length - 1]!.bottom + 2;
	return {
		kind: 'zone',
		zone,
		group,
		index,
		line: { x: railRect.left + 2, top: y, height: 0, width: Math.max(0, railRect.width - 4) },
	};
}

/**
 * What the pointer is over: a dock (with the tab group, and the place when over its rail), the
 * level area, or nothing (outside the workspace, where a drop cancels). `dragged` is left out of
 * the panels the place is counted among.
 */
export function locateDropTarget(
	root: HTMLElement,
	point: Point,
	dragged: string,
): DropTarget | null {
	if (!contains(root.getBoundingClientRect(), point)) return null;
	for (const zone of ZONE_IDS) {
		const slot = root.querySelector<HTMLElement>(`[data-drop-zone="${zone}"]`);
		if (!slot || !contains(slot.getBoundingClientRect(), point)) continue;
		const rail = root.querySelector<HTMLElement>(`[data-rail="${zone}"]`);
		const railRect = rail?.getBoundingClientRect();
		if (rail && railRect && contains(railRect, point)) {
			return railTarget(zone, rail, railRect, point, dragged);
		}
		const groups = [...root.querySelectorAll<HTMLElement>(`[data-group-zone="${zone}"]`)];
		const at = groups.findIndex((group) => contains(group.getBoundingClientRect(), point));
		return { kind: 'zone', zone, group: at < 0 ? null : at, index: null, line: null };
	}
	return { kind: 'level' };
}

/**
 * Docks a panel where a drop put it. The group is counted as the dock was drawn, so when the panel
 * was alone in a group of this dock (and so takes that group with it) a later group shifts down by
 * one; dropping such a panel on its own group changes nothing.
 */
export function dropOnZone(
	workspace: Workspace,
	id: string,
	zone: ZoneId,
	group: number | null,
	index: number | null,
): Workspace {
	let target = group;
	if (target !== null && zoneOf(workspace, id) === zone) {
		const groups = workspace.zones[zone].groups;
		const own = groups.findIndex((g) => g.tabs.includes(id));
		if (own >= 0 && groups[own]!.tabs.length === 1) {
			if (target === own) return workspace;
			if (target > own) target -= 1;
		}
	}
	const placement: DockPlacement = {};
	if (target !== null) {
		placement.group = target;
		if (index !== null) placement.index = index;
	}
	return dockPanel(workspace, id, zone, placement);
}

/**
 * The rectangle a panel floats at when dropped with the pointer at `point`: its remembered size,
 * centred across the pointer and a little below it, kept inside the area. `origin` is the area's
 * top left in window coordinates.
 */
export function floatRectAt(point: Point, origin: Point, size: Size, min: Size, area: Size): Rect {
	return clampRect(
		{
			x: point.x - origin.x - size.w / 2,
			y: point.y - origin.y - 16,
			w: size.w,
			h: size.h,
		},
		min,
		area,
	);
}
