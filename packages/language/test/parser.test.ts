// Tests for the Fizz parser: statements, ranges, line numbers and section rules.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parse, parseOrThrow } from '../src/parser.ts';

const HEAD = 'level "T" 40x20 ground=4 id=crater\nstart 3,4\n';
const crater = readFileSync(new URL('../../../levels/crater.fizz', import.meta.url), 'utf8');

describe('parser', () => {
	test('parses crater.fizz without errors and puts a line number on every node', () => {
		const { ast, errors } = parse(crater);
		expect(errors).toEqual([]);
		ast.nodes.forEach((n, i) => {
			expect(n.line).toBe(i + 1);
			expect(typeof n.raw).toBe('string');
		});
	});

	test('reads the level header', () => {
		const n = parseOrThrow(HEAD).nodes[0];
		expect(n).toMatchObject({ type: 'level', name: 'T', w: 40, h: 20, ground: 4, id: 'crater', line: 1 });
	});

	test('reads terrain segments across commas and spaces', () => {
		const n = parseOrThrow(`${HEAD}terrain\n  flat 14, up 2,flat 6\n`).nodes[3];
		expect(n).toMatchObject({ type: 'segs', segs: [{ seg: 'flat', n: 14 }, { seg: 'up', n: 2 }, { seg: 'flat', n: 6 }] });
	});

	test('reads ranges, lists and single values', () => {
		const ast = parseOrThrow(`${HEAD}terrain\n  flat 30\nblocks\n  block x=5..7 y=10\n  crystal x=1, 3 ,5..6\n`);
		expect(ast.nodes[5]).toMatchObject({ type: 'tile', tile: 'block', x: { lo: 5, hi: 7 }, y: { lo: 10, hi: 10 } });
		expect(ast.nodes[6]).toMatchObject({ type: 'crystal', xs: [{ lo: 1, hi: 1 }, { lo: 3, hi: 3 }, { lo: 5, hi: 6 }] });
	});

	test('row takes a range and a step, and counts items from them', () => {
		const n = parseOrThrow(`${HEAD}treats\n  row choc x=6..12 y=8 by=3\n`).nodes[3];
		expect(n).toMatchObject({ type: 'row', kind: 'choc', x: { lo: 6, hi: 12 }, y: 8, by: 3 });
	});

	test('spawns: ground-based, explicit y, ride, and dir', () => {
		const ast = parseOrThrow(`${HEAD}terrain\n  flat 30\nenemies\n  gloop x=3, 5\n  drone x=8.5 y=7.5\n  hopper x=9 y=5 ride\n  mirror x=11 y=6 dir=1\n`);
		expect(ast.nodes[5]).toMatchObject({ type: 'spawn', kind: 'gloop', y: null, ride: false });
		expect(ast.nodes[6]).toMatchObject({ type: 'spawn', kind: 'drone', y: { value: 7.5 } });
		expect(ast.nodes[7]).toMatchObject({ type: 'spawn', ride: true });
		expect(ast.nodes[8]).toMatchObject({ type: 'spawn', dir: { value: 1 } });
	});

	test('top-level statements may sit between sections', () => {
		const { errors } = parse(`${HEAD}terrain\n  flat 30\nwalls\nblocks\n  block x=1 y=1\n`);
		expect(errors).toEqual([]);
	});

	test('trailing comments are kept apart from the statement', () => {
		const n = parseOrThrow(`${HEAD}terrain\n  flat 3 // short\n`).nodes[3];
		expect(n).toMatchObject({ type: 'segs', comment: 'short' });
	});

	test('a // inside a quoted level name is not a comment', () => {
		const n = parseOrThrow('level "A // B" 10x10 ground=2 id=crater\nstart 1,1\n').nodes[0];
		expect(n).toMatchObject({ type: 'level', name: 'A // B', comment: null });
	});

	test('theme and area agree with the level table', () => {
		expect(parse(`${HEAD}theme crater\narea crater-fields\n`).errors).toEqual([]);
	});

	test('every Builder-backed statement parses', () => {
		const src = `${HEAD}terrain
  liquid furnace
  flat 30, belt-r 2, belt-l 2
blocks
  plat x=1..3 y=6
  hover from=2,4.5 to=8,4.5 speed=0.3
  room x=1..5 y=4..8
  secret-room x=6..9 y=4..8
  wall-behind x=1..9 y=1..9
  mural x=2 y=3
  ladder x=4 y=4..9
  stairs-right x=10 y=4 count=3
  stairs-left x=14 y=4 count=3
  vine-nook x=20 foot=4 shelf=9 dir=-1 depth=3 h=3
  gate x=3 y=1..2
treats
  pogo-cache x=8..10 rise=7
  usb x=2 y=2
arena x=1..5 floor=4
`;
		expect(parse(src).errors).toEqual([]);
	});
});
