// Exporter: turns a parsed Fizz script into the Rust `Builder` calls that build the same level.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Ast, Node, Num, Range } from './ast.ts';
import { FizzErrors } from './errors.ts';
import { ITEMS, KINDS, LEVEL_IDS, SEGS, TILES } from './tables.ts';

/** A Rust `f64` literal: the source spelling, with `.0` added to a whole number. */
export function f64(n: Num): string {
	return n.text.includes('.') ? n.text : `${n.text}.0`;
}

function expand(rs: Range[]): number[] {
	return rs.flatMap((r) => Array.from({ length: r.hi - r.lo + 1 }, (_, i) => r.lo + i));
}

function emit(n: Node): string[] {
	switch (n.type) {
		case 'blank':
		case 'comment':
		case 'theme':
		case 'area':
		case 'section':
		case 'level':
		case 'start':
		case 'arena':
			return [];
		case 'error':
			throw new Error(`line ${n.line}: cannot export a line that failed to parse`);
		case 'walls':
			return ['b.walls();'];
		case 'segs':
			return [`b.run(&[${n.segs.map((s) => `(Seg::${SEGS[s.seg]}, ${s.n})`).join(', ')}]);`];
		case 'liquid':
			return [`b.liquid = ${TILES[n.tile]};`];
		case 'tile':
			return [`b.fill(${n.x.lo}, ${n.x.hi}, ${n.y.lo}, ${n.y.hi}, ${TILES[n.tile]});`];
		case 'plat':
			return [`b.plat(${n.x.lo}, ${n.x.hi}, ${n.y});`];
		case 'hover':
			if (n.size || n.dwell) {
				const w = n.size ? `.sized(${f64(n.size[0])}, ${f64(n.size[1])})` : '';
				const d = n.dwell ? `.with_dwell(${f64(n.dwell)})` : '';
				return [`b.plats.push(Platform::new(${f64(n.from[0])}, ${f64(n.from[1])}, ${f64(n.to[0])}, ${f64(n.to[1])}, ${f64(n.speed)})${w}${d});`];
			}
			return [`b.hover(${f64(n.from[0])}, ${f64(n.from[1])}, ${f64(n.to[0])}, ${f64(n.to[1])}, ${f64(n.speed)});`];
		case 'channel':
			return n.chs.map((c) => `b.map.set_switch(${c}, ${n.on});`);
		case 'crystal':
			return expand(n.xs).map((x) => `b.crys(${x});`);
		case 'rect':
			if (n.op === 'wall-behind') return [`b.wall_behind(${n.x.lo}, ${n.x.hi}, ${n.y.lo}, ${n.y.hi});`];
			// `room` and `secret_room` take (x0, y0, x1, y1), unlike `fill` and `wall_behind`.
			return [`b.${n.op === 'room' ? 'room' : 'secret_room'}(${n.x.lo}, ${n.y.lo}, ${n.x.hi}, ${n.y.hi});`];
		case 'mural':
			return [`b.mural(${n.x}, ${n.y});`];
		case 'ladder':
			return [`b.ladder(${n.x}, ${n.y.lo}, ${n.y.hi});`];
		case 'stairs':
			return [`b.stairs_${n.side}(${n.x}, ${n.y}, ${n.count});`];
		case 'vine-nook':
			return [`b.vine_nook(${n.x}, ${n.foot}, ${n.shelf}, ${n.dir}, ${n.depth}, ${n.h});`];
		case 'item':
			return expand(n.xs).map((x) => `b.item(ItemKind::${ITEMS[n.kind]}, ${x}, ${n.y});`);
		case 'row': {
			const count = (n.x.hi - n.x.lo) / n.by + 1;
			return [`b.row(ItemKind::${ITEMS[n.kind]}, ${n.x.lo}, ${count}, ${n.y}, ${n.by});`];
		}
		case 'pogo-cache':
			return [`b.pogo_cache(${n.x.lo}, ${n.x.hi}, ${n.rise});`];
		case 'spawn': {
			const kind = `Kind::${KINDS[n.kind]}`;
			return n.xs.map((x) => {
				if (n.y === null) return `b.ent(${kind}, ${f64(x)});`;
				if (n.ride) return `b.rider(${kind}, ${f64(x)}, ${f64(n.y)});`;
				if (n.dir) return `b.ent_dir(${kind}, ${f64(x)}, ${f64(n.y)}, ${f64(n.dir)});`;
				return `b.ent_at(${kind}, ${f64(x)}, ${f64(n.y)});`;
			});
		}
		case 'paint':
		case 'clear': {
			const tile = n.type === 'paint' ? TILES[n.tile] : 'EMPTY';
			return n.xs.flatMap((x) => n.ys.map((y) => `b.fill(${x.lo}, ${x.hi}, ${y.lo}, ${y.hi}, ${tile});`));
		}
		case 'place':
			return expand(n.xs).flatMap((x) => expand(n.ys).map((y) => `b.item(ItemKind::${ITEMS[n.kind]}, ${x}, ${y});`));
	}
}

/**
 * Rust source for `fn <fnName>() -> LevelData` that calls the Builder in file order, as the
 * hand-written level functions in `levels.rs` do. It must sit in `levels.rs` or in a child module that
 * has `use super::*;`, because `Builder` and `Seg` are private to that module.
 */
export function toRust(ast: Ast, fnName: string): string {
	if (!/^[a-z_][a-z0-9_]*$/.test(fnName)) {
		throw new Error(`\`${fnName}\` is not a snake_case Rust function name`);
	}
	const bad = ast.nodes.filter((n) => n.type === 'error');
	if (bad.length > 0) {
		throw new FizzErrors(bad.map((n) => ({ line: n.line, code: n.type === 'error' ? n.code : 'E000', message: 'the line failed to parse', fix: 'run the parser and fix its errors first' })));
	}
	const level = ast.nodes.find((n) => n.type === 'level');
	const start = ast.nodes.find((n) => n.type === 'start');
	if (!level || level.type !== 'level' || !start || start.type !== 'start') {
		throw new Error('a script needs a `level` header and a `start` line to export');
	}
	const arena = ast.nodes.find((n) => n.type === 'arena');
	const arenaText =
		arena && arena.type === 'arena'
			? `Some(Arena { x0: ${f64({ value: arena.x.lo, text: String(arena.x.lo) })}, x1: ${f64({ value: arena.x.hi, text: String(arena.x.hi) })}, floor: ${f64(arena.floor)} })`
			: 'None';

	const body: string[] = [];
	let inEdits = false;
	for (const n of ast.nodes) {
		if (n.type === 'section' && n.name === 'edits' && !inEdits) {
			inEdits = true;
			body.push('// Edits painted in the studio.');
		}
		for (const l of emit(n)) body.push(l);
	}
	const lines = [
		`/// ${level.name.replace(/[\r\n]/g, ' ')}: generated from a Fizz script; edit the script, not this function.`,
		`fn ${fnName}() -> LevelData {`,
		`    let mut b = Builder::new(${level.w}, ${level.h}, ${level.ground});`,
		...body.map((l) => `    ${l}`),
		`    b.out(${LEVEL_IDS[level.id].rust}, (${f64(start.x)}, ${f64(start.y)}), ${arenaText})`,
		'}',
		'',
	];
	return lines.join('\n');
}
