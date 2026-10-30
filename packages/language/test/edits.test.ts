// Tests for the edits block: parsing, appending without rewriting, and order.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { appendEdits } from '../src/edits.ts';
import { parse, parseOrThrow } from '../src/parser.ts';
import { print } from '../src/printer.ts';
import { toRust } from '../src/rust.ts';

const BASE = `level "T" 40x20 ground=4 id=crater
start 3,4

terrain
  flat 40   // all flat

treats
  soda x=5 y=5
`;

describe('edits block', () => {
	test('parses paint, clear and place', () => {
		const ast = parseOrThrow(`${BASE}
edits   // painted in the studio
  paint one-way x=26,28,30 y=9
  clear x=12..14 y=8
  place cheezie x=26,28,30 y=10
`);
		const types = ast.nodes.slice(-4).map((n) => n.type);
		expect(types).toEqual(['paint', 'clear', 'place', 'blank']);
		expect(ast.nodes.find((n) => n.type === 'section' && n.name === 'edits')).toBeTruthy();
	});

	test('appending creates the block after one blank line and keeps the final newline', () => {
		const ast = appendEdits(parseOrThrow(BASE), [{ op: 'paint', tile: 'one-way', xs: [{ lo: 26, hi: 26 }, { lo: 28, hi: 28 }], ys: [{ lo: 9, hi: 9 }] }]);
		expect(print(ast)).toBe(`${BASE}\nedits\n  paint one-way x=26,28 y=9\n`);
	});

	test('appending never rewrites a hand-written line', () => {
		const original = parseOrThrow(BASE);
		const once = appendEdits(original, [{ op: 'clear', xs: [{ lo: 1, hi: 3 }], ys: [{ lo: 5, hi: 5 }] }]);
		const twice = appendEdits(once, [{ op: 'place', kind: 'cookie', xs: [{ lo: 2, hi: 2 }], ys: [{ lo: 6, hi: 6 }] }]);
		const text = print(twice);
		expect(text.startsWith(BASE.trimEnd())).toBe(true);
		for (let i = 0; i < original.nodes.length - 1; i++) expect(twice.nodes[i].raw).toBe(original.nodes[i].raw);
		expect(text.endsWith('edits\n  clear x=1..3 y=5\n  place cookie x=2 y=6\n')).toBe(true);
		expect(parse(text).errors).toEqual([]);
	});

	test('appended nodes carry the line they print on', () => {
		const ast = appendEdits(parseOrThrow(BASE), [{ op: 'clear', xs: [{ lo: 1, hi: 1 }], ys: [{ lo: 1, hi: 1 }] }]);
		const lines = print(ast).split('\n');
		ast.nodes.forEach((n) => expect(lines[n.line - 1]).toBe(n.raw ?? lines[n.line - 1]));
		expect(ast.nodes.find((n) => n.type === 'clear')!.line).toBe(lines.indexOf('  clear x=1 y=1') + 1);
	});

	test('appending to an existing block adds after its last line, before trailing blanks', () => {
		const withBlock = `${BASE}\nedits\n  clear x=1 y=1\n\n\n`;
		const ast = appendEdits(parseOrThrow(withBlock), [{ op: 'clear', xs: [{ lo: 2, hi: 2 }], ys: [{ lo: 2, hi: 2 }] }]);
		expect(print(ast)).toBe(`${BASE}\nedits\n  clear x=1 y=1\n  clear x=2 y=2\n\n\n`);
	});

	test('edits run last and in file order: a later paint wins, clear paints empty', () => {
		const ast = parseOrThrow(`${BASE}
edits
  paint block x=3..4 y=7
  paint one-way x=4 y=7
  clear x=3 y=7
  place cheezie x=1..2 y=3
`);
		const rust = toRust(ast, 'edited');
		const lines = rust.split('\n').map((l) => l.trim());
		const edits = lines.slice(lines.indexOf('// Edits painted in the studio.') + 1, lines.indexOf('b.out(CRATER, (3.0, 4.0), None)'));
		expect(edits).toEqual([
			'b.fill(3, 4, 7, 7, BLOCK);',
			'b.fill(4, 4, 7, 7, PLAT);',
			'b.fill(3, 3, 7, 7, EMPTY);',
			'b.item(ItemKind::Cheezie, 1, 3);',
			'b.item(ItemKind::Cheezie, 2, 3);',
		]);
		expect(lines.indexOf('b.item(ItemKind::Soda, 5, 5);')).toBeLessThan(lines.indexOf('// Edits painted in the studio.'));
	});

	test('only paint, clear and place may follow the edits header', () => {
		const { errors } = parse(`${BASE}\nedits\n  walls\n  soda x=1 y=1\n`);
		expect(errors.map((e) => [e.line, e.code])).toEqual([[11, 'E008'], [12, 'E008']]);
	});
});
