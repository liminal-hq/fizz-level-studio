// Tests for the palette's section table
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { TILE_TOKENS } from '../canvas/tileColours';
import { ENEMY_WORDS, ITEM_WORDS, type Brush } from './brush';
import { SECTION_BRUSHES, SECTION_IDS, paletteSections, sectionOf } from './paletteSections';

const catalogue: Brush[] = [
	...Object.keys(TILE_TOKENS).map((kind): Brush => ({ group: 'tile', kind })),
	...ITEM_WORDS.map((kind): Brush => ({ group: 'item', kind })),
	...ENEMY_WORDS.map((kind): Brush => ({ group: 'enemy', kind })),
];

describe('the palette section table', () => {
	it('places every brush of the catalogue in exactly one section', () => {
		for (const brush of catalogue) {
			const homes = SECTION_IDS.filter((id) =>
				SECTION_BRUSHES[id].some((b) => b.group === brush.group && b.kind === brush.kind),
			);
			expect(homes, `${brush.group}:${brush.kind}`).toHaveLength(1);
		}
	});

	it('names no brush that is not in the catalogue, and none twice', () => {
		const keys = SECTION_IDS.flatMap((id) =>
			SECTION_BRUSHES[id].map((b) => `${b.group}:${b.kind}`),
		);
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.length).toBe(catalogue.length);
	});

	it('leaves no section empty', () => {
		for (const id of SECTION_IDS) expect(SECTION_BRUSHES[id].length, id).toBeGreaterThan(0);
	});

	it('puts the same word in the section of its group: choc the pool and choc the treat', () => {
		expect(sectionOf({ group: 'tile', kind: 'choc' })).toBe('hazards');
		expect(sectionOf({ group: 'item', kind: 'choc' })).toBe('treats');
	});

	it('sends a word it does not know to its group’s main section', () => {
		expect(sectionOf({ group: 'tile', kind: 'lava' })).toBe('terrain');
		expect(sectionOf({ group: 'item', kind: 'gem' })).toBe('treats');
		expect(sectionOf({ group: 'enemy', kind: 'yeti' })).toBe('enemies');
	});

	it('offers only the sections that have something, and never empty', () => {
		const sections = paletteSections(['empty', 'fill', 'spike'], []);
		expect(sections.map((s) => s.id)).toEqual(['terrain', 'hazards', 'treats', 'enemies']);
		expect(sections[0]?.brushes.map((b) => b.kind)).toEqual(['fill']);
	});
});
