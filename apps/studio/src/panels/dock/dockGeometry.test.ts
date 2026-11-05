// Tests for the dock's caps and the level's share of the window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	activeWorkspace,
	clampZoneSize,
	clampZoneSizeAbsolute,
	levelRect,
	levelShare,
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

	it('matches the design at 1440 x 900', () => {
		expect(levelRect(ws, big)).toEqual({ x: 64 + 196, y: 124, w: 916, h: 596 });
		expect(zoneExtent(ws, 'left', big)).toBe(196);
		expect(zoneExtent(ws, 'right', big)).toBe(264);
		expect(zoneExtent(ws, 'bottom', big)).toBe(180);
		expect(levelShare(ws, big)).toBeCloseTo((916 * 596) / (1440 * 900), 6);
		expect(levelShare(ws, big)).toBeGreaterThan(0.42);
	});

	it('leaves 756 x 416 at 1280 x 720', () => {
		const rect = levelRect(ws, small);
		expect([rect.w, rect.h]).toEqual([756, 416]);
		expect(levelShare(ws, small)).toBeCloseTo((756 * 416) / (1280 * 720), 6);
	});

	it('pulls an oversized zone in to the cap', () => {
		const wide = structuredClone(ws);
		wide.zones.right.size = 2000;
		expect(zoneExtent(wide, 'right', big)).toBe(432);
	});
});

describe('rails and empty zones', () => {
	it('gives a collapsed zone its rail and an empty zone nothing', () => {
		const ws = defaultWorkspace();
		ws.zones.right.collapsed = true;
		ws.zones.left.groups = [];
		expect(zoneExtent(ws, 'right', big)).toBe(RAIL_SIZE);
		expect(zoneExtent(ws, 'left', big)).toBe(0);
		expect(levelRect(ws, big).w).toBe(1440 - 64 - RAIL_SIZE);
	});

	it('gives the shipped workspaces more level than the default', () => {
		const paint = defaultWorkspaceFor('Paint');
		expect(levelRect(paint, big)).toEqual({
			x: 64 + 196,
			y: 124,
			w: 1440 - 64 - 196 - 36,
			h: 900 - 124 - 36,
		});
		for (const name of ['Paint', 'Script', 'Review']) {
			const share = levelShare(defaultWorkspaceFor(name), small);
			expect(share).toBeGreaterThan(0.3);
		}
	});

	it('never lets the level fall below 40% of the width less the tool column at the caps', () => {
		const ws = defaultWorkspace();
		ws.zones.left.size = ws.zones.right.size = 5000;
		const rect = levelRect(ws, small);
		expect(rect.w).toBeGreaterThanOrEqual(1280 * 0.4 - 64);
	});

	it('never reports a negative level in a tiny window', () => {
		const rect = levelRect(defaultWorkspace(), { w: 200, h: 100 });
		expect(rect.w).toBeGreaterThanOrEqual(0);
		expect(rect.h).toBe(0);
		expect(levelShare(defaultWorkspace(), { w: 0, h: 0 })).toBe(0);
	});
});

describe('the zones themselves', () => {
	it('lays the side zones beside the level and the bottom zone under all', () => {
		const rects = zoneRects(defaultWorkspace(), big);
		expect(rects.left).toEqual({ x: 64, y: 124, w: 196, h: 596 });
		expect(rects.right).toEqual({ x: 1440 - 264, y: 124, w: 264, h: 596 });
		expect(rects.bottom).toEqual({ x: 64, y: 720, w: 1376, h: 180 });
		expect(workspaceRect(big)).toEqual({ x: 64, y: 124, w: 1376, h: 776 });
	});

	it('finds the active workspace', () => {
		const dock = defaultDock();
		expect(activeWorkspace(dock)).toBe(dock.workspaces[dock.active]);
		expect(activeWorkspace({ active: 'gone', workspaces: {} })).toBeNull();
	});
});
