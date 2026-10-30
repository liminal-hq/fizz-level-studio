// Rasteriser: runs a Fizz AST on a grid the way the Builder would, for rendering and for checks.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Ast, Node, Range } from '../../language/src/ast.ts';

export interface ItemAt {
	kind: string;
	x: number;
	y: number;
}

export interface SpawnAt {
	kind: string;
	x: number;
	/** Resolved from the ground height when the line gave no `y=`; null when there is no ground there. */
	y: number | null;
	dir: number | null;
	ride: boolean;
}

export interface HoverAt {
	from: [number, number];
	to: [number, number];
	speed: number;
	size: [number, number] | null;
	dwell: number | null;
}

export interface World {
	w: number;
	h: number;
	name: string;
	id: string;
	theme: string | null;
	area: string | null;
	ground: number;
	/** Tile word per cell, index `y * w + x`; row 0 is the bottom. */
	tiles: string[];
	/** True where a cell holds a pool liquid rather than a tile from the blocks section. */
	liquid: boolean[];
	hAt: number[];
	items: ItemAt[];
	spawns: SpawnAt[];
	hovers: HoverAt[];
	/** One bit per switch channel that starts on. */
	switches: number;
	start: { x: number; y: number } | null;
}

/** Statement words the rasteriser reads but does not draw, with what is lost. */
export const IGNORED_STATEMENTS: Record<string, string> = {
	theme: 'checked by the parser; changes nothing on the grid',
	area: 'checked by the parser; changes nothing on the grid',
	arena: 'the boss arena bounds are not drawn',
	'secret-room': 'drawn as facade tiles like `room`; the secret flag is not shown',
	room: 'drawn as facade tiles in empty cells; the room bounds themselves are not shown',
};

export function emptyWorld(w: number, h: number, ground: number): World {
	return {
		w,
		h,
		name: '',
		id: '',
		theme: null,
		area: null,
		ground,
		tiles: new Array(w * h).fill('empty'),
		liquid: new Array(w * h).fill(false),
		hAt: new Array(w).fill(-1),
		items: [],
		spawns: [],
		hovers: [],
		switches: 0,
		start: null,
	};
}

class Builder {
	x = 0;
	ground: number;
	liquidTile = 'choc';
	constructor(readonly world: World) {
		this.ground = world.ground;
	}
	inside(x: number, y: number): boolean {
		return x >= 0 && y >= 0 && x < this.world.w && y < this.world.h;
	}
	set(x: number, y: number, tile: string, liquid = false): void {
		if (!this.inside(x, y)) return;
		this.world.tiles[y * this.world.w + x] = tile;
		this.world.liquid[y * this.world.w + x] = liquid;
	}
	get(x: number, y: number): string {
		return this.inside(x, y) ? this.world.tiles[y * this.world.w + x] : 'empty';
	}
	fill(x0: number, x1: number, y0: number, y1: number, tile: string, liquid = false): void {
		for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.set(x, y, tile, liquid);
	}
	col(x: number, h: number): void {
		this.fill(x, x, 0, h - 1, 'fill');
		if (x >= 0 && x < this.world.w) this.world.hAt[x] = h;
	}
	setH(x: number, v: number): void {
		if (x >= 0 && x < this.world.w) this.world.hAt[x] = v;
	}
	groundAt(x: number): number {
		const v = this.world.hAt[Math.floor(x)];
		return v === undefined ? -1 : v;
	}
	run(segs: { seg: string; n: number }[]): void {
		for (const { seg, n } of segs) {
			for (let i = 0; i < n; i++) {
				const x = this.x;
				switch (seg) {
					case 'flat':
						this.col(x, this.ground);
						this.x++;
						break;
					case 'up':
						this.col(x, this.ground);
						this.set(x, this.ground, 'slope-r45');
						this.setH(x, this.ground + 0.5);
						this.x++;
						this.ground++;
						break;
					case 'down':
						this.ground--;
						this.col(x, this.ground);
						this.set(x, this.ground, 'slope-l45');
						this.setH(x, this.ground + 0.5);
						this.x++;
						break;
					case 'up22':
						this.col(x, this.ground);
						this.set(x, this.ground, 'slope-r22a');
						this.col(x + 1, this.ground);
						this.set(x + 1, this.ground, 'slope-r22b');
						this.x += 2;
						this.ground++;
						break;
					case 'down22':
						this.ground--;
						this.col(x, this.ground);
						this.set(x, this.ground, 'slope-l22a');
						this.col(x + 1, this.ground);
						this.set(x + 1, this.ground, 'slope-l22b');
						this.x += 2;
						break;
					case 'gap':
						this.x++;
						break;
					case 'pool':
						this.set(x, 0, 'fill');
						this.fill(x, x, 1, this.ground - 2, this.liquidTile, true);
						this.setH(x, this.ground - 1);
						this.x++;
						break;
					case 'spikes':
						this.col(x, this.ground);
						this.set(x, this.ground, 'spike');
						this.x++;
						break;
					case 'belt-r':
					case 'belt-l':
						this.col(x, this.ground);
						this.set(x, this.ground - 1, seg === 'belt-r' ? 'conveyor-r' : 'conveyor-l');
						this.x++;
						break;
				}
			}
		}
	}
	item(kind: string, x: number, y: number): void {
		this.world.items.push({ kind, x, y });
	}
	crys(x: number): void {
		this.set(x, Math.ceil(this.groundAt(x)), 'crystal-tile');
	}
}

function cells(rs: Range[]): number[] {
	const out: number[] = [];
	for (const r of rs) for (let v = r.lo; v <= r.hi; v++) out.push(v);
	return out;
}

/** Runs the script in file order, as the Builder would, and returns the grid and entity lists. */
export function rasterise(ast: Ast): World | null {
	const levelNode = ast.nodes.find((n) => n.type === 'level');
	if (!levelNode || levelNode.type !== 'level') return null;
	const world = emptyWorld(levelNode.w, levelNode.h, levelNode.ground);
	world.name = levelNode.name;
	world.id = levelNode.id;
	const b = new Builder(world);
	for (const n of ast.nodes) apply(b, n);
	return world;
}

function apply(b: Builder, n: Node): void {
	const world = b.world;
	switch (n.type) {
		case 'theme':
			world.theme = n.name;
			break;
		case 'area':
			world.area = n.name;
			break;
		case 'start':
			world.start = { x: n.x.value, y: n.y.value };
			break;
		case 'walls':
			b.fill(0, 0, 0, world.h - 1, 'block');
			b.fill(world.w - 1, world.w - 1, 0, world.h - 1, 'block');
			break;
		case 'segs':
			b.run(n.segs);
			break;
		case 'liquid':
			b.liquidTile = n.tile;
			break;
		case 'tile':
			b.fill(n.x.lo, n.x.hi, n.y.lo, n.y.hi, n.tile);
			break;
		case 'plat':
			b.fill(n.x.lo, n.x.hi, n.y, n.y, 'one-way');
			break;
		case 'hover':
			world.hovers.push({ from: [n.from[0].value, n.from[1].value], to: [n.to[0].value, n.to[1].value], speed: n.speed.value, size: n.size ? [n.size[0].value, n.size[1].value] : null, dwell: n.dwell ? n.dwell.value : null });
			break;
		case 'channel':
			for (const c of n.chs) world.switches = n.on ? (world.switches | (1 << c)) >>> 0 : (world.switches & ~(1 << c)) >>> 0;
			break;
		case 'crystal':
			for (const x of cells(n.xs)) b.crys(x);
			break;
		case 'rect':
			if (n.op === 'wall-behind') {
				for (let x = n.x.lo; x <= n.x.hi; x++) for (let y = n.y.lo; y <= n.y.hi; y++) if (b.get(x, y) === 'empty') b.set(x, y, 'wall-bg');
			} else {
				for (let x = n.x.lo; x <= n.x.hi; x++) for (let y = n.y.lo; y <= n.y.hi; y++) if (b.get(x, y) === 'empty') b.set(x, y, 'facade');
			}
			break;
		case 'mural':
			b.fill(n.x, n.x + 2, n.y, n.y + 1, 'mural-part');
			b.set(n.x, n.y, 'mural-origin');
			break;
		case 'ladder':
			b.fill(n.x, n.x, n.y.lo, n.y.hi - 1, 'rung');
			b.set(n.x, n.y.hi, 'rung-top');
			break;
		case 'stairs':
			for (let i = 0; i < n.count; i++) {
				if (n.side === 'right') {
					b.fill(n.x + i, n.x + i, n.y, n.y + i - 1, 'fill');
					b.set(n.x + i, n.y + i, 'slope-r45');
				} else {
					const h = n.count - 1 - i;
					b.fill(n.x + i, n.x + i, n.y, n.y + h - 1, 'fill');
					b.set(n.x + i, n.y + h, 'slope-l45');
				}
			}
			break;
		case 'vine-nook': {
			const far = n.x + n.dir * (3 + n.depth);
			const x0 = Math.min(n.x, far);
			const x1 = Math.max(n.x, far);
			b.fill(x0, x1, n.shelf - 2, n.shelf - 1, 'fill');
			b.fill(x0, x1, n.shelf, n.shelf + n.h - 1, 'empty');
			const cx = n.x + n.dir * 3;
			b.fill(cx, cx, n.shelf, n.shelf + n.h - 1, 'cracked');
			b.fill(n.x, n.x, n.foot, n.shelf + 1, 'vine');
			break;
		}
		case 'item':
			for (const x of cells(n.xs)) b.item(n.kind, x, n.y);
			break;
		case 'row':
			for (let x = n.x.lo; x <= n.x.hi; x += n.by) b.item(n.kind, x, n.y);
			break;
		case 'pogo-cache': {
			const stand = Math.trunc(b.groundAt(n.x.lo)) + n.rise;
			b.fill(n.x.lo, n.x.hi, stand - 1, stand - 1, 'one-way');
			b.item('cookie', n.x.lo + 1, stand);
			b.item('cheezie', n.x.lo, stand);
			b.item('cheezie', n.x.hi, stand);
			break;
		}
		case 'spawn':
			for (const x of n.xs) {
				const y = n.y ? n.y.value : b.groundAt(x.value);
				world.spawns.push({ kind: n.kind, x: x.value, y: y < 0 ? null : y, dir: n.dir ? n.dir.value : null, ride: n.ride });
			}
			break;
		case 'paint':
			for (const x of cells(n.xs)) for (const y of cells(n.ys)) b.set(x, y, n.tile);
			break;
		case 'clear':
			for (const x of cells(n.xs)) for (const y of cells(n.ys)) b.set(x, y, 'empty');
			break;
		case 'place':
			for (const x of cells(n.xs)) for (const y of cells(n.ys)) b.item(n.kind, x, y);
			break;
		default:
			break;
	}
}

// ---- Glyphs ----

const TILE_GLYPH: Record<string, string> = {
	'empty': '.',
	'fill': '#',
	'block': '#',
	'one-way': '=',
	'bridge': '=',
	'spike': '^',
	'choc': '%',
	'slope-r45': '/',
	'slope-r22a': '/',
	'slope-r22b': '/',
	'slope-l45': '\\',
	'slope-l22a': '\\',
	'slope-l22b': '\\',
	'red-door': '+',
	'blue-door': '+',
	'green-door': '+',
	'gate': '+',
	'gate-2': '+',
	'gate-3': '+',
	'exit': '!',
	'crystal-tile': '*',
	'conveyor-l': '<',
	'conveyor-r': '>',
	'wall-bg': ':',
	'rung': 'I',
	'rung-top': 'I',
	'vine': 'v',
	'cracked': 'x',
	'facade': '"',
	'mural-origin': 'm',
	'mural-part': 'm',
};

const ITEM_GLYPH: Record<string, string> = {
	'cheezie': 'z',
	'choc': 'q',
	'cookie': 'k',
	'soda': 's',
	'key-red': 'r',
	'key-blue': 'b',
	'key-green': 'g',
	'usb': 'u',
};

const KIND_GLYPH: Record<string, string> = {
	'gloop': 'G',
	'hopper': 'H',
	'marsh': 'M',
	'beetle': 'B',
	'bat': 'A',
	'pod': 'P',
	'phantom': 'N',
	'roller': 'R',
	'sentry': 'T',
	'drone': 'D',
	'boss': 'Z',
	'switch': 'W',
	'terminal': 'L',
	'cage': 'J',
	'mirror': 'Y',
	'swivel': 'V',
	'crystal-switch': 'K',
	'press': 'U',
	'target': 'Q',
	'glyph': 'E',
	'cameo': 'C',
};

const OTHER_TILE = '&';
const LEGEND_TEXT: Record<string, string> = {
	'.': 'empty',
	'#': 'solid ground, fill or block',
	'=': 'one-way platform or bridge',
	'^': 'spike',
	'%': 'choc tile',
	'/': 'slope rising to the right',
	'\\': 'slope rising to the left',
	'+': 'door or gate',
	'!': 'exit',
	'*': 'crystal tile',
	'<': 'conveyor carrying left',
	'>': 'conveyor carrying right',
	':': 'interior wall (wall-bg)',
	'I': 'ladder rung',
	'v': 'vine',
	'x': 'cracked wall',
	'"': 'facade (room cover)',
	'm': 'mural',
	'~': 'pool liquid',
	'&': 'other tile (see tile list)',
	'S': 'start',
	'-': 'hover platform path (its end points are marked 0)',
	'0': 'hover platform end point',
};

export function tileGlyph(world: World, x: number, y: number): string {
	const i = y * world.w + x;
	if (world.liquid[i]) return '~';
	const t = world.tiles[i];
	return TILE_GLYPH[t] ?? OTHER_TILE;
}

export interface Region {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface Rendering {
	region: Region;
	lines: string[];
	legend: Record<string, string>;
}

/** The glyph for every cell of one world, entities drawn over tiles. */
export function glyphGrid(world: World): string[][] {
	const grid: string[][] = [];
	for (let y = 0; y < world.h; y++) {
		const row: string[] = [];
		for (let x = 0; x < world.w; x++) row.push(tileGlyph(world, x, y));
		grid.push(row);
	}
	const put = (x: number, y: number, ch: string) => {
		const cx = Math.floor(x);
		const cy = Math.floor(y);
		if (cx >= 0 && cy >= 0 && cx < world.w && cy < world.h) grid[cy][cx] = ch;
	};
	for (const hv of world.hovers) {
		const steps = Math.max(1, Math.round(Math.abs(hv.to[0] - hv.from[0])));
		for (let i = 0; i <= steps; i++) {
			put(hv.from[0] + ((hv.to[0] - hv.from[0]) * i) / steps, hv.from[1] + ((hv.to[1] - hv.from[1]) * i) / steps, '-');
		}
		put(hv.from[0], hv.from[1], '0');
		put(hv.to[0], hv.to[1], '0');
	}
	for (const it of world.items) put(it.x, it.y, ITEM_GLYPH[it.kind] ?? '?');
	for (const sp of world.spawns) if (sp.y !== null) put(sp.x, sp.y, KIND_GLYPH[sp.kind] ?? '?');
	if (world.start) put(world.start.x, world.start.y, 'S');
	return grid;
}

function legendFor(world: World, chars: Set<string>): Record<string, string> {
	const legend: Record<string, string> = {};
	for (const ch of chars) {
		if (LEGEND_TEXT[ch]) legend[ch] = LEGEND_TEXT[ch];
	}
	for (const [k, g] of Object.entries(ITEM_GLYPH)) if (chars.has(g) && world.items.some((i) => i.kind === k)) legend[g] = `item: ${k}`;
	for (const [k, g] of Object.entries(KIND_GLYPH)) if (chars.has(g)) legend[g] = `enemy or prop: ${k}`;
	return legend;
}

export function clampRegion(world: World, r: Region): Region {
	return {
		x0: Math.max(0, Math.min(r.x0, r.x1)),
		x1: Math.min(world.w - 1, Math.max(r.x0, r.x1)),
		y0: Math.max(0, Math.min(r.y0, r.y1)),
		y1: Math.min(world.h - 1, Math.max(r.y0, r.y1)),
	};
}

function frame(region: Region, rowText: (y: number) => string): string[] {
	const lines: string[] = [];
	const width = region.x1 - region.x0 + 1;
	const tens = Array.from({ length: width }, (_, i) => ((region.x0 + i) % 10 === 0 ? String(Math.floor((region.x0 + i) / 10) % 10) : ' ')).join('');
	const ones = Array.from({ length: width }, (_, i) => String((region.x0 + i) % 10)).join('');
	lines.push(`     ${tens}`);
	lines.push(`     ${ones}`);
	for (let y = region.y1; y >= region.y0; y--) lines.push(`${String(y).padStart(3)} |${rowText(y)}`);
	return lines;
}

export function render(world: World, region: Region): Rendering {
	const r = clampRegion(world, region);
	const grid = glyphGrid(world);
	const chars = new Set<string>();
	const lines = frame(r, (y) => {
		let s = '';
		for (let x = r.x0; x <= r.x1; x++) {
			s += grid[y][x];
			chars.add(grid[y][x]);
		}
		return s;
	});
	return { region: r, lines, legend: legendFor(world, chars) };
}

/**
 * The pending layer: only the cells that `withPending` shows differently from `base` are drawn, over
 * blanks, so a reader can tell what a proposal would add or change.
 */
export function renderPending(base: World, withPending: World, region: Region): Rendering {
	const r = clampRegion(base, region);
	const a = glyphGrid(base);
	const b = glyphGrid(withPending);
	const chars = new Set<string>();
	const lines = frame(r, (y) => {
		let s = '';
		for (let x = r.x0; x <= r.x1; x++) {
			if (a[y][x] !== b[y][x]) {
				s += b[y][x];
				chars.add(b[y][x]);
			} else s += ' ';
		}
		return s;
	});
	const legend = legendFor(withPending, chars);
	legend[' '] = 'unchanged by any pending proposal';
	return { region: r, lines, legend };
}

// ---- Gap check ----

const NON_SOLID = new Set(['empty', 'spike', 'wall-bg', 'rung', 'vine', 'crystal-tile', 'mural-origin', 'mural-part', 'facade']);
const ONE_WAY = new Set(['one-way', 'bridge', 'rung-top']);

function solidAt(w: World, x: number, y: number): boolean {
	if (x < 0 || y < 0 || x >= w.w || y >= w.h) return false;
	const i = y * w.w + x;
	return !w.liquid[i] && !NON_SOLID.has(w.tiles[i]) && !ONE_WAY.has(w.tiles[i]);
}

function floorAt(w: World, x: number, y: number): boolean {
	if (x < 0 || y < 0 || x >= w.w || y >= w.h) return false;
	const i = y * w.w + x;
	return solidAt(w, x, y) || (!w.liquid[i] && ONE_WAY.has(w.tiles[i]));
}

/** True when a body can stand in row `r` of column `x`: a floor cell just below, and the cell itself free. */
export function standing(w: World, x: number, r: number): boolean {
	if (r < 1 || r >= w.h) return false;
	// A slope tile is walked on inside its own cell, so it counts as a surface in its own row.
	if (!w.liquid[r * w.w + x] && w.tiles[r * w.w + x].startsWith('slope-')) return true;
	const i = r * w.w + x;
	return floorAt(w, x, r - 1) && !solidAt(w, x, r) && !w.liquid[i];
}

export interface Gap {
	row: number;
	x0: number;
	x1: number;
	width: number;
	verdict: 'clear' | 'tight' | 'needs_ledge';
	message: string;
}

export function verdictFor(width: number): Pick<Gap, 'verdict' | 'message'> {
	if (width <= 3) return { verdict: 'clear', message: 'a normal jump clears it' };
	if (width === 4) return { verdict: 'tight', message: 'tight: only a jump timed within a tenth of a second of the edge' };
	return { verdict: 'needs_ledge', message: 'needs a ledge or a hover platform' };
}

/**
 * Gaps: on a surface row, a run of columns with nothing to stand on at that row or any row below it,
 * bounded on the left and right by columns that can be stood on in that same row.
 */
export function findGaps(w: World): Gap[] {
	const found = new Map<string, Gap>();
	for (let r = 1; r < w.h; r++) {
		let x = 0;
		while (x < w.w) {
			if (!standing(w, x, r)) {
				x++;
				continue;
			}
			let e = x + 1;
			while (e < w.w && !standing(w, e, r) && isVoid(w, e, r)) e++;
			if (e < w.w && e > x + 1 && standing(w, e, r)) {
				const x0 = x + 1;
				const x1 = e - 1;
				const key = `${x0}-${x1}`;
				if (!found.has(key)) {
					const width = x1 - x0 + 1;
					found.set(key, { row: r, x0, x1, width, ...verdictFor(width) });
				}
			}
			x = e;
		}
	}
	return [...found.values()].sort((p, q) => p.x0 - q.x0);
}

/** Nothing to stand on in this column at row `r` or any row below it, and nothing solid in the way. */
function isVoid(w: World, x: number, r: number): boolean {
	if (solidAt(w, x, r)) return false;
	for (let k = 1; k <= r; k++) if (standing(w, x, k)) return false;
	return true;
}
