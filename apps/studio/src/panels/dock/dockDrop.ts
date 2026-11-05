// Where a dragged panel would land: which dock, which tab group, which place among the tabs
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The pointer's position is read against the rectangles of the elements the dock draws: a
// `[data-drop-zone]` for each dock (present even when the dock is empty or folded), a
// `[data-group-zone]` for each tab group and a `[data-strip]` for each group's tab strip. The
// functions here are pure apart from reading those rectangles, so the controller and the tests
// share them.

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { clampRect, type Rect, type Size } from '../float/panelGeometry';
import { dockPanel, type DockPlacement } from './dockLayout';
import { ZONE_IDS, zoneOf } from './dockModel';

export interface Point {
	x: number;
	y: number;
}

/** The vertical insertion line drawn in a tab strip, in window coordinates. */
export interface InsertionLine {
	x: number;
	top: number;
	height: number;
}

export type DropTarget =
	| {
			kind: 'zone';
			zone: ZoneId;
			/** The tab group under the pointer, or null when the dock has none (it is empty or folded). */
			group: number | null;
			/** The place among the group's other tabs, or null for the end. */
			index: number | null;
			/** Where the dragged tab would sit, when the pointer is in a tab strip. */
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

/**
 * What the pointer is over: a dock (with the tab group and place when over a strip), the level
 * area, or nothing (outside the workspace, where a drop cancels). `dragged` is left out of the
 * tabs the place is counted among.
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
		const groups = [...root.querySelectorAll<HTMLElement>(`[data-group-zone="${zone}"]`)];
		const at = groups.findIndex((group) => contains(group.getBoundingClientRect(), point));
		if (at < 0) return { kind: 'zone', zone, group: null, index: null, line: null };
		const group = groups[at]!;
		const strip = group.querySelector<HTMLElement>('[data-strip]');
		const stripRect = strip?.getBoundingClientRect();
		if (!strip || !stripRect || !contains(stripRect, point)) {
			return { kind: 'zone', zone, group: at, index: null, line: null };
		}
		const tabs = [...strip.querySelectorAll<HTMLElement>('[role="tab"]')]
			.filter((tab) => tab.dataset.tab !== dragged)
			.map((tab) => tab.getBoundingClientRect());
		const index = insertionIndex(tabs, point.x);
		return {
			kind: 'zone',
			zone,
			group: at,
			index,
			line: {
				x: insertionX(tabs, index, stripRect.left),
				top: stripRect.top + 2,
				height: Math.max(0, stripRect.height - 4),
			},
		};
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
