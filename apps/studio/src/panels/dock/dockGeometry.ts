// Pure sizes for the dock: the caps on a zone and how much of the window the level keeps
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The window is the whole window. Left of everything is the tool column and above it the title
// bar, menu row and tool bar; what is left is the workspace, where the zones sit and the level
// takes what they leave. A zone without panels takes no room; a collapsed one takes its rail.

import type { Rect, Size } from '../float/panelGeometry';
import {
	CAP_PERCENT,
	RAIL_SIZE,
	TOOL_COLUMN,
	TOP_CHROME,
	ZONE_MAX,
	zoneMin,
	type DockSettings,
	type Workspace,
	type ZoneId,
} from './dockModel';

/** The largest a zone may be in a window: about 30% of the window in its direction. */
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

/** The room a zone takes in the workspace: nothing when empty, its rail when collapsed. */
export function zoneExtent(workspace: Workspace, zone: ZoneId, window: Size): number {
	const z = workspace.zones[zone];
	if (z.groups.length === 0) return 0;
	return z.collapsed ? RAIL_SIZE : clampZoneSize(zone, z.size, window);
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

/** The level's rectangle for a layout: the workspace less the zones' room, never negative. */
export function levelRect(workspace: Workspace, window: Size): Rect {
	const area = workspaceRect(window);
	const left = zoneExtent(workspace, 'left', window);
	const right = zoneExtent(workspace, 'right', window);
	const bottom = zoneExtent(workspace, 'bottom', window);
	return {
		x: area.x + left,
		y: area.y,
		w: Math.max(0, area.w - left - right),
		h: Math.max(0, area.h - bottom),
	};
}

/** The level's share of the window's area, from 0 to 1. */
export function levelShare(workspace: Workspace, window: Size): number {
	const area = window.w * window.h;
	if (area <= 0) return 0;
	const rect = levelRect(workspace, window);
	return (rect.w * rect.h) / area;
}

/** The rectangles of the zones themselves, for drawing: each is empty when it takes no room. */
export function zoneRects(workspace: Workspace, window: Size): Record<ZoneId, Rect> {
	const area = workspaceRect(window);
	const left = zoneExtent(workspace, 'left', window);
	const right = zoneExtent(workspace, 'right', window);
	const bottom = zoneExtent(workspace, 'bottom', window);
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
