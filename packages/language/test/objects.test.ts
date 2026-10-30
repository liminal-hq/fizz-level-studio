// Tests for lifts with a size and a rest time, switch channels, and enemies and objects in the edits block.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { parse, parseOrThrow } from '../src/parser.ts';
import { print } from '../src/printer.ts';
import { toRust } from '../src/rust.ts';

const HEAD = 'level "T" 40x20 ground=4 id=crater\nstart 3,4\nblocks\n';

describe('hover with a size and a rest time', () => {
	test('exports as a pushed platform with .sized and .with_dwell', () => {
		const rust = toRust(parseOrThrow(HEAD + '  hover from=18,10.5 to=18,16.5 speed=0.1 size=3x0.5 dwell=2\n'), 'f');
		expect(rust).toContain('b.plats.push(Platform::new(18.0, 10.5, 18.0, 16.5, 0.1).sized(3.0, 0.5).with_dwell(2.0));');
	});
	test('the plain form still uses b.hover', () => {
		expect(toRust(parseOrThrow(HEAD + '  hover from=1,5 to=4,5 speed=0.3\n'), 'f')).toContain('b.hover(1.0, 5.0, 4.0, 5.0, 0.3);');
	});
	test('prints back as written', () => {
		const text = HEAD + '  hover from=18,10.5 to=18,16.5 speed=0.1 size=3x0.5 dwell=2\n';
		expect(print(parseOrThrow(text))).toBe(text);
	});
	test('a malformed size is explained', () => {
		const { errors } = parse(HEAD + '  hover from=1,5 to=4,5 speed=0.3 size=3\n');
		expect(errors[0].code).toBe('E004');
	});
});

describe('channel', () => {
	test('turns switch channels on, one call each', () => {
		const rust = toRust(parseOrThrow(HEAD + '  channel 1,2,3 on\n'), 'f');
		expect(rust).toContain('b.map.set_switch(1, true);');
		expect(rust).toContain('b.map.set_switch(3, true);');
	});
	test('rejects a word other than on or off', () => {
		expect(parse(HEAD + '  channel 1 maybe\n').errors[0].code).toBe('E004');
	});
});

describe('the edits block', () => {
	const edits = HEAD + 'edits\n';
	test('takes an enemy with a fractional position', () => {
		const rust = toRust(parseOrThrow(edits + '  drone x=28.5 y=7.5\n'), 'f');
		expect(rust).toContain('b.ent_at(Kind::Drone, 28.5, 7.5);');
	});
	test('takes a lift and a room', () => {
		expect(parse(edits + '  hover from=1,5 to=4,5 speed=0.3\n  room x=2..6 y=4..8\n').errors).toEqual([]);
	});
	test('takes the boss arena once', () => {
		expect(parse(edits + '  arena x=10..30 floor=4\n').errors).toEqual([]);
		expect(parse(edits + '  arena x=10..30 floor=4\n  arena x=2..9 floor=4\n').errors[0].code).toBe('E006');
	});
	test('still refuses a terrain segment', () => {
		expect(parse(edits + '  flat 4\n').errors[0].code).toBe('E008');
	});
});
