// Writes every real level as grid rows, script lines and a line-to-cell map, for the design prototype's starter levels.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/gen-proto-levels.ts > levels-data.js
import { readFileSync } from 'node:fs';
import { parseOrThrow } from '../packages/language/src/parser.ts';
import { rasterise } from '../packages/mcp/src/world.ts';
import { parseOverworldOrThrow, rasteriseOverworld } from '../packages/language/src/overworld.ts';
import { TILES, ITEMS, KINDS, LEVEL_IDS } from '../packages/language/src/tables.ts';

const levelsRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/levels.rs', import.meta.url), 'utf8');
const numOfRust: Record<string, number> = {};
for (const m of levelsRs.matchAll(/pub const ([A-Z_]+): u8 = (\d+);/g)) numOfRust[m[1]] = Number(m[2]);
const order = Object.entries(LEVEL_IDS).sort((a, b) => numOfRust[a[1].rust] - numOfRust[b[1].rust]).map(([slug]) => slug);

// One character per word. The first few keep the letters the prototype already used.
const CHAR: Record<string, string> = {
	'tile:fill': 'F', 'tile:block': 'B', 'tile:one-way': 'P', 'tile:choc': 'C', 'tile:spike': 'S', 'tile:exit': 'X', 'tile:red-door': 'D', 'tile:crystal-tile': 'Y',
	'tile:slope-r45': 'r', 'tile:slope-l45': 'l', 'tile:slope-r22a': 'm', 'tile:slope-r22b': 'n', 'tile:slope-l22a': 'e', 'tile:slope-l22b': 'f',
	'item:cheezie': 'c', 'item:soda': 's', 'item:choc': 'q', 'item:cookie': 'k', 'item:key-red': 'K',
	'kind:gloop': 'g', 'kind:hopper': 'h', 'kind:bat': 'b', 'kind:marsh': 'M', 'kind:pod': 'Q', 'kind:drone': 'd',
};
const used = new Set(Object.values(CHAR).concat(['.', 'o', 'H']));
const pool = [...'AEGIJLNORTUVWZ', ...'aijptuvwxyz', ...'0123456789', ...'#%&*+=?!'].filter((c) => !used.has(c));
const legend: Record<string, { kind: string; word: string }> = {};
for (const w of Object.keys(TILES)) if (w !== 'empty') { const k = `tile:${w}`; CHAR[k] ??= pool.shift()!; legend[CHAR[k]] = { kind: 'tile', word: w }; }
for (const w of Object.keys(ITEMS)) { const k = `item:${w}`; CHAR[k] ??= pool.shift()!; legend[CHAR[k]] = { kind: 'item', word: w }; }
for (const w of Object.keys(KINDS)) { const k = `kind:${w}`; CHAR[k] ??= pool.shift()!; legend[CHAR[k]] = { kind: 'spawn', word: w }; }
legend['o'] = { kind: 'start', word: 'start' };

// The `///` comment above each level function is its description.
const blurb: Record<string, string> = {};
for (const slug of order) {
	const fn = slug.replace(/-/g, '_');
	const i = levelsRs.indexOf(`\nfn ${fn}() -> LevelData`);
	const lines = levelsRs.slice(0, i).split('\n').reverse();
	const doc: string[] = [];
	for (const l of lines) { if (l.startsWith('///')) doc.unshift(l.replace(/^\/\/\/ ?/, '')); else break; }
	blurb[slug] = doc.join(' ').replace(/\s+/g, ' ').trim();
}
// Three level functions carry no doc comment, so these lines describe what is in them.
blurb['crater'] ||= 'The first level of Episode 1: a walk across the crater floor, with hills, chocolate pools, spikes and a red door before the exit.';
blurb['caves'] ||= 'A cave level with vines to climb, three moving platforms, a cracked wall that a fizz shot opens and a blue key.';
blurb['citadel'] ||= 'The citadel, which ends in a boss arena. Its enemies include rollers, sentries and phantoms.';

function chars(nodes: any[]) {
	const w = rasterise({ nodes });
	if (!w) return null;
	const g: string[] = new Array(w.w * w.h).fill('.');
	const under: Record<number, string> = {};
	let hidden = 0;
	for (let i = 0; i < g.length; i++) { const t = w.tiles[i]; if (t && t !== 'empty') g[i] = CHAR[`tile:${t}`]; }
	const put = (i: number, c: string) => { if (g[i] !== '.') { if (!(i in under) && legend[g[i]]?.kind === 'tile') under[i] = g[i]; else if (!(i in under)) hidden++; } g[i] = c; };
	for (const it of w.items) { const i = it.y * w.w + it.x; if (g[i] === '.' || legend[g[i]]?.kind === 'tile') put(i, CHAR[`item:${it.kind}`]); else hidden++; }
	for (const sp of w.spawns) { const i = Math.floor(sp.y ?? 0) * w.w + Math.floor(sp.x); put(i, CHAR[`kind:${sp.kind}`]); }
	if (w.start) put(w.start.y * w.w + w.start.x, 'o');
	return { w, g, under, hidden };
}

const out: Record<string, unknown> = {};
for (const slug of order) {
	const path = slug === 'crater' ? 'levels/crater.fizz' : `levels/real/${slug}.fizz`;
	const src = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
	const ast = parseOrThrow(src);
	const full = chars(ast.nodes)!;
	const W = full.w.w, H = full.w.h;
	const owner: Record<number, number> = {};
	let prev: string[] | null = null;
	for (let k = 1; k <= ast.nodes.length; k++) {
		const r = chars(ast.nodes.slice(0, k));
		if (!r) continue;
		for (let i = 0; i < r.g.length; i++) if (r.g[i] !== '.' && (!prev || prev[i] !== r.g[i])) owner[i] = ast.nodes[k - 1].line - 1;
		prev = r.g;
	}
	const runs: Record<number, number[][]> = {};
	for (let row = 0; row < H; row++) {
		let x = 0;
		while (x < W) {
			const y = H - 1 - row, i = y * W + x, o = owner[i];
			if (o === undefined) { x++; continue; }
			let e = x;
			while (e + 1 < W && owner[y * W + e + 1] === o) e++;
			(runs[o] ??= []).push([row, x, e]);
			x = e + 1;
		}
	}
	const rows: string[] = [];
	for (let y = H - 1; y >= 0; y--) rows.push(full.g.slice(y * W, (y + 1) * W).join(''));
	const under: [number, number, string][] = [];
	for (const [i, c] of Object.entries(full.under)) { const n = Number(i); under.push([n % W, H - 1 - Math.floor(n / W), c]); }
	const def = LEVEL_IDS[slug];
	const world = full.w;
	out[slug] = {
		name: world.name, w: W, h: H, theme: def.theme, area: def.area, id: numOfRust[def.rust], blurb: blurb[slug],
		start: world.start ? [world.start.x, H - 1 - world.start.y] : [0, H - 1],
		counts: { items: world.items.length, spawns: world.spawns.length, lifts: world.hovers.length, rooms: ast.nodes.filter((n) => n.type === 'rect' && n.op !== 'wall-behind').length },
		arena: ast.nodes.some((n) => n.type === 'arena'), hidden: full.hidden,
		rows, under, lines: src.replace(/\n$/, '').split('\n'), runs,
	};
}
{
	// The overworld: tiles in the same characters as a level, with its points and areas read back from the script lines.
	const src = readFileSync(new URL('../overworlds/main.fizz', import.meta.url), 'utf8');
	const ast = parseOverworldOrThrow(src);
	const W = rasteriseOverworld(ast)!;
	const rows: string[] = [];
	for (let y = W.h - 1; y >= 0; y--) {
		let row = '';
		for (let x = 0; x < W.w; x++) row += CHAR[`tile:${W.tiles[y * W.w + x]}`] ?? '.';
		rows.push(row);
	}
	const sx = Math.floor(W.start.x), sy = Math.floor(W.start.y);
	const r0 = W.h - 1 - sy;
	rows[r0] = rows[r0].slice(0, sx) + 'o' + rows[r0].slice(sx + 1);
	const runs: Record<number, number[][]> = {};
	for (let row = 0; row < W.h; row++) {
		let x = 0;
		while (x < W.w) {
			const o = W.owner[(W.h - 1 - row) * W.w + x];
			if (o < 0) { x++; continue; }
			let e = x;
			while (e + 1 < W.w && W.owner[(W.h - 1 - row) * W.w + e + 1] === o) e++;
			(runs[o] ??= []).push([row, x, e]);
			x = e + 1;
		}
	}
	out['overworld'] = {
		kind: 'overworld', name: W.name, w: W.w, h: W.h, theme: 'overworld', area: 'overworld', id: -1,
		blurb: 'The Episode 1 overworld: four regions cut out by two rivers, a lake with an island, 27 points (levels, teleporters, signs and the saucer) and the paths between them.',
		start: [sx, r0], counts: { items: 0, spawns: 0, lifts: 0, rooms: 0, points: W.points.length }, arena: false, hidden: 0,
		rows, under: [], lines: src.replace(/\n$/, '').split('\n'), runs,
	};
}
console.log('// Every Episode 1 level as the language rebuilds it. Generated by tools/gen-proto-levels.ts; do not edit.');
console.log('window.FIZZ_LEVELS = ' + JSON.stringify({ order, overworlds: ['overworld'], legend, levels: out }) + ';');
