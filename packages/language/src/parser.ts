// Parser for Fizz scripts: text in, an AST with line numbers and every original line kept, plus errors.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Args, parseInt10, parseNum } from './args.ts';
import type { Ast, Body, Node, Num, Range, SectionName } from './ast.ts';
import { FizzErrors, LineError, closest, fail, suggest } from './errors.ts';
import type { FizzError } from './errors.ts';
import { AREAS, ITEMS, KINDS, LEVEL_IDS, LIQUIDS, SEGS, THEMES, TILES } from './tables.ts';

export interface ParseResult {
	ast: Ast;
	errors: FizzError[];
}

export const SECTIONS: SectionName[] = ['terrain', 'blocks', 'treats', 'enemies', 'edits'];

/** Statements that may appear anywhere before the `edits` block, outside any section's own words. */
const TOP_WORDS = ['level', 'theme', 'area', 'start', 'arena', 'walls'];
const BLOCK_WORDS = ['plat', 'hover', 'channel', 'crystal', 'room', 'secret-room', 'wall-behind', 'mural', 'ladder', 'stairs-right', 'stairs-left', 'vine-nook'];
const TREAT_WORDS = ['row', 'pogo-cache'];
const EDIT_WORDS = ['paint', 'clear', 'place'];
const GROUND_WORDS = new Set(['crystal', 'pogo-cache']);

interface State {
	section: SectionName | null;
	level: { w: number; h: number; id: string; line: number } | null;
	seen: Set<string>;
	terrain: boolean;
	missingLevelReported: boolean;
}

/** Finds the `//` that starts a trailing comment, ignoring any inside a quoted level name. */
function splitComment(raw: string): { code: string; comment: string | null } {
	let quoted = false;
	for (let i = 0; i < raw.length - 1; i++) {
		if (raw[i] === '"') quoted = !quoted;
		if (!quoted && raw[i] === '/' && raw[i + 1] === '/') {
			return { code: raw.slice(0, i), comment: raw.slice(i + 2).trim() };
		}
	}
	return { code: raw, comment: null };
}

/** Where a word belongs, for "wrong section" and "unknown word" fixes. */
function homeOf(word: string): SectionName | 'top' | null {
	if (TOP_WORDS.includes(word)) return 'top';
	if (Object.hasOwn(SEGS, word)) return 'terrain';
	if (word === 'liquid') return 'terrain';
	if (Object.hasOwn(TILES, word) || BLOCK_WORDS.includes(word)) return 'blocks';
	if (Object.hasOwn(ITEMS, word) || TREAT_WORDS.includes(word)) return 'treats';
	if (Object.hasOwn(KINDS, word)) return 'enemies';
	if (EDIT_WORDS.includes(word)) return 'edits';
	return null;
}

function allWords(section: SectionName): string[] {
	switch (section) {
		case 'terrain':
			return [...Object.keys(SEGS), 'liquid'];
		case 'blocks':
			return [...Object.keys(TILES).filter((t) => t !== 'empty'), ...BLOCK_WORDS];
		case 'treats':
			return [...Object.keys(ITEMS), ...TREAT_WORDS];
		case 'enemies':
			return Object.keys(KINDS);
		case 'edits':
			return [...EDIT_WORDS, ...Object.keys(KINDS), 'hover', 'channel', 'room', 'secret-room'];
	}
}

function single(r: Range, what: string): number {
	if (r.lo !== r.hi) {
		fail('E004', `${what} must be one number, found the range ${r.lo}..${r.hi}`, 'write a single whole number');
	}
	return r.lo;
}

function positive(n: number, what: string): number {
	if (n < 1) {
		fail('E015', `${what} must be at least 1, found ${n}`, 'use a count of 1 or more, or delete the line');
	}
	return n;
}

function inside(st: State, axis: 'x' | 'y', lo: number, hi: number): void {
	if (!st.level) return;
	const max = (axis === 'x' ? st.level.w : st.level.h) - 1;
	if (lo < 0 || hi > max) {
		fail('E013', `${axis} ${lo === hi ? lo : `${lo}..${hi}`} is outside the level (${axis} runs 0..${max})`, `keep ${axis} within 0..${max}, or change the size on the \`level\` line`);
	}
}

function tileName(word: string): string {
	if (!Object.hasOwn(TILES, word)) {
		fail('E002', `unknown tile \`${word}\``, suggest(word, Object.keys(TILES)));
	}
	return word;
}

function itemName(word: string): string {
	if (!Object.hasOwn(ITEMS, word)) {
		fail('E002', `unknown item \`${word}\``, suggest(word, Object.keys(ITEMS)));
	}
	return word;
}

function parseLevel(body: string, st: State): Body {
	const m = /^level\s+"([^"]*)"\s+(\d+)x(\d+)(?:\s+(.*))?$/.exec(body);
	if (!m) {
		st.level = { w: Infinity, h: Infinity, id: '', line: 0 };
		fail('E004', 'the level header is malformed', 'write: level "Name" 192x28 ground=4 id=crater');
	}
	// Record the size first so a bad `ground=` or `id=` does not make every later line fail too.
	st.level = { w: Number(m[2]), h: Number(m[3]), id: '', line: 0 };
	const a = new Args(m[4] ?? '');
	const ground = a.int('ground', '4');
	const idText = a.text('id', 'crater');
	a.finish('ground=N id=NAME');
	const w = Number(m[2]);
	const h = Number(m[3]);
	if (w < 3 || h < 3) {
		fail('E015', `a level ${w}x${h} is too small`, 'make it at least 3x3');
	}
	if (!Object.hasOwn(LEVEL_IDS, idText)) {
		fail('E002', `unknown level id \`${idText}\``, suggest(idText, Object.keys(LEVEL_IDS)));
	}
	st.level.id = idText;
	return { type: 'level', name: m[1], w, h, ground, id: idText };
}

function parseSegs(body: string): Body {
	const segs = body.split(',').map((piece) => {
		const m = /^([a-z0-9-]+)\s+(\S+)$/.exec(piece.trim());
		if (!m) {
			fail('E004', `\`${piece.trim()}\` is not a terrain segment`, 'write each segment as a word and a count, such as `flat 14, up 2`');
		}
		if (!Object.hasOwn(SEGS, m[1])) {
			fail('E002', `unknown terrain segment \`${m[1]}\``, suggest(m[1], Object.keys(SEGS)));
		}
		return { seg: m[1], n: positive(parseInt10(m[2], `the count after \`${m[1]}\``), `the count after \`${m[1]}\``) };
	});
	return { type: 'segs', segs };
}

function parseStatement(word: string, rest: string, st: State): Body {
	const a = new Args(rest);
	const lvl = st.level;
	switch (word) {
		case 'theme':
		case 'area': {
			const name = a.word(`${word} name`, `write \`${word} crater\``);
			a.finish(`one ${word} name`);
			const known = word === 'theme' ? THEMES : AREAS;
			if (!known.includes(name)) {
				fail('E002', `unknown ${word} \`${name}\``, suggest(name, known));
			}
			const want = lvl && Object.hasOwn(LEVEL_IDS, lvl.id) ? LEVEL_IDS[lvl.id][word] : undefined;
			if (want !== undefined && want !== name) {
				fail('E014', `${word} \`${name}\` contradicts id \`${lvl!.id}\`, whose ${word} in the level table is \`${want}\``, `write \`${word} ${want}\`, or remove the line (the level table in levels.rs decides ${word})`);
			}
			return { type: word, name };
		}
		case 'start': {
			const pair = rest.replace(/\s*,\s*/g, ',').trim().split(',');
			if (pair.length !== 2 || pair.some((p) => p === '')) {
				fail('E004', '`start` takes two numbers', 'write `start 3,4`');
			}
			const x = parseNum(pair[0], 'start x');
			const y = parseNum(pair[1], 'start y');
			return { type: 'start', x, y };
		}
		case 'arena': {
			const x = a.range('x', '118..147');
			const floor = a.num('floor', '4');
			a.finish('x=A..B floor=N');
			return { type: 'arena', x, floor };
		}
		case 'walls':
			a.finish('nothing');
			return { type: 'walls' };
		case 'liquid': {
			const t = a.word('liquid tile', `write \`liquid ${LIQUIDS[1]}\``);
			a.finish('one liquid');
			if (!LIQUIDS.includes(t)) {
				fail('E002', `\`${t}\` is not a liquid`, `use one of: ${LIQUIDS.join(', ')}`);
			}
			return { type: 'liquid', tile: t };
		}
		case 'plat': {
			const x = a.range('x', '107..108');
			const y = single(a.range('y', '5'), '`y=`');
			a.finish('x=A..B y=N');
			inside(st, 'x', x.lo, x.hi);
			inside(st, 'y', y, y);
			return { type: 'plat', x, y };
		}
		case 'hover': {
			const from = a.pair('from', '97,4.5');
			const to = a.pair('to', '103,4.5');
			const speed = a.num('speed', '0.3');
			let size: [Num, Num] | null = null;
			if (a.has('size')) {
				const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(a.text('size', '3x0.5'));
				if (!m) fail('E004', '`size=` must be width x height, such as 3x0.5', 'write `size=3x0.5` (tiles wide by tiles high)');
				size = [parseNum(m[1], 'the platform width'), parseNum(m[2], 'the platform height')];
			}
			const dwell = a.optNum('dwell');
			a.finish('from=X,Y to=X,Y speed=N [size=WxH] [dwell=SECONDS]');
			return { type: 'hover', from, to, speed, size, dwell };
		}
		case 'channel': {
			const list = a.word('channel list', 'write `channel 1,2,3 on`');
			const state = a.word('on or off', 'write `channel 1,2,3 on`');
			a.finish('a channel list and on or off');
			if (state !== 'on' && state !== 'off') {
				fail('E004', `a channel is \`on\` or \`off\`, found \`${state}\``, 'write `channel 1,2,3 on`');
			}
			const chs = list.split(',').map((p) => parseInt10(p, 'a channel number'));
			if (chs.some((c) => c < 0 || c > 31)) {
				fail('E013', 'switch channels run 0..31', 'use a channel from 0 to 31');
			}
			return { type: 'channel', chs, on: state === 'on' };
		}
		case 'crystal': {
			if (a.has('y')) {
				fail('E009', '`crystal` sits on the ground and takes no `y=`', 'remove `y=`; to place a crystal tile at a height use `paint crystal-tile` in the edits block');
			}
			needGround(st, word);
			const xs = a.ranges('x', '10,26,60');
			a.finish('x=LIST');
			xs.forEach((r) => inside(st, 'x', r.lo, r.hi));
			return { type: 'crystal', xs };
		}
		case 'room':
		case 'secret-room':
		case 'wall-behind': {
			const x = a.range('x', '10..20');
			const y = a.range('y', '4..9');
			a.finish('x=A..B y=A..B');
			inside(st, 'x', x.lo, x.hi);
			inside(st, 'y', y.lo, y.hi);
			return { type: 'rect', op: word, x, y };
		}
		case 'mural': {
			const x = a.int('x', '30');
			const y = a.int('y', '8');
			a.finish('x=N y=N');
			inside(st, 'x', x, x + 2);
			inside(st, 'y', y, y + 1);
			return { type: 'mural', x, y };
		}
		case 'ladder': {
			const x = a.int('x', '30');
			const y = a.range('y', '4..12');
			a.finish('x=N y=BOTTOM..TOP');
			inside(st, 'x', x, x);
			inside(st, 'y', y.lo, y.hi);
			return { type: 'ladder', x, y };
		}
		case 'stairs-right':
		case 'stairs-left': {
			const x = a.int('x', '30');
			const y = a.int('y', '4');
			const count = positive(a.int('count', '6'), '`count=`');
			a.finish('x=N y=N count=N');
			return { type: 'stairs', side: word === 'stairs-right' ? 'right' : 'left', x, y, count };
		}
		case 'vine-nook': {
			const x = a.int('x', '30');
			const foot = a.int('foot', '4');
			const shelf = a.int('shelf', '12');
			const dir = a.int('dir', '1');
			const depth = positive(a.int('depth', '6'), '`depth=`');
			const h = positive(a.int('h', '4'), '`h=`');
			a.finish('x= foot= shelf= dir= depth= h=');
			if (dir !== 1 && dir !== -1) {
				fail('E004', `\`dir=\` must be 1 or -1, found ${dir}`, 'write dir=1 (towards the right) or dir=-1 (towards the left)');
			}
			return { type: 'vine-nook', x, foot, shelf, dir, depth, h };
		}
		case 'row': {
			const kind = itemName(a.word('item kind', 'write `row cheezie x=17..20 y=7`'));
			const x = a.range('x', '17..20');
			const y = single(a.range('y', '7'), '`y=`');
			const by = positive(a.optInt('by', 1), '`by=`');
			a.finish('ITEM x=A..B y=N [by=N]');
			if ((x.hi - x.lo) % by !== 0) {
				const next = x.lo + Math.ceil((x.hi - x.lo) / by) * by;
				const prev = x.lo + Math.floor((x.hi - x.lo) / by) * by;
				fail('E012', `x=${x.lo}..${x.hi} does not end on a step of ${by} from ${x.lo}`, `write x=${x.lo}..${prev} by=${by} (${(prev - x.lo) / by + 1} items) or x=${x.lo}..${next} by=${by}`);
			}
			inside(st, 'x', x.lo, x.hi);
			inside(st, 'y', y, y);
			return { type: 'row', kind, x, y, by };
		}
		case 'pogo-cache': {
			needGround(st, word);
			const x = a.range('x', '8..10');
			const rise = a.int('rise', '7');
			a.finish('x=A..B rise=N');
			return { type: 'pogo-cache', x, rise };
		}
		case 'paint': {
			const tile = tileName(a.word('tile name', 'write `paint one-way x=26,28 y=9`'));
			const xs = a.ranges('x', '26,28,30');
			const ys = a.ranges('y', '9');
			a.finish('TILE x=LIST y=LIST');
			xs.forEach((r) => inside(st, 'x', r.lo, r.hi));
			ys.forEach((r) => inside(st, 'y', r.lo, r.hi));
			return { type: 'paint', tile, xs, ys };
		}
		case 'clear': {
			const xs = a.ranges('x', '12..14');
			const ys = a.ranges('y', '8');
			a.finish('x=LIST y=LIST');
			xs.forEach((r) => inside(st, 'x', r.lo, r.hi));
			ys.forEach((r) => inside(st, 'y', r.lo, r.hi));
			return { type: 'clear', xs, ys };
		}
		case 'place': {
			const kind = itemName(a.word('item kind', 'write `place cheezie x=26,28 y=8`'));
			const xs = a.ranges('x', '26,28,30');
			const ys = a.ranges('y', '8');
			a.finish('ITEM x=LIST y=LIST');
			xs.forEach((r) => inside(st, 'x', r.lo, r.hi));
			ys.forEach((r) => inside(st, 'y', r.lo, r.hi));
			return { type: 'place', kind, xs, ys };
		}
	}
	throw new Error(`unhandled word ${word}`);
}

function needGround(st: State, word: string): void {
	if (!st.terrain) {
		fail('E011', `\`${word}\` reads the ground height, but no terrain line comes before it`, 'move it below the `terrain` lines (statements run in file order)');
	}
}

function parseTile(word: string, rest: string, st: State): Body {
	const a = new Args(rest);
	const x = a.range('x', '49..51');
	const y = a.range('y', '10');
	a.finish('x=A..B y=A..B');
	inside(st, 'x', x.lo, x.hi);
	inside(st, 'y', y.lo, y.hi);
	return { type: 'tile', tile: word, x, y };
}

function parseSpawn(word: string, rest: string, st: State): Body {
	const a = new Args(rest);
	const ride = a.flag('ride');
	const xs = a.nums('x', '35,62,85');
	const y = a.optNum('y');
	const dir = a.optNum('dir');
	a.finish('x=LIST [y=N] [dir=N] [ride]');
	if (y === null) {
		if (dir || ride) {
			fail('E016', '`dir=` and `ride` need an explicit `y=`', `add y=, for example \`${word} x=${xs[0].text} y=7.5${ride ? ' ride' : ''}\``);
		}
		needGround(st, word);
	} else if (ride && dir) {
		fail('E016', '`ride` and `dir=` cannot be combined', 'the Builder has no spawn that does both; use one of them');
	}
	for (const x of xs) inside(st, 'x', Math.floor(x.value), Math.floor(x.value));
	return { type: 'spawn', kind: word, xs, y, dir, ride };
}

function parseBody(code: string, st: State): Body {
	const body = code.trim();
	const sp = body.search(/\s/);
	const word = sp < 0 ? body : body.slice(0, sp);
	const rest = sp < 0 ? '' : body.slice(sp + 1).trim();

	if ((SECTIONS as string[]).includes(word) && rest === '') {
		if (st.section === 'edits') {
			fail('E008', `\`${word}\` cannot follow the edits block`, 'the edits block is last; move this section above `edits`');
		}
		if (word === 'edits' && st.seen.has('edits')) {
			fail('E006', 'a second edits block', 'merge the lines into the first `edits` block');
		}
		st.seen.add(word);
		st.section = word as SectionName;
		return { type: 'section', name: word as SectionName };
	}

	if (word === 'level') {
		if (st.level) {
			fail('E006', 'a second `level` header', 'a script holds one level; split it into two files');
		}
		return parseLevel(body, st);
	}
	if (!st.level) {
		fail('E007', 'the script has a statement before its `level` header', 'start the script with: level "Name" 192x28 ground=4 id=crater');
	}

	if (TOP_WORDS.includes(word)) {
		// The arena is an object the studio places, so it may sit in the edits block as well as above it.
		if (st.section === 'edits' && word === 'arena') {
			if (st.seen.has(word)) fail('E006', 'a second `arena` line', 'keep one `arena` line');
			st.seen.add(word);
			return parseStatement(word, rest, st);
		}
		if (st.section === 'edits') {
			fail('E008', `\`${word}\` cannot appear in the edits block`, 'the edits block holds paint, clear, place, enemies, hover, channel, room and secret-room; move this line above `edits`');
		}
		if (word !== 'walls' && st.seen.has(word)) {
			fail('E006', `a second \`${word}\` line`, `keep one \`${word}\` line`);
		}
		st.seen.add(word);
		return parseStatement(word, rest, st);
	}

	if (st.section === null) {
		const home = homeOf(word);
		fail(
			home ? 'E008' : 'E001',
			home ? `\`${word}\` appears before any section header` : `unknown statement \`${word}\``,
			home && home !== 'top' ? `put it under a \`${home}\` header` : suggest(word, [...TOP_WORDS, ...SECTIONS]),
		);
	}
	const sec = st.section;
	const known = allWords(sec);
	if (!known.includes(word)) {
		const home = homeOf(word);
		if (home && home !== 'top') {
			fail('E008', `\`${word}\` belongs under \`${home}\`, not \`${sec}\``, `move the line under a \`${home}\` header`);
		}
		const near = closest(word, known);
		fail('E001', `unknown statement \`${word}\` in \`${sec}\``, near ? `did you mean \`${near}\`?` : `\`${sec}\` takes: ${known.join(', ')}`);
	}

	if (sec === 'terrain') {
		if (word === 'liquid') return parseStatement(word, rest, st);
		st.terrain = true;
		return parseSegs(body);
	}
	if (sec === 'blocks' && Object.hasOwn(TILES, word)) return parseTile(word, rest, st);
	if (sec === 'treats' && Object.hasOwn(ITEMS, word)) {
		const a = new Args(rest);
		const xs = a.ranges('x', '36');
		const y = single(a.range('y', '5'), '`y=`');
		a.finish('x=LIST y=N');
		xs.forEach((r) => inside(st, 'x', r.lo, r.hi));
		inside(st, 'y', y, y);
		return { type: 'item', kind: word, xs, y };
	}
	if (sec === 'enemies' || (sec === 'edits' && Object.hasOwn(KINDS, word))) return parseSpawn(word, rest, st);
	return parseStatement(word, rest, st);
}

export function parse(text: string): ParseResult {
	const st: State = { section: null, level: null, seen: new Set(), terrain: false, missingLevelReported: false };
	const errors: FizzError[] = [];
	const nodes: Node[] = text.split('\n').map((raw, i) => {
		const line = i + 1;
		const { code, comment } = splitComment(raw);
		if (code.trim() === '') {
			return { type: raw.trim() === '' ? 'blank' : 'comment', line, raw, comment } as Node;
		}
		try {
			const body = parseBody(code, st);
			if (body.type === 'level') st.level!.line = line;
			return { ...body, line, raw, comment } as Node;
		} catch (e) {
			if (!(e instanceof LineError)) throw e;
			if (st.level && st.level.line === 0) st.level.line = line;
			errors.push({ line, code: e.code, message: e.message, fix: e.fix });
			return { type: 'error', code: e.code, line, raw, comment } as Node;
		}
	});
	if (!st.level) {
		if (errors.length === 0) {
			errors.push({ line: 1, code: 'E007', message: 'the script has no `level` header', fix: 'start the script with: level "Name" 192x28 ground=4 id=crater' });
		}
	} else if (!st.seen.has('start')) {
		errors.push({ line: st.level.line, code: 'E010', message: 'the script has no `start` line', fix: 'add `start 3,4` (Ben\'s spawn tile, x then y)' });
	}
	errors.sort((p, q) => p.line - q.line);
	return { ast: { nodes }, errors };
}

export function parseOrThrow(text: string): Ast {
	const { ast, errors } = parse(text);
	if (errors.length > 0) throw new FizzErrors(errors);
	return ast;
}
