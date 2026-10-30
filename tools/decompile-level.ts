// Writes a real level, as the game dumped it, back out as a Fizz script that rebuilds the same level.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/decompile-level.ts <truth-dir> <out-dir>
// Tiles become the fewest `fill` rectangles, items become `row` runs and single items, and everything else
// keeps the order the game gave it. This proves the language can say the level, not that it reads well.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { TILES, ITEMS, KINDS, LEVEL_IDS } from '../packages/language/src/tables.ts';

const [dir, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const tilesRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/tiles.rs', import.meta.url), 'utf8');
const idOf: Record<string, number> = {};
for (const m of tilesRs.matchAll(/pub const ([A-Z0-9_]+): u8 = (\d+);/g)) idOf[m[1]] = Number(m[2]);
const wordOfTile = new Map<number, string>();
for (const [word, rust] of Object.entries(TILES)) if (word !== 'empty') wordOfTile.set(idOf[rust], word);
const wordOfItem = Object.fromEntries(Object.entries(ITEMS).map(([w, r]) => [r, w]));
const wordOfKind = Object.fromEntries(Object.entries(KINDS).map(([w, r]) => [r, w]));
const levelsRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/levels.rs', import.meta.url), 'utf8');
const numOfRust: Record<string, number> = {};
for (const m of levelsRs.matchAll(/pub const ([A-Z_]+): u8 = (\d+);/g)) numOfRust[m[1]] = Number(m[2]);
const slugOfId = new Map<number, string>();
for (const [slug, def] of Object.entries(LEVEL_IDS)) slugOfId.set(numOfRust[def.rust], slug);
const title = (slug: string) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const rng = (a: number, b: number) => (a === b ? `${a}` : `${a}..${b}`);

/** Greedy rectangles: horizontal runs per row, merged with the identical run on the row above. */
function rects(w: number, h: number, data: number[]): { id: number; x0: number; x1: number; y0: number; y1: number }[] {
	const out: { id: number; x0: number; x1: number; y0: number; y1: number }[] = [];
	let open = new Map<string, { id: number; x0: number; x1: number; y0: number; y1: number }>();
	for (let y = 0; y < h; y++) {
		const now = new Map<string, { id: number; x0: number; x1: number; y0: number; y1: number }>();
		for (let x = 0; x < w; ) {
			const id = data[y * w + x];
			if (id === 0) { x++; continue; }
			let e = x;
			while (e + 1 < w && data[y * w + e + 1] === id) e++;
			const key = `${id}:${x}:${e}`;
			const prev = open.get(key);
			if (prev) { prev.y1 = y; now.set(key, prev); } else { const r = { id, x0: x, x1: e, y0: y, y1: y }; out.push(r); now.set(key, r); }
			x = e + 1;
		}
		open = now;
	}
	return out;
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
for (const f of files) {
	const t = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
	const slug = slugOfId.get(t.id)!;
	const def = LEVEL_IDS[slug];
	const L: string[] = [];
	L.push(`// ${title(slug)}: rebuilt from the game's own data by tools/decompile-level.ts.`);
	L.push(`level "${title(slug)}" ${t.w}x${t.h} ground=4 id=${slug}`);
	L.push(`theme ${def.theme}`, `area ${def.area}`, `start ${t.start[0]},${t.start[1]}`);
	if (t.arena) L.push(`arena x=${rng(t.arena[0], t.arena[1])} floor=${t.arena[2]}`);
	L.push('', 'blocks');
	for (const ch of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]) void ch;
	const on: number[] = [];
	for (let c = 0; c < 32; c++) if (t.switches & (1 << c)) on.push(c);
	if (on.length) L.push(`  channel ${on.join(',')} on`);
	const rs = rects(t.w, t.h, t.data);
	const unknown = new Set<number>();
	for (const r of rs) {
		const word = wordOfTile.get(r.id);
		if (!word) { unknown.add(r.id); continue; }
		L.push(`  ${word} x=${rng(r.x0, r.x1)} y=${rng(r.y0, r.y1)}`);
	}
	for (const p of t.plats as number[][]) {
		const [ax, ay, bx, by, speed, w, h, dwell] = p;
		L.push(`  hover from=${ax},${ay} to=${bx},${by} speed=${speed}${w !== 2 || h !== 0.5 ? ` size=${w}x${h}` : ''}${dwell ? ` dwell=${dwell}` : ''}`);
	}
	for (const r of t.rooms as [number, number, number, number, boolean][]) L.push(`  ${r[4] ? 'secret-room' : 'room'} x=${rng(r[0], r[2])} y=${rng(r[1], r[3])}`);
	L.push('', 'treats');
	const items = (t.items as [string, number, number][]).map((i) => ({ kind: wordOfItem[i[0]], x: i[1] - 0.5, y: i[2] - 0.5 }));
	for (let i = 0; i < items.length; ) {
		let j = i;
		const a = items[i];
		if (i + 1 < items.length && items[i + 1].kind === a.kind && items[i + 1].y === a.y && items[i + 1].x > a.x) {
			const step = items[i + 1].x - a.x;
			j = i + 1;
			while (j + 1 < items.length && items[j + 1].kind === a.kind && items[j + 1].y === a.y && items[j + 1].x - items[j].x === step) j++;
			L.push(`  row ${a.kind} x=${rng(a.x, items[j].x)} y=${a.y}${step === 1 ? '' : ` by=${step}`}`);
		} else L.push(`  ${a.kind} x=${a.x} y=${a.y}`);
		i = j + 1;
	}
	L.push('', 'enemies');
	for (const s of t.spawns as [string, number, number, number, boolean][]) {
		const parts = [`  ${wordOfKind[s[0]]} x=${s[1]} y=${s[2]}`];
		if (s[4]) parts.push('ride'); else if (s[3] !== -1) parts.push(`dir=${s[3]}`);
		L.push(parts.join(' '));
	}
	writeFileSync(`${outDir}/${slug}.fizz`, L.join('\n') + '\n');
	console.log(`${slug}: ${rs.length} fills, ${items.length} items, ${t.spawns.length} spawns${unknown.size ? `, UNKNOWN TILE IDS ${[...unknown]}` : ''}`);
}
