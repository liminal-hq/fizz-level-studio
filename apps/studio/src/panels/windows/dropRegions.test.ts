// Tests for the drop regions the main window registers and what their ids mean
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { collectDropRegions, parseRegion, regionCentre } from './dropRegions';

function box(l: number, t: number, w: number, h: number): DOMRect {
	return {
		left: l,
		top: t,
		right: l + w,
		bottom: t + h,
		x: l,
		y: t,
		width: w,
		height: h,
	} as DOMRect;
}

function el(parent: HTMLElement, attrs: Record<string, string>, rect: DOMRect): HTMLElement {
	const node = document.createElement('div');
	for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
	node.getBoundingClientRect = () => rect;
	parent.appendChild(node);
	return node;
}

function workspace(): HTMLElement {
	const root = document.createElement('div');
	el(root, { 'data-level': '' }, box(0, 0, 1000, 700));
	el(root, { 'data-drop-zone': 'left' }, box(0, 0, 200, 700));
	el(root, { 'data-group-zone': 'left' }, box(30, 0, 170, 350));
	el(root, { 'data-group-zone': 'left' }, box(30, 350, 170, 350));
	const rail = el(root, { 'data-rail': 'left' }, box(0, 0, 30, 700));
	el(rail, { 'data-rail-item': 'palette', 'data-rail-group': '0' }, box(2, 4, 26, 26));
	el(rail, { 'data-rail-item': 'layers', 'data-rail-group': '0' }, box(2, 34, 26, 26));
	el(rail, { 'data-rail-item': 'objects', 'data-rail-group': '1' }, box(2, 360, 26, 26));
	el(root, { 'data-drop-zone': 'bottom' }, box(0, 520, 1000, 0));
	return root;
}

describe('collectDropRegions', () => {
	it('names the level, each dock, each group, each rail and each rail entry', () => {
		const ids = collectDropRegions(workspace()).map((region) => region.id);
		expect(ids).toEqual([
			'zone:left',
			'group:left:0',
			'group:left:1',
			'rail:left',
			'rail:left:0:0',
			'rail:left:0:1',
			'rail:left:1:0',
			'level',
		]);
	});

	it('gives each region its rectangle in window coordinates and leaves out an empty one', () => {
		const regions = collectDropRegions(workspace());
		expect(regions.find((r) => r.id === 'group:left:1')).toEqual({
			id: 'group:left:1',
			x: 30,
			y: 350,
			width: 170,
			height: 350,
		});
		// The empty bottom dock has no area to land on.
		expect(regions.some((r) => r.id.includes('bottom'))).toBe(false);
	});

	it('finds nothing in an empty workspace', () => {
		expect(collectDropRegions(document.createElement('div'))).toEqual([]);
	});
});

describe('parseRegion', () => {
	it('reads each kind of id', () => {
		expect(parseRegion('zone:right')).toEqual({
			kind: 'zone',
			zone: 'right',
			group: null,
			index: null,
		});
		expect(parseRegion('group:left:1')).toEqual({
			kind: 'zone',
			zone: 'left',
			group: 1,
			index: null,
		});
		expect(parseRegion('rail:bottom')).toEqual({
			kind: 'zone',
			zone: 'bottom',
			group: null,
			index: null,
		});
		expect(parseRegion('rail:left:0:2')).toEqual({
			kind: 'zone',
			zone: 'left',
			group: 0,
			index: 2,
		});
		expect(parseRegion('level')).toEqual({ kind: 'level' });
	});

	it('rejects an id that names no place', () => {
		for (const id of [
			null,
			undefined,
			'',
			'zone',
			'zone:top',
			'zone:left:0',
			'group:left',
			'group:left:x',
			'group:left:1:2',
			'rail:left:0',
			'rail:left:a:b',
			'elsewhere:left',
		]) {
			expect(parseRegion(id), String(id)).toBeNull();
		}
	});

	it('reads every id that collectDropRegions makes', () => {
		for (const region of collectDropRegions(workspace())) {
			expect(parseRegion(region.id), region.id).not.toBeNull();
		}
	});
});

describe('regionCentre', () => {
	it('is the middle of the region, or null for one that is not registered', () => {
		const regions = collectDropRegions(workspace());
		expect(regionCentre(regions, 'rail:left:0:1')).toEqual({ x: 15, y: 47 });
		expect(regionCentre(regions, 'nowhere')).toBeNull();
	});
});
