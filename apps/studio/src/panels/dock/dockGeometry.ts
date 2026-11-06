// Pure sizes for the dock: the caps on a zone, how far the docks cover the level and what they leave
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The window is the whole window. Left of everything is the tool column and above it the title
// bar, menu row and tool bar; what is left is the workspace. The level fills the whole workspace
// and the zones lie over its edges, so their glass has the level to blur (D69); the level's
// camera treats only what they leave uncovered as its window. A zone without panels covers
// nothing. A zone with panels has a rail along the window's edge, always, and an open one has its
// content beside the rail, held to its cap; a folded one covers its rail's width.

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { Insets } from '../../canvas/viewport';
import type { Rect, Size } from '../float/panelGeometry';
import { CAP_PERCENT, RAIL_SIZE, TOOL_COLUMN, TOP_CHROME, ZONE_MAX, zoneMin } from './dockModel';

/**
 * The largest a zone's content may be in a window: about 30% of the window in its direction. The
 * rail is outside it, so a zone at its cap takes the 30% and its rail.
 */
export function zoneCap(zone: ZoneId, window: Size): number {
	const extent = zone === 'bottom' ? window.h : window.w;
	// The minimum wins over the cap in a window too small for both.
	return Math.max(zoneMin(zone), Math.floor((extent * CAP_PERCENT) / 100));
}

/** `size` held between the zone's minimum and its cap for `window`. */
export function clampZoneSize(zone: ZoneId, size: number, window: Size): number {
	const wanted = Number.isFinite(size) ? Math.round(size) : zoneMin(zone);
	return Math.max(zoneMin(zone), Math.min(wanted, zoneCap(zone, window), ZONE_MAX));
}

/** `size` held to the absolute range alone, for a window that is not known. */
export function clampZoneSizeAbsolute(zone: ZoneId, size: number): number {
	const wanted = Number.isFinite(size) ? Math.round(size) : zoneMin(zone);
	return Math.max(zoneMin(zone), Math.min(wanted, ZONE_MAX));
}

/** The room a zone's rail takes: the rail's thickness when the zone has panels, else nothing. */
export function railExtent(workspace: Workspace, zone: ZoneId): number {
	return workspace.zones[zone].groups.length === 0 ? 0 : RAIL_SIZE;
}

/** The room a zone's content takes beside its rail: nothing when empty or collapsed. */
export function contentExtent(workspace: Workspace, zone: ZoneId, window: Size): number {
	const z = workspace.zones[zone];
	if (z.groups.length === 0 || z.collapsed) return 0;
	return clampZoneSize(zone, z.size, window);
}

/** The room a zone takes in the workspace: its rail and, when it is open, its content. */
export function zoneExtent(workspace: Workspace, zone: ZoneId, window: Size): number {
	return railExtent(workspace, zone) + contentExtent(workspace, zone, window);
}

/**
 * How far the docks and their rails cover the level from each edge of the workspace: a zone's rail
 * and, when it is open, its content. Nothing covers the top. The side zones stop above the bottom
 * zone, which spans the width, so these four numbers describe the covered margins exactly.
 */
export function dockInsets(workspace: Workspace, window: Size): Insets {
	return {
		top: 0,
		right: zoneExtent(workspace, 'right', window),
		bottom: zoneExtent(workspace, 'bottom', window),
		left: zoneExtent(workspace, 'left', window),
	};
}

/** The workspace: the window less the tool column and the bars above. */
export function workspaceRect(window: Size): Rect {
	return {
		x: TOOL_COLUMN,
		y: TOP_CHROME,
		w: Math.max(0, window.w - TOOL_COLUMN),
		h: Math.max(0, window.h - TOP_CHROME),
	};
}

/**
 * The part of the level the docks leave uncovered, in window pixels: the workspace less the
 * docks' insets, never negative. The level itself spans the whole workspace beneath them.
 */
export function levelRect(workspace: Workspace, window: Size): Rect {
	const area = workspaceRect(window);
	const { left, right, bottom } = dockInsets(workspace, window);
	return {
		x: area.x + left,
		y: area.y,
		w: Math.max(0, area.w - left - right),
		h: Math.max(0, area.h - bottom),
	};
}

/** The uncovered level's share of the window's area, from 0 to 1. */
export function levelShare(workspace: Workspace, window: Size): number {
	const area = window.w * window.h;
	if (area <= 0) return 0;
	const rect = levelRect(workspace, window);
	return (rect.w * rect.h) / area;
}

/**
 * The rectangles of the zones themselves, rails included, as they lie over the level: each is
 * empty when it covers nothing.
 */
export function zoneRects(workspace: Workspace, window: Size): Record<ZoneId, Rect> {
	const area = workspaceRect(window);
	const { left, right, bottom } = dockInsets(workspace, window);
	const middleH = Math.max(0, area.h - bottom);
	return {
		left: { x: area.x, y: area.y, w: left, h: middleH },
		right: { x: area.x + area.w - right, y: area.y, w: right, h: middleH },
		bottom: { x: area.x, y: area.y + middleH, w: area.w, h: bottom },
	};
}

/** The active workspace of a dock, or null when it names none. */
export function activeWorkspace(dock: DockSettings): Workspace | null {
	return dock.workspaces[dock.active] ?? null;
}
