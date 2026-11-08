// Tests for the drop helpers: where among the tabs, which group, and where a dropped panel floats
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { dropOnZone, floatRectAt, insertionIndex, insertionX } from './dockDrop';
import { defaultWorkspace, dockedIn } from './dockModel';

const tabs = [
	{ left: 0, right: 100 },
	{ left: 110, right: 210 },
];

describe('insertionIndex', () => {
	it('counts the tabs whose middle is left of the pointer', () => {
		expect(insertionIndex(tabs, 10)).toBe(0);
		expect(insertionIndex(tabs, 60)).toBe(1);
		expect(insertionIndex(tabs, 500)).toBe(2);
		expect(insertionIndex([], 50)).toBe(0);
	});
});

describe('insertionX', () => {
	it('sits before the tab at the index, or after the last', () => {
		expect(insertionX(tabs, 0, 0)).toBeLessThan(tabs[0]!.left);
		expect(insertionX(tabs, 1, 0)).toBeLessThan(tabs[1]!.left);
		expect(insertionX(tabs, 2, 0)).toBeGreaterThan(tabs[1]!.right);
		expect(insertionX([], 0, 40)).toBe(44);
	});
});

describe('dropOnZone', () => {
	it('docks a panel as a tab at the place given', () => {
		const next = dropOnZone(defaultWorkspace(), 'palette', 'right', 0, 1);
		expect(next.zones.right.groups[0]!.tabs).toEqual([
			'inspector',
			'palette',
			'objects',
			'history',
		]);
		expect(dockedIn(next, 'left')).toEqual(['layers']);
	});

	it('puts a panel at the end of the first group when no group is given', () => {
		const next = dropOnZone(defaultWorkspace(), 'palette', 'bottom', null, null);
		expect(next.zones.bottom.groups[0]!.tabs).toEqual(['script', 'proposals', 'palette']);
	});

	it('reorders within a group', () => {
		const next = dropOnZone(defaultWorkspace(), 'history', 'right', 0, 0);
		expect(next.zones.right.groups[0]!.tabs).toEqual(['history', 'inspector', 'objects']);
	});

	it('changes nothing when a lone panel is dropped on its own group', () => {
		const ws = defaultWorkspace();
		ws.zones.left.groups = [{ tabs: ['palette'], active: 'palette' }];
		ws.panels.layers!.place = 'floating';
		expect(dropOnZone(ws, 'palette', 'left', 0, 0)).toBe(ws);
	});

	it('shifts the group when the panel’s own lone group goes', () => {
		let ws = defaultWorkspace();
		ws = dropOnZone(ws, 'palette', 'bottom', 0, null);
		ws.zones.bottom.groups = [
			{ tabs: ['palette'], active: 'palette' },
			{ tabs: ['script', 'proposals'], active: 'script' },
		];
		const next = dropOnZone(ws, 'palette', 'bottom', 1, 0);
		expect(next.zones.bottom.groups.map((g) => g.tabs)).toEqual([
			['palette', 'script', 'proposals'],
		]);
	});

	it('opens a folded dock it docks into', () => {
		const ws = defaultWorkspace();
		ws.zones.left.collapsed = true;
		expect(dropOnZone(ws, 'history', 'left', null, null).zones.left.collapsed).toBe(false);
	});
});

describe('floatRectAt', () => {
	it('centres the panel across the pointer and keeps it in the area', () => {
		const size = { w: 200, h: 100 };
		const min = { w: 100, h: 60 };
		const area = { w: 1000, h: 600 };
		expect(floatRectAt({ x: 600, y: 300 }, { x: 100, y: 50 }, size, min, area)).toEqual({
			x: 400,
			y: 234,
			w: 200,
			h: 100,
		});
		expect(floatRectAt({ x: 0, y: 0 }, { x: 100, y: 50 }, size, min, area)).toMatchObject({
			x: 0,
			y: 0,
		});
	});
});
