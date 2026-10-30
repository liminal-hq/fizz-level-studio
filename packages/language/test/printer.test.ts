// Tests that parsing then printing reproduces a script exactly, and that new nodes print canonically.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parse } from '../src/parser.ts';
import { print } from '../src/printer.ts';

const crater = readFileSync(new URL('../../../levels/crater.fizz', import.meta.url), 'utf8');

describe('printer', () => {
	test('crater.fizz round-trips byte for byte', () => {
		expect(print(parse(crater).ast)).toBe(crater);
	});

	test('odd spacing, comments, blank lines, CRLF and no final newline survive', () => {
		const src = '// top\r\n\r\nlevel   "X"  10x10   ground=2 id=crater   // why\r\nstart  1 , 2\r\n\r\n\r\nterrain\r\n      flat   3,up 1\r\n// last';
		const { ast, errors } = parse(src);
		expect(errors).toEqual([]);
		expect(print(ast)).toBe(src);
	});

	test('scripts with errors still print back unchanged', () => {
		const src = 'level "X" 10x10 ground=2 id=crater\nstart 1,2\nterrain\n  flatt 3\n  ???\n';
		const { ast, errors } = parse(src);
		expect(errors.length).toBe(2);
		expect(print(ast)).toBe(src);
	});

	test('the empty script and a lone newline round-trip', () => {
		expect(print(parse('').ast)).toBe('');
		expect(print(parse('\n').ast)).toBe('\n');
	});

	test('canonical text of the whole script parses back to the same nodes', () => {
		const { ast } = parse(crater);
		const canonical = print({ nodes: ast.nodes.map((n) => ({ ...n, raw: null, comment: null })) });
		const again = parse(canonical);
		expect(again.errors).toEqual([]);
		const strip = (nodes: typeof ast.nodes) =>
			nodes.filter((n) => n.type !== 'blank' && n.type !== 'comment').map(({ line: _l, raw: _r, comment: _c, ...rest }) => rest);
		expect(strip(again.ast.nodes)).toEqual(strip(ast.nodes));
	});
});
