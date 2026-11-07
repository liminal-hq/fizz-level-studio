// Tests for what hiding layers does to the view
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { levelSections, levelView } from '../../test/levelFixtures';
import { canHide, layersView, stillHidden } from './layersView';

const view = levelView(12, 8, {
	items: [{ kind: 'cheezie', x: 4, y: 3, line: 9 }],
	spawns: [{ kind: 'gloop', x: 6, y: 1, dir: null, ride: false, line: 12 }],
	markers: [{ kind: 'exit', x: 10, y: 1, height: 2, line: 7 }],
	sections: levelSections(),
});

describe('layersView', () => {
	it('is the very same view when nothing is hidden', () => {
		expect(layersView(view, [])).toBe(view);
	});

	it('is the same view when only tile layers or unknown layers are named', () => {
		expect(layersView(view, ['terrain', 'nothing'])).toBe(view);
	});

	it('drops the things of each hidden thing layer and nothing else', () => {
		const treats = layersView(view, ['treats']);
		expect(treats.items).toEqual([]);
		expect(treats.spawns).toBe(view.spawns);
		expect(treats.cells).toBe(view.cells);
		const rest = layersView(view, ['enemies', 'markers']);
		expect(rest.items).toBe(view.items);
		expect(rest.spawns).toEqual([]);
		expect(rest.markers).toEqual([]);
	});

	it('leaves the original view as it was', () => {
		layersView(view, ['treats', 'enemies', 'markers']);
		expect(view.items).toHaveLength(1);
	});
});

describe('canHide', () => {
	it('lets thing layers be hidden and holds the tile layers back until they can be', () => {
		const [terrain, , markers, treats] = levelSections();
		expect(canHide(terrain!)).toBe(false);
		expect(canHide(markers!)).toBe(true);
		expect(canHide(treats!)).toBe(true);
	});
});

describe('stillHidden', () => {
	it('forgets a layer the level no longer has', () => {
		expect(stillHidden(levelSections(), ['treats', 'edits', 'crystals'])).toEqual(['treats']);
	});
});
