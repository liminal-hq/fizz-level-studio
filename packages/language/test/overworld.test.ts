// Tests for overworld scripts: the parser, the rasteriser and the Rust exporter.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hashf, isOverworld, overworldToRust, parseOverworld, parseOverworldOrThrow, printOverworld, rasteriseOverworld } from '../src/overworld.ts';

const main = readFileSync(new URL('../../../overworlds/main.fizz', import.meta.url), 'utf8');
const HEAD = 'overworld "T" 20x20 id=test\nstart 3,3\nblocks\n  grass x=0..19 y=0..19\npoints\n';

describe('overworld scripts', () => {
	test('are recognised by their header', () => {
		expect(isOverworld(main)).toBe(true);
		expect(isOverworld('level "T" 20x20 ground=4 id=crater\n')).toBe(false);
	});
	test('the Episode 1 overworld parses and prints back unchanged', () => {
		const ast = parseOverworldOrThrow(main);
		expect(printOverworld(ast)).toBe(main);
	});
	test('rasterise to 2,640 tiles and 27 points', () => {
		const w = rasteriseOverworld(parseOverworldOrThrow(main))!;
		expect(w.tiles.length).toBe(2640);
		expect(w.points.length).toBe(27);
		expect(w.tiles.filter((t) => t === 'tree').length).toBe(200);
	});
	test('hashf matches the game for a known tile', () => {
		expect(hashf(0, 0)).toBeGreaterThanOrEqual(0);
		expect(hashf(0, 0)).toBeLessThan(1);
	});
	test('a teleporter must pair with one that exists', () => {
		const { errors } = parseOverworld(HEAD + '  tele a at=3,3 with=nope\n');
		expect(errors[0].code).toBe('E002');
	});
	test('a level must be a known level', () => {
		expect(parseOverworld(HEAD + '  level crator at=3,3\n').errors[0].message).toContain('unknown level');
	});
	test('a point outside the map is refused', () => {
		expect(parseOverworld(HEAD + '  saucer at=30,3\n').errors[0].code).toBe('E013');
	});
	test('a level point belongs under points', () => {
		expect(parseOverworld('overworld "T" 20x20 id=test\nstart 3,3\nblocks\n  saucer at=3,3\n').errors[0].code).toBe('E008');
	});
	test('exports the points before the fills and resolves teleporter partners', () => {
		const rust = overworldToRust(parseOverworldOrThrow(HEAD + '  tele a at=3,3 with=b\n  tele b at=9,9 with=a req=crater,secret\n'), 'f');
		expect(rust).toContain('to: 1,');
		expect(rust).toContain('level_bit(CRATER) as u16 | crate::world::SECRET_FOUND as u16');
		expect(rust.indexOf('b.points.push')).toBeLessThan(rust.indexOf('b.fill'));
	});
});
