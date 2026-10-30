// Overworld scripts: a map of tiles, areas, paths and points, with a parser, a rasteriser and a Rust exporter.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Args, parseNum } from './args.ts';
import type { Num, Range } from './ast.ts';
import { FizzErrors, LineError, fail, suggest } from './errors.ts';
import type { FizzError } from './errors.ts';
import { AREAS, LEVEL_IDS, TILES } from './tables.ts';

export type OwSection = 'blocks' | 'points' | 'edits';
const OW_SECTIONS: OwSection[] = ['blocks', 'points', 'edits'];
const POINT_WORDS = ['level', 'tele', 'saucer', 'sign'];

export type OwBody =
	| { type: 'blank' }
	| { type: 'comment' }
	| { type: 'error'; code: string }
	| { type: 'overworld'; name: string; w: number; h: number; id: string }
	| { type: 'start'; x: Num; y: Num }
	| { type: 'area'; area: string; x: Range; y: Range }
	| { type: 'section'; name: OwSection }
	| { type: 'tile'; tile: string; x: Range; y: Range }
	| { type: 'path'; from: [number, number]; to: [number, number] }
	| { type: 'scatter' }
	| { type: 'level'; slug: string; at: [Num, Num]; req: string[]; big: boolean; hidden: boolean }
	| { type: 'tele'; label: string; at: [Num, Num]; with: string; req: string[]; hidden: boolean }
	| { type: 'saucer'; at: [Num, Num] }
	| { type: 'sign'; n: number; at: [Num, Num] };

export type OwNode = OwBody & { line: number; raw: string | null; comment: string | null };
export interface OwAst {
	nodes: OwNode[];
}

/** True when a script's first statement is an `overworld` header. */
export function isOverworld(text: string): boolean {
	for (const raw of text.split('\n')) {
		const code = raw.replace(/\/\/.*$/, '').trim();
		if (code === '') continue;
		return /^overworld\s/.test(code);
	}
	return false;
}

interface State {
	section: OwSection | null;
	header: { w: number; h: number; line: number } | null;
	seen: Set<string>;
	labels: Map<string, number>;
	tele: { label: string; with: string; line: number }[];
}

function splitComment(raw: string): { code: string; comment: string | null } {
	let quoted = false;
	for (let i = 0; i < raw.length - 1; i++) {
		if (raw[i] === '"') quoted = !quoted;
		if (!quoted && raw[i] === '/' && raw[i + 1] === '/') return { code: raw.slice(0, i), comment: raw.slice(i + 2).trim() };
	}
	return { code: raw, comment: null };
}

function insideMap(st: State, axis: 'x' | 'y', lo: number, hi: number): void {
	if (!st.header) return;
	const max = (axis === 'x' ? st.header.w : st.header.h) - 1;
	if (lo < 0 || hi > max) fail('E013', `${axis} ${lo === hi ? lo : `${lo}..${hi}`} is outside the overworld (${axis} runs 0..${max})`, `keep ${axis} within 0..${max}, or change the size on the \`overworld\` line`);
}

function reqList(a: Args): string[] {
	if (!a.has('req')) return [];
	const names = a.text('req', 'crater,meteor-mesa').split(',');
	for (const n of names) {
		if (n !== 'secret' && !Object.hasOwn(LEVEL_IDS, n)) fail('E002', `unknown requirement \`${n}\``, suggest(n, [...Object.keys(LEVEL_IDS), 'secret']));
	}
	return names;
}

function pt(a: Args, key: string, st: State): [Num, Num] {
	const at = a.pair(key, '14,6');
	insideMap(st, 'x', Math.floor(at[0].value), Math.floor(at[0].value));
	insideMap(st, 'y', Math.floor(at[1].value), Math.floor(at[1].value));
	return at;
}

function parseHeader(body: string, st: State): OwBody {
	const m = /^overworld\s+"([^"]*)"\s+(\d+)x(\d+)(?:\s+(.*))?$/.exec(body);
	if (!m) {
		st.header = { w: Infinity, h: Infinity, line: 0 };
		fail('E004', 'the overworld header is malformed', 'write: overworld "Name" 60x44 id=main');
	}
	st.header = { w: Number(m[2]), h: Number(m[3]), line: 0 };
	const a = new Args(m[4] ?? '');
	const id = a.text('id', 'main');
	a.finish('id=NAME');
	if (st.header.w < 3 || st.header.h < 3) fail('E015', `an overworld ${st.header.w}x${st.header.h} is too small`, 'make it at least 3x3');
	return { type: 'overworld', name: m[1], w: st.header.w, h: st.header.h, id };
}

function parseBody(code: string, st: State): OwBody {
	const body = code.trim();
	const sp = body.search(/\s/);
	const word = sp < 0 ? body : body.slice(0, sp);
	const rest = sp < 0 ? '' : body.slice(sp + 1).trim();

	if ((OW_SECTIONS as string[]).includes(word) && rest === '') {
		if (st.section === 'edits') fail('E008', `\`${word}\` cannot follow the edits block`, 'the edits block is last; move this section above `edits`');
		if (st.seen.has(word) && word === 'edits') fail('E006', 'a second edits block', 'merge the lines into the first `edits` block');
		st.seen.add(word);
		st.section = word as OwSection;
		return { type: 'section', name: word as OwSection };
	}
	if (word === 'overworld') {
		if (st.header) fail('E006', 'a second `overworld` header', 'a script holds one overworld');
		return parseHeader(body, st);
	}
	if (!st.header) fail('E007', 'the script has a statement before its `overworld` header', 'start the script with: overworld "Name" 60x44 id=main');
	const a = new Args(rest);
	switch (word) {
		case 'start': {
			const pair = rest.replace(/\s*,\s*/g, ',').trim().split(',');
			if (pair.length !== 2 || pair.some((p) => p === '')) fail('E004', '`start` takes two numbers', 'write `start 9.2,8.2`');
			if (st.seen.has('start')) fail('E006', 'a second `start` line', 'keep one `start` line');
			st.seen.add('start');
			return { type: 'start', x: parseNum(pair[0], 'start x'), y: parseNum(pair[1], 'start y') };
		}
		case 'area': {
			const name = a.word('area name', 'write `area crater-fields x=0..24 y=0..22`');
			if (!AREAS.includes(name)) fail('E002', `unknown area \`${name}\``, suggest(name, AREAS));
			const x = a.range('x', '0..24');
			const y = a.range('y', '0..22');
			a.finish('AREA x=A..B y=A..B');
			insideMap(st, 'x', x.lo, x.hi);
			insideMap(st, 'y', y.lo, y.hi);
			return { type: 'area', area: name, x, y };
		}
	}
	if (st.section === null) fail('E008', `\`${word}\` appears before any section header`, 'put it under a `blocks` or `points` header');
	const sec = st.section;
	// `path` is also a tile word, so `path from= to=` draws a route and `path x= y=` fills tiles.
	const route = word === 'path' && a.has('from');
	if (!route && ((Object.hasOwn(TILES, word) && word !== 'empty') || word === 'paint' || word === 'clear')) {
		if (sec === 'points') fail('E008', `\`${word}\` belongs under \`blocks\`, not \`points\``, 'move the line under a `blocks` header');
		if (word === 'paint' || word === 'clear') fail('E001', `\`${word}\` is not used in an overworld script`, 'write the tile word first, such as `river x=24..25 y=0..43`');
		const x = a.range('x', '24..25');
		const y = a.range('y', '0..43');
		a.finish('x=A..B y=A..B');
		insideMap(st, 'x', x.lo, x.hi);
		insideMap(st, 'y', y.lo, y.hi);
		return { type: 'tile', tile: word, x, y };
	}
	if (route || word === 'scatter') {
		if (sec === 'points') fail('E008', `\`${word}\` belongs under \`blocks\`, not \`points\``, 'move the line under a `blocks` header');
		if (word === 'scatter') {
			a.finish('nothing');
			return { type: 'scatter' };
		}
		const f = a.pair('from', '8,9');
		const t = a.pair('to', '14,6');
		a.finish('from=X,Y to=X,Y');
		for (const p of [f, t]) {
			if (!Number.isInteger(p[0].value) || !Number.isInteger(p[1].value)) fail('E004', 'a path runs between whole tiles', 'write whole numbers, such as `from=8,9`');
			insideMap(st, 'x', p[0].value, p[0].value);
			insideMap(st, 'y', p[1].value, p[1].value);
		}
		return { type: 'path', from: [f[0].value, f[1].value], to: [t[0].value, t[1].value] };
	}
	if (POINT_WORDS.includes(word)) {
		if (sec === 'blocks') fail('E008', `\`${word}\` belongs under \`points\`, not \`blocks\``, 'move the line under a `points` header');
		switch (word) {
			case 'level': {
				const slug = a.word('level id', 'write `level crater at=14,6`');
				if (!Object.hasOwn(LEVEL_IDS, slug)) fail('E002', `unknown level \`${slug}\``, suggest(slug, Object.keys(LEVEL_IDS)));
				const at = pt(a, 'at', st);
				const req = reqList(a);
				const big = a.flag('big'), hidden = a.flag('hidden');
				a.finish('LEVEL at=X,Y [req=LIST] [big] [hidden]');
				return { type: 'level', slug, at, req, big, hidden };
			}
			case 'tele': {
				const label = a.word('teleporter name', 'write `tele pad-a at=12,19 with=pad-b`');
				if (st.labels.has(label)) fail('E006', `a second teleporter called \`${label}\``, 'give each teleporter its own name');
				st.labels.set(label, 0);
				const at = pt(a, 'at', st);
				const partner = a.text('with', 'pad-b');
				const req = reqList(a);
				const hidden = a.flag('hidden');
				a.finish('NAME at=X,Y with=NAME [req=LIST] [hidden]');
				st.tele.push({ label, with: partner, line: 0 });
				return { type: 'tele', label, at, with: partner, req, hidden };
			}
			case 'saucer': {
				const at = pt(a, 'at', st);
				a.finish('at=X,Y');
				return { type: 'saucer', at };
			}
			case 'sign': {
				const n = Number(a.word('sign number', 'write `sign 0 at=8,16`'));
				if (!Number.isInteger(n) || n < 0) fail('E004', 'a sign number is a whole number from 0', 'write `sign 0 at=8,16`');
				const at = pt(a, 'at', st);
				a.finish('N at=X,Y');
				return { type: 'sign', n, at };
			}
		}
	}
	const known = sec === 'points' ? POINT_WORDS : [...Object.keys(TILES).filter((t) => t !== 'empty'), 'path', 'scatter'];
	fail('E001', `unknown statement \`${word}\` in \`${sec}\``, `\`${sec}\` takes: ${known.slice(0, 12).join(', ')}${known.length > 12 ? ', ...' : ''}`);
}

export function parseOverworld(text: string): { ast: OwAst; errors: FizzError[] } {
	const st: State = { section: null, header: null, seen: new Set(), labels: new Map(), tele: [] };
	const errors: FizzError[] = [];
	const nodes: OwNode[] = text.split('\n').map((raw, i) => {
		const line = i + 1;
		const { code, comment } = splitComment(raw);
		if (code.trim() === '') return { type: raw.trim() === '' ? 'blank' : 'comment', line, raw, comment } as OwNode;
		try {
			const body = parseBody(code, st);
			if (body.type === 'overworld') st.header!.line = line;
			if (body.type === 'tele') st.tele[st.tele.length - 1].line = line;
			return { ...body, line, raw, comment } as OwNode;
		} catch (e) {
			if (!(e instanceof LineError)) throw e;
			errors.push({ line, code: e.code, message: e.message, fix: e.fix });
			return { type: 'error', code: e.code, line, raw, comment } as OwNode;
		}
	});
	if (!st.header) {
		if (errors.length === 0) errors.push({ line: 1, code: 'E007', message: 'the script has no `overworld` header', fix: 'start the script with: overworld "Name" 60x44 id=main' });
	} else if (!st.seen.has('start')) {
		errors.push({ line: st.header.line, code: 'E010', message: 'the script has no `start` line', fix: 'add `start 9.2,8.2` (where Ben stands when the map opens)' });
	}
	for (const t of st.tele) {
		if (!st.labels.has(t.with)) errors.push({ line: t.line, code: 'E002', message: `teleporter \`${t.label}\` pairs with \`${t.with}\`, which does not exist`, fix: `name an existing teleporter: ${[...st.labels.keys()].join(', ')}` });
	}
	errors.sort((p, q) => p.line - q.line);
	return { ast: { nodes }, errors };
}

export function parseOverworldOrThrow(text: string): OwAst {
	const { ast, errors } = parseOverworld(text);
	if (errors.length > 0) throw new FizzErrors(errors);
	return ast;
}

/** Every parsed line prints as the text it was read from. */
export function printOverworld(ast: OwAst): string {
	return ast.nodes.map((n) => n.raw ?? '').join('\n');
}

// ---------------------------------------------------------------- rasteriser

export interface OwPoint {
	kind: 'saucer' | 'level' | 'tele' | 'sign';
	/** The level slug for a level point, the sign number for a sign. */
	level: string | number;
	x: number;
	y: number;
	/** Index of the paired teleporter. */
	to: number;
	req: string[];
	big: boolean;
	hidden: boolean;
	/** The line of the script that declares the point. */
	line: number;
}

export interface OwWorld {
	w: number;
	h: number;
	name: string;
	id: string;
	/** Tile word per cell, index `y * w + x`; row 0 is the south edge. */
	tiles: string[];
	areas: { area: string; x: Range; y: Range }[];
	points: OwPoint[];
	start: { x: number; y: number };
	/** For each cell, the line of the script that last wrote it. */
	owner: number[];
}

/** The game's `hashf`: a deterministic roll in 0..1 for a tile, so a scatter moves only where a point or path moved. */
export function hashf(x: number, y: number): number {
	let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Chance that a free tile gets a tree, then a rock, in each area (`area_theme` in levels.rs). */
export const SCATTER_RATES: Record<string, [number, number]> = {
	'marshmallow-meadows': [0.14, 0.03],
	'rock-candy-reach': [0.17, 0.03],
	'frosting-frontier': [0.13, 0.04],
	'gumdrop-isle': [0, 0],
	'crater-fields': [0.16, 0.02],
};

export function rasteriseOverworld(ast: OwAst): OwWorld | null {
	const head = ast.nodes.find((n) => n.type === 'overworld');
	if (!head || head.type !== 'overworld') return null;
	const { w, h } = head;
	const world: OwWorld = { w, h, name: head.name, id: head.id, tiles: new Array(w * h).fill('empty'), areas: [], points: [], start: { x: 0, y: 0 }, owner: new Array(w * h).fill(-1) };
	const slugOf = (n: OwNode) => n.line - 1;
	// Points are collected first, whatever their place in the file, because a scatter keeps clear of every one.
	const labels = new Map<string, number>();
	for (const n of ast.nodes) {
		if (n.type === 'tele') labels.set(n.label, world.points.length);
		if (n.type === 'level') world.points.push({ kind: 'level', level: n.slug, x: n.at[0].value, y: n.at[1].value, to: 0, req: n.req, big: n.big, hidden: n.hidden, line: slugOf(n) });
		else if (n.type === 'tele') world.points.push({ kind: 'tele', level: 0, x: n.at[0].value, y: n.at[1].value, to: -1, req: n.req, big: false, hidden: n.hidden, line: slugOf(n) });
		else if (n.type === 'saucer') world.points.push({ kind: 'saucer', level: 'saucer', x: n.at[0].value, y: n.at[1].value, to: 0, req: [], big: false, hidden: false, line: slugOf(n) });
		else if (n.type === 'sign') world.points.push({ kind: 'sign', level: n.n, x: n.at[0].value, y: n.at[1].value, to: 0, req: [], big: false, hidden: false, line: slugOf(n) });
	}
	let k = 0;
	for (const n of ast.nodes) {
		if (n.type === 'level' || n.type === 'saucer' || n.type === 'sign') k++;
		else if (n.type === 'tele') { world.points[k].to = labels.get(n.with) ?? 0; k++; }
	}
	const set = (x: number, y: number, t: string, line: number) => { if (x >= 0 && y >= 0 && x < w && y < h) { world.tiles[y * w + x] = t; world.owner[y * w + x] = line; } };
	const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? world.tiles[y * w + x] : 'river');
	const areaAt = (x: number, y: number) => world.areas.find((r) => x >= r.x.lo && x <= r.x.hi && y >= r.y.lo && y <= r.y.hi)?.area ?? 'crater-fields';
	for (const n of ast.nodes) if (n.type === 'area') world.areas.push({ area: n.area, x: n.x, y: n.y });
	for (const n of ast.nodes) {
		const line = slugOf(n);
		if (n.type === 'start') world.start = { x: n.x.value, y: n.y.value };
		else if (n.type === 'tile') for (let y = n.y.lo; y <= n.y.hi; y++) for (let x = n.x.lo; x <= n.x.hi; x++) set(x, y, n.tile, line);
		else if (n.type === 'path') {
			const [x0, y0] = n.from, [x1, y1] = n.to;
			const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
			if (sx !== 0) for (let x = x0; x !== x1 + sx; x += sx) set(x, y0, 'path', line);
			if (sy !== 0) for (let y = y0; y !== y1 + sy; y += sy) set(x1, y, 'path', line);
			set(x1, y1, 'path', line);
		} else if (n.type === 'scatter') {
			for (let x = 2; x < w - 2; x++) {
				for (let y = 2; y < h - 2; y++) {
					if (get(x, y) !== 'grass') continue;
					let near = world.points.some((p) => Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 3);
					for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (get(x + dx, y + dy) === 'path') near = true;
					if (near) continue;
					const [tr, rr] = SCATTER_RATES[areaAt(x, y)];
					const q = hashf(x + 7919, y + 104729);
					if (q < tr) set(x, y, 'tree', line);
					else if (q < tr + rr) set(x, y, 'rock', line);
				}
			}
		}
	}
	return world;
}

// ---------------------------------------------------------------- Rust

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

/**
 * Rust for `fn <fnName>() -> MapData`, calling an `OverworldBuilder` in file order. The builder (`fill`, `path`,
 * `scatter`, `finish`) has to sit in the game's `levels.rs` beside `build_overworld`, which it mirrors.
 */
export function overworldToRust(ast: OwAst, fnName: string): string {
	if (!/^[a-z_][a-z0-9_]*$/.test(fnName)) throw new Error(`\`${fnName}\` is not a snake_case Rust function name`);
	const bad = ast.nodes.filter((n) => n.type === 'error');
	if (bad.length) throw new FizzErrors(bad.map((n) => ({ line: n.line, code: n.type === 'error' ? n.code : 'E000', message: 'the line failed to parse', fix: 'run the parser and fix its errors first' })));
	const head = ast.nodes.find((n) => n.type === 'overworld');
	const start = ast.nodes.find((n) => n.type === 'start');
	if (!head || head.type !== 'overworld' || !start || start.type !== 'start') throw new Error('a script needs an `overworld` header and a `start` line to export');
	const labels = new Map<string, number>();
	let i = 0;
	for (const n of ast.nodes) if (n.type === 'level' || n.type === 'tele' || n.type === 'saucer' || n.type === 'sign') { if (n.type === 'tele') labels.set(n.label, i); i++; }
	const req = (r: string[]) => (r.length === 0 ? '0' : r.map((x) => (x === 'secret' ? 'crate::world::SECRET_FOUND as u16' : `level_bit(${LEVEL_IDS[x].rust}) as u16`)).join(' | '));
	const mk = (kind: string, level: string, x: number, y: number, to: number, r: string[], big: boolean, hidden: boolean) =>
		`b.points.push(MapPoint { kind: PtKind::${kind}, level: ${level}, x: ${f(x)}, y: ${f(y)}, to: ${to}, req: ${req(r)}, big: ${big}, hidden: ${hidden} });`;
	const body: string[] = [];
	for (const n of ast.nodes) {
		if (n.type === 'level') body.push(mk('Level', LEVEL_IDS[n.slug].rust, n.at[0].value, n.at[1].value, 0, n.req, n.big, n.hidden));
		else if (n.type === 'tele') body.push(mk('Tele', '0', n.at[0].value, n.at[1].value, labels.get(n.with)!, n.req, false, n.hidden));
		else if (n.type === 'saucer') body.push(mk('Saucer', LEVEL_IDS.saucer.rust, n.at[0].value, n.at[1].value, 0, [], false, false));
		else if (n.type === 'sign') body.push(mk('Sign', String(n.n), n.at[0].value, n.at[1].value, 0, [], false, false));
	}
	for (const n of ast.nodes) if (n.type === 'area') body.push(`b.areas.push(AreaRect { x0: ${n.x.lo}, y0: ${n.y.lo}, x1: ${n.x.hi}, y1: ${n.y.hi}, area: ${AREA_RUST[n.area]} });`);
	for (const n of ast.nodes) {
		if (n.type === 'tile') body.push(`b.fill(${n.x.lo}, ${n.x.hi}, ${n.y.lo}, ${n.y.hi}, ${TILES[n.tile]});`);
		else if (n.type === 'path') body.push(`b.path(${n.from[0]}, ${n.from[1]}, ${n.to[0]}, ${n.to[1]});`);
		else if (n.type === 'scatter') body.push('b.scatter();');
	}
	return [
		`/// ${head.name.replace(/[\r\n]/g, ' ')}: generated from an overworld script; edit the script, not this function.`,
		`fn ${fnName}() -> MapData {`,
		`    let mut b = OverworldBuilder::new(${head.w}, ${head.h});`,
		...body.map((l) => `    ${l}`),
		`    b.finish((${f(start.x.value)}, ${f(start.y.value)}))`,
		'}',
		'',
	].join('\n');
}

const AREA_RUST: Record<string, string> = {
	'crater-fields': 'AREA_CRATER_FIELDS',
	'marshmallow-meadows': 'AREA_MARSHMALLOW_MEADOWS',
	'rock-candy-reach': 'AREA_ROCK_CANDY_REACH',
	'frosting-frontier': 'AREA_FROSTING_FRONTIER',
	'gumdrop-isle': 'AREA_GUMDROP_ISLE',
};
