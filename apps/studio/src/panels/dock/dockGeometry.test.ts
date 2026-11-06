// Tests for the dock's caps and the level's share of the window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	activeWorkspace,
	clampZoneSize,
	clampZoneSizeAbsolute,
	contentExtent,
	dockInsets,
	levelRect,
	levelShare,
	railExtent,
	workspaceRect,
	zoneCap,
	zoneExtent,
	zoneRects,
} from './dockGeometry';
import {
	BOTTOM_MIN,
	RAIL_SIZE,
	SIDE_MIN,
	ZONE_MAX,
	defaultDock,
	defaultWorkspace,
	defaultWorkspaceFor,
} from './dockModel';

const big = { w: 1440, h: 900 };
const small = { w: 1280, h: 720 };

describe('zone caps', () => {
	it('caps a zone at about 30% of the window in its direction', () => {
		expect(zoneCap('left', big)).toBe(432);
		expect(zoneCap('right', small)).toBe(384);
		expect(zoneCap('bottom', big)).toBe(270);
		expect(zoneCap('bottom', small)).toBe(216);
	});

	it('lets the minimum win in a window too small for both', () => {
		expect(zoneCap('left', { w: 300, h: 200 })).toBe(SIDE_MIN);
		expect(zoneCap('bottom', { w: 300, h: 200 })).toBe(BOTTOM_MIN);
	});

	it('holds a size between the minimum and the cap', () => {
		expect(clampZoneSize('left', 10, big)).toBe(SIDE_MIN);
		expect(clampZoneSize('left', 9999, big)).toBe(432);
		expect(clampZoneSize('bottom', 9999, small)).toBe(216);
		expect(clampZoneSize('right', 300.4, big)).toBe(300);
		expect(clampZoneSize('right', Number.NaN, big)).toBe(SIDE_MIN);
	});

	it('holds a size to the absolute range when the window is unknown', () => {
		expect(clampZoneSizeAbsolute('left', 10)).toBe(SIDE_MIN);
		expect(clampZoneSizeAbsolute('bottom', 1e9)).toBe(ZONE_MAX);
	});
});

describe('the level in the default layout', () => {
	const ws = defaultWorkspace();

	it('gives each open zone its rail and its content at 1440 x 900', () => {
		expect(levelRect(ws, big)).toEqual({
			x: 64 + RAIL_SIZE + 196,
			y: 124,
			w: 1440 - 64 - (RAIL_SIZE + 196) - (RAIL_SIZE + 264),
			h: 900 - 124 - (RAIL_SIZE + 180),
		});
		expect(zoneExtent(ws, 'left', big)).toBe(RAIL_SIZE + 196);
		expect(zoneExtent(ws, 'right', big)).toBe(RAIL_SIZE + 264);
		expect(zoneExtent(ws, 'bottom', big)).toBe(RAIL_SIZE + 180);
		expect(contentExtent(ws, 'left', big)).toBe(196);
		expect(railExtent(ws, 'left')).toBe(RAIL_SIZE);
		expect(levelShare(ws, big)).toBeCloseTo((844 * 560) / (1440 * 900), 6);
		expect(levelShare(ws, big)).toBeGreaterThan(0.36);
	});

	it('leaves 684 x 380 at 1280 x 720', () => {
		const rect = levelRect(ws, small);
		expect([rect.w, rect.h]).toEqual([684, 380]);
		expect(levelShare(ws, small)).toBeCloseTo((684 * 380) / (1280 * 720), 6);
	});

	it('pulls an oversized zone in to the cap, with the rail outside it', () => {
		const wide = structuredClone(ws);
		wide.zones.right.size = 2000;
		expect(contentExtent(wide, 'right', big)).toBe(432);
		expect(zoneExtent(wide, 'right', big)).toBe(432 + RAIL_SIZE);
	});
});

describe('rails and empty zones', () => {
	it('gives a collapsed zone its rail alone and an empty zone nothing, not even a rail', () => {
		const ws = defaultWorkspace();
		ws.zones.right.collapsed = true;
		ws.zones.left.groups = [];
		ws.zones.bottom.groups = [];
		expect(zoneExtent(ws, 'right', big)).toBe(RAIL_SIZE);
		expect(contentExtent(ws, 'right', big)).toBe(0);
		expect(zoneExtent(ws, 'left', big)).toBe(0);
		expect(railExtent(ws, 'left')).toBe(0);
		expect(railExtent(ws, 'bottom')).toBe(0);
		expect(levelRect(ws, big).w).toBe(1440 - 64 - RAIL_SIZE);
		expect(levelRect(ws, big).h).toBe(900 - 124);
	});

	it('opens every dock in the Paint workspace and keeps the level above a third at 1440 by 900', () => {
		const paint = defaultWorkspaceFor('Paint');
		expect(paint).toEqual(defaultWorkspace());
		expect(levelRect(paint, big)).toEqual(levelRect(defaultWorkspace(), big));
		expect(levelShare(paint, big)).toBeGreaterThan(0.36);
		expect(levelShare(paint, big)).toBeLessThan(0.37);
	});

	it('keeps a useful share of the level in every shipped workspace on a small window', () => {
		for (const name of ['Paint', 'Script', 'Review']) {
			const share = levelShare(defaultWorkspaceFor(name), small);
			expect(share).toBeGreaterThan(0.25);
		}
	});

	it('never lets the level fall below 40% of the width less the tool column and rails at the caps', () => {
		const ws = defaultWorkspace();
		ws.zones.left.size = ws.zones.right.size = 5000;
		const rect = levelRect(ws, small);
		expect(rect.w).toBeGreaterThanOrEqual(1280 * 0.4 - 64 - 2 * RAIL_SIZE);
	});

	it('never reports a negative level in a tiny window', () => {
		const rect = levelRect(defaultWorkspace(), { w: 200, h: 100 });
		expect(rect.w).toBeGreaterThanOrEqual(0);
		expect(rect.h).toBe(0);
		expect(levelShare(defaultWorkspace(), { w: 0, h: 0 })).toBe(0);
	});
});

describe('the insets the docks lay over the level', () => {
	it('covers each edge by its rail and open content, and never the top', () => {
		expect(dockInsets(defaultWorkspace(), big)).toEqual({
			top: 0,
			right: RAIL_SIZE + 264,
			bottom: RAIL_SIZE + 180,
			left: RAIL_SIZE + 196,
		});
	});

	it('covers a folded dock at its rail width and an empty one not at all', () => {
		const ws = defaultWorkspace();
		ws.zones.right.collapsed = true;
		ws.zones.left.groups = [];
		expect(dockInsets(ws, big)).toEqual({
			top: 0,
			right: RAIL_SIZE,
			bottom: RAIL_SIZE + 180,
			left: 0,
		});
	});

	it('holds an oversized dock to its cap, the rail outside it', () => {
		const ws = defaultWorkspace();
		ws.zones.left.size = 5000;
		expect(dockInsets(ws, small).left).toBe(RAIL_SIZE + zoneCap('left', small));
	});

	it('leaves the uncovered level the workspace less the insets', () => {
		const ws = defaultWorkspace();
		const area = workspaceRect(big);
		const insets = dockInsets(ws, big);
		expect(levelRect(ws, big)).toEqual({
			x: area.x + insets.left,
			y: area.y,
			w: area.w - insets.left - insets.right,
			h: area.h - insets.bottom,
		});
	});
});

describe('the zones themselves', () => {
	it('lays the side zones and their rails over the sides of the level and the bottom zone along it', () => {
		const rects = zoneRects(defaultWorkspace(), big);
		expect(rects.left).toEqual({ x: 64, y: 124, w: 232, h: 560 });
		expect(rects.right).toEqual({ x: 1440 - 300, y: 124, w: 300, h: 560 });
		expect(rects.bottom).toEqual({ x: 64, y: 684, w: 1376, h: 216 });
		expect(workspaceRect(big)).toEqual({ x: 64, y: 124, w: 1376, h: 776 });
	});

	it('finds the active workspace', () => {
		const dock = defaultDock();
		expect(activeWorkspace(dock)).toBe(dock.workspaces[dock.active]);
		expect(activeWorkspace({ active: 'gone', workspaces: {} })).toBeNull();
	});
});
