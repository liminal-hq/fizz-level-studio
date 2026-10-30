// Tests for parser error messages: each has a code, the right line number and a suggested fix.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { FizzErrors, formatError } from '../src/errors.ts';
import { parse, parseOrThrow } from '../src/parser.ts';

const HEAD = 'level "T" 40x20 ground=4 id=crater\nstart 3,4\n';
const T = `${HEAD}terrain\n  flat 40\n`; // terrain ends on line 4

function only(src: string) {
	const { errors } = parse(src);
	expect(errors.length).toBe(1);
	return errors[0];
}

describe('error messages', () => {
	test('E001 unknown statement suggests the nearest word', () => {
		const e = only(`${T}blocks\n  plot x=1..2 y=3\n`);
		expect(e).toMatchObject({ line: 6, code: 'E001', fix: 'did you mean `plat`?' });
	});

	test('E002 unknown tile, item and segment name the nearest match', () => {
		expect(only(`${T}edits\n  paint one-wy x=1 y=1\n`)).toMatchObject({ line: 6, code: 'E002', fix: 'did you mean `one-way`?' });
		expect(only(`${T}edits\n  place chezie x=1 y=1\n`)).toMatchObject({ code: 'E002', fix: 'did you mean `cheezie`?' });
		expect(only(`${HEAD}terrain\n  flat 3, ramp 2\n`)).toMatchObject({ line: 4, code: 'E002' });
		expect(only('level "T" 40x20 ground=4 id=crator\nstart 3,4\n')).toMatchObject({ line: 1, code: 'E002', fix: 'did you mean `crater`?' });
	});

	test('E003 missing field says what to add', () => {
		const e = only(`${T}blocks\n  block x=1..2\n`);
		expect(e).toMatchObject({ line: 6, code: 'E003', message: 'missing field `y=`', fix: 'add `y=10`' });
	});

	test('E004 bad number and E005 backwards range', () => {
		expect(only(`${T}blocks\n  block x=a y=2\n`)).toMatchObject({ line: 6, code: 'E004' });
		expect(only(`${T}blocks\n  block x=9..3 y=2\n`)).toMatchObject({ line: 6, code: 'E005', fix: 'write it as 3..9' });
	});

	test('E006 duplicate header lines and a second edits block', () => {
		expect(only(`${HEAD}start 1,1\n`)).toMatchObject({ line: 3, code: 'E006' });
		expect(only(`${T}edits\n  clear x=1 y=1\nedits\n`)).toMatchObject({ line: 7, code: 'E008' });
	});

	test('E007 a statement before the level header, and an empty script', () => {
		expect(parse('start 3,4\nlevel "T" 10x10 ground=2 id=crater\n').errors[0]).toMatchObject({ line: 1, code: 'E007' });
		expect(parse('').errors[0]).toMatchObject({ line: 1, code: 'E007' });
	});

	test('E008 a statement under the wrong section, or before any section', () => {
		expect(only(`${T}enemies\n  soda x=1 y=1\n`)).toMatchObject({ line: 6, code: 'E008', fix: 'move the line under a `treats` header' });
		expect(only(`${HEAD}flat 3\n`)).toMatchObject({ line: 3, code: 'E008', fix: 'put it under a `terrain` header' });
		expect(only(`${T}edits\n  clear x=1 y=1\n  walls\n`)).toMatchObject({ line: 7, code: 'E008' });
	});

	test('E009 unknown field and stray word', () => {
		expect(only(`${T}blocks\n  block x=1 y=2 z=3\n`)).toMatchObject({ line: 6, code: 'E009', message: 'unknown field `z=`' });
		expect(only(`${T}blocks\n  block x=1 y=2 loud\n`)).toMatchObject({ code: 'E009', message: 'unexpected `loud`' });
	});

	test('E010 a script with no start line is reported on the level line', () => {
		expect(parse('level "T" 10x10 ground=2 id=crater\n').errors[0]).toMatchObject({ line: 1, code: 'E010' });
	});

	test('E011 ground-based statements need terrain first', () => {
		const e = only(`${HEAD}blocks\n  crystal x=5\nterrain\n  flat 40\n`);
		expect(e).toMatchObject({ line: 4, code: 'E011' });
		expect(only(`${HEAD}enemies\n  gloop x=5\n`).code).toBe('E011');
	});

	test('E012 a row range that misses its step suggests both neighbours', () => {
		const e = only(`${T}treats\n  row choc x=46..53 y=8 by=3\n`);
		expect(e).toMatchObject({ line: 6, code: 'E012', fix: 'write x=46..52 by=3 (3 items) or x=46..55 by=3' });
	});

	test('E013 coordinates outside the level', () => {
		expect(only(`${T}blocks\n  block x=38..40 y=2\n`)).toMatchObject({ line: 6, code: 'E013', message: 'x 38..40 is outside the level (x runs 0..39)' });
		expect(only(`${T}edits\n  clear x=1 y=20\n`).code).toBe('E013');
	});

	test('E014 theme or area that contradicts the level id', () => {
		expect(only(`${HEAD}theme caves\n`)).toMatchObject({ line: 3, code: 'E014' });
		expect(only(`${HEAD}area gumdrop-isle\n`).code).toBe('E014');
	});

	test('E015 counts below one and tiny levels', () => {
		expect(only(`${HEAD}terrain\n  flat 0\n`)).toMatchObject({ line: 4, code: 'E015' });
		expect(only(`${T}treats\n  row cookie x=1..2 y=3 by=0\n`).code).toBe('E015');
	});

	test('E016 spawn field combinations the Builder cannot make', () => {
		expect(only(`${T}enemies\n  gloop x=3 ride\n`)).toMatchObject({ line: 6, code: 'E016' });
		expect(only(`${T}enemies\n  gloop x=3 y=5 ride dir=1\n`).code).toBe('E016');
	});

	test('a malformed level header is one error, not a cascade', () => {
		const { errors } = parse('level Crater 10x10\nstart 1,1\nterrain\n  flat 3\n');
		expect(errors.map((e) => [e.line, e.code])).toEqual([[1, 'E004']]);
	});

	test('several bad lines are all reported, in line order', () => {
		const { errors } = parse(`${T}blocks\n  blok x=1 y=1\n  block x=1\n`);
		expect(errors.map((e) => e.line)).toEqual([6, 7]);
	});

	test('formatError and parseOrThrow carry the line, code and fix', () => {
		const e = only(`${T}blocks\n  block x=1\n`);
		expect(formatError(e)).toBe('line 6: E003 missing field `y=` (fix: add `y=10`)');
		expect(() => parseOrThrow(`${T}blocks\n  block x=1\n`)).toThrow(FizzErrors);
	});
});
