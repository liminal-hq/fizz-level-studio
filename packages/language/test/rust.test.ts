// Tests for the Rust exporter: argument order, rounding of floats and the whole crater function.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parse, parseOrThrow } from '../src/parser.ts';
import { f64, toRust } from '../src/rust.ts';

const HEAD = 'level "T" 40x20 ground=4 id=crater\nstart 3,4\nterrain\n  flat 40\n';
const crater = readFileSync(new URL('../../../levels/crater.fizz', import.meta.url), 'utf8');

function calls(body: string): string[] {
	const out = toRust(parseOrThrow(HEAD + body), 'f').split('\n').map((l) => l.trim());
	return out.slice(out.indexOf('b.run(&[(Seg::Flat, 40)]);') + 1, out.indexOf('b.out(CRATER, (3.0, 4.0), None)'));
}

describe('toRust', () => {
	test('wraps the calls in a function that builds and returns the level', () => {
		const rust = toRust(parseOrThrow(HEAD), 'my_level');
		expect(rust).toContain('fn my_level() -> LevelData {');
		expect(rust).toContain('let mut b = Builder::new(40, 20, 4);');
		expect(rust).toContain('b.out(CRATER, (3.0, 4.0), None)');
	});

	test('floats keep their spelling and whole numbers gain .0', () => {
		expect(f64({ value: 7, text: '7' })).toBe('7.0');
		expect(f64({ value: 88.5, text: '88.5' })).toBe('88.5');
	});

	test('row converts a range and step into the count Builder::row wants', () => {
		expect(calls('treats\n  row choc x=6..12 y=8 by=3\n  row cheezie x=17..20 y=7\n')).toEqual([
			'b.row(ItemKind::Choc, 6, 3, 8, 3);',
			'b.row(ItemKind::Cheezie, 17, 4, 7, 1);',
		]);
	});

	test('room and secret-room use (x0, y0, x1, y1) while wall-behind uses (x0, x1, y0, y1)', () => {
		expect(calls('blocks\n  room x=1..5 y=6..9\n  secret-room x=1..5 y=6..9\n  wall-behind x=1..5 y=6..9\n')).toEqual([
			'b.room(1, 6, 5, 9);',
			'b.secret_room(1, 6, 5, 9);',
			'b.wall_behind(1, 5, 6, 9);',
		]);
	});

	test('spawn forms pick ent, ent_at, rider and ent_dir', () => {
		expect(calls('enemies\n  gloop x=3,4\n  drone x=8.5 y=7.5\n  hopper x=9 y=5 ride\n  mirror x=11 y=6 dir=1\n')).toEqual([
			'b.ent(Kind::Gloop, 3.0);',
			'b.ent(Kind::Gloop, 4.0);',
			'b.ent_at(Kind::Drone, 8.5, 7.5);',
			'b.rider(Kind::Hopper, 9.0, 5.0);',
			'b.ent_dir(Kind::Mirror, 11.0, 6.0, 1.0);',
		]);
	});

	test('other statements', () => {
		expect(calls('terrain\n  liquid furnace\nblocks\n  plat x=1..3 y=6\n  ladder x=4 y=4..9\n  stairs-left x=9 y=4 count=3\n  hover from=2,4.5 to=8,4.5 speed=0.3\ntreats\n  key-red x=1,2 y=4\n  pogo-cache x=8..10 rise=7\n')).toEqual([
			'b.liquid = FURNACE;',
			'b.plat(1, 3, 6);',
			'b.ladder(4, 4, 9);',
			'b.stairs_left(9, 4, 3);',
			'b.hover(2.0, 4.5, 8.0, 4.5, 0.3);',
			'b.item(ItemKind::KeyRed, 1, 4);',
			'b.item(ItemKind::KeyRed, 2, 4);',
			'b.pogo_cache(8, 10, 7);',
		]);
	});

	test('the arena goes into out()', () => {
		const rust = toRust(parseOrThrow(`${HEAD}arena x=118..147 floor=4\n`), 'f');
		expect(rust).toContain('Some(Arena { x0: 118.0, x1: 147.0, floor: 4.0 })');
	});

	test('crater.fizz exports the same calls, in order, as the hand-written crater()', () => {
		const rust = toRust(parseOrThrow(crater), 'crater_fizz');
		expect(rust).toContain('b.run(&[(Seg::Flat, 14), (Seg::Up, 2), (Seg::Flat, 6), (Seg::Down, 2), (Seg::Flat, 5)]);');
		expect(rust).toContain('b.row(ItemKind::Choc, 46, 3, 8, 3);');
		expect(rust).toContain('b.fill(171, 171, 8, 27, BLOCK);');
		expect(rust).toContain('b.pogo_cache(8, 10, 7);');
		expect(rust).toContain('b.ent_at(Kind::Drone, 165.5, 7.5);');
		expect(rust).toContain('b.out(CRATER, (3.0, 4.0), None)');
		// 5 run lines, 7 crystals, 14 treats rows or items, 1 pogo cache, 9 spawns.
		expect(rust.split('\n').filter((l) => /^\s+b\./.test(l)).length).toBe(5 + 1 + 6 + 7 + 14 + 1 + 9 + 1);
	});

	test('refuses scripts with errors and bad function names', () => {
		expect(() => toRust(parse('level "T" 10x10 ground=2 id=crater\nstart 1,1\nterrain\n  flatt 3\n').ast, 'f')).toThrow();
		expect(() => toRust(parseOrThrow(HEAD), 'Bad-Name')).toThrow();
	});
});
