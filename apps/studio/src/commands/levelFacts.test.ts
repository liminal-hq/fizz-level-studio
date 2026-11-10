// Tests for the layer and cursor facts the per-layer and "here" commands read
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { levelSections, levelView } from '../test/levelFixtures';
import { NO_CURSOR } from './commandBridge';
import { cursorFacts, layerFacts } from './levelFacts';

describe('layerFacts', () => {
	it('names each layer in file order with the first line it owns', () => {
		const view = levelView(12, 8, { sections: levelSections() });
		expect(layerFacts(view).map((layer) => [layer.id, layer.name, layer.firstLine])).toEqual([
			['terrain', 'Terrain', 6],
			['blocks', 'Blocks', 10],
			['markers', 'Markers', 13],
			['treats', 'Treats', 15],
			['enemies', 'Enemies', 19],
		]);
	});

	it('has none for a level without layers', () => {
		expect(layerFacts(levelView())).toEqual([]);
	});

	it('gives a layer that owns no line no first line', () => {
		const sections = [{ ...levelSections()[0]!, lines: [] }];
		expect(layerFacts(levelView(12, 8, { sections }))[0]?.firstLine).toBeNull();
	});
});

describe('cursorFacts', () => {
	const cells = new Array<number>(12 * 8).fill(0);
	for (let x = 0; x < 12; x++) cells[x] = 1;
	const owners = new Array<number>(12 * 8).fill(255);
	for (let x = 0; x < 12; x++) owners[x] = 0;
	const view = levelView(12, 8, { cells, sections: levelSections(), cell_sections: owners });

	it('reports the tile and the layer that set the cell under the cursor', () => {
		expect(cursorFacts(view, { x: 3, y: 0 })).toEqual({
			inside: true,
			tile: 'fill',
			layer: 'terrain',
		});
	});

	it('has no layer for a cell no statement set', () => {
		expect(cursorFacts(view, { x: 3, y: 4 })).toEqual({ inside: true, tile: 'empty', layer: null });
	});

	it('says the cursor is outside off the level', () => {
		expect(cursorFacts(view, { x: 12, y: 0 })).toEqual(NO_CURSOR);
		expect(cursorFacts(view, { x: 0, y: -1 })).toEqual(NO_CURSOR);
	});
});
