// Tests that the language documentation covers every word the parser accepts.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { DOCS, FIELD_NOTES, docsFor } from '../src/docs.ts';
import { ITEMS, KINDS, SEGS, TILES } from '../src/tables.ts';
import { parse } from '../src/parser.ts';
import { parseOverworld } from '../src/overworld.ts';

const has = (word: string, scope?: string) => DOCS.some((x) => x.word === word && (!scope || x.scope === scope || x.scope === 'both'));

describe('language docs', () => {
	test('every tile, item, enemy and terrain word has an entry', () => {
		for (const w of [...Object.keys(TILES), ...Object.keys(ITEMS), ...Object.keys(KINDS), ...Object.keys(SEGS)]) expect(has(w)).toBe(true);
	});
	test('every statement the parser takes has an entry', () => {
		const words = ['level', 'theme', 'area', 'start', 'arena', 'walls', 'liquid', 'plat', 'hover', 'channel', 'crystal', 'room', 'secret-room', 'wall-behind', 'mural', 'ladder', 'stairs-right', 'stairs-left', 'vine-nook', 'row', 'pogo-cache', 'paint', 'clear', 'place', 'terrain', 'blocks', 'treats', 'enemies', 'edits'];
		for (const w of words) expect(has(w, 'level')).toBe(true);
		for (const w of ['overworld', 'path', 'scatter', 'level', 'tele', 'saucer', 'sign', 'points', 'start', 'area']) expect(has(w, 'overworld')).toBe(true);
	});
	test('every entry has a syntax, an example and a note', () => {
		for (const x of DOCS) {
			expect(x.syntax.length).toBeGreaterThan(0);
			expect(x.example.length).toBeGreaterThan(0);
			expect(x.note.length).toBeGreaterThan(0);
		}
	});
	test('every field a statement lists is described', () => {
		for (const x of DOCS) for (const f of x.fields) expect(FIELD_NOTES[f]).toBeDefined();
	});
	test('level examples that stand alone parse', () => {
		const head = 'level "T" 200x100 ground=4 id=crater\nstart 3,4\nterrain\n  flat 100\nblocks\n';
		for (const w of ['plat', 'hover', 'channel', 'room', 'secret-room', 'wall-behind', 'mural', 'ladder', 'stairs-right', 'stairs-left']) {
			const ex = DOCS.find((x) => x.word === w && x.scope === 'level')!.example;
			expect(parse(head + '  ' + ex + '\n').errors).toEqual([]);
		}
	});
	test('overworld point examples parse', () => {
		const head = 'overworld "T" 60x44 id=main\nstart 9,8\npoints\n';
		expect(parseOverworld(head + '  saucer at=8,10\n  sign 0 at=8,16\n  level crater at=14,6\n').errors).toEqual([]);
	});
	test('docsFor splits level and overworld words', () => {
		expect(docsFor('overworld').some((x) => x.word === 'scatter')).toBe(true);
		expect(docsFor('level').some((x) => x.word === 'scatter')).toBe(false);
	});
});
