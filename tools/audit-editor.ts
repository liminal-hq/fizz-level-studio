// Counts, per real level, what the editor's tools can and cannot place today.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/audit-editor.ts <truth-dir>
import { readdirSync, readFileSync } from 'node:fs';
import { TILES, ITEMS, KINDS } from '../packages/language/src/tables.ts';

const dir = process.argv[2];
const tilesRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/tiles.rs', import.meta.url), 'utf8');
const idOf: Record<string, number> = {};
for (const m of tilesRs.matchAll(/pub const ([A-Z0-9_]+): u8 = (\d+);/g)) idOf[m[1]] = Number(m[2]);
const wordOfTile = new Map<number, string>();
for (const [w, r] of Object.entries(TILES)) wordOfTile.set(idOf[r], w);
const wordOfItem = Object.fromEntries(Object.entries(ITEMS).map(([w, r]) => [r, w]));
const wordOfKind = Object.fromEntries(Object.entries(KINDS).map(([w, r]) => [r, w]));
// What the prototype palette offers today.
const PTILES = new Set(['fill', 'block', 'one-way', 'choc', 'spike', 'slope-r45', 'slope-l45', 'slope-r22a', 'slope-r22b', 'slope-l22a', 'slope-l22b', 'red-door', 'crystal-tile', 'exit']);
const PITEMS = new Set(['cheezie', 'soda', 'choc', 'cookie', 'key-red']);
const PKINDS = new Set(['gloop', 'hopper', 'bat', 'marsh', 'pod', 'drone']);
const allT = new Set<string>(), allI = new Set<string>(), allK = new Set<string>();
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => parseInt(a) - parseInt(b))) {
	const t = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
	const tiles = new Set<string>();
	for (const id of t.data as number[]) if (id) tiles.add(wordOfTile.get(id)!);
	const items = new Set((t.items as [string][]).map((i) => wordOfItem[i[0]]));
	const kinds = new Set((t.spawns as [string][]).map((s) => wordOfKind[s[0]]));
	const mt = [...tiles].filter((x) => !PTILES.has(x)), mi = [...items].filter((x) => !PITEMS.has(x)), mk = [...kinds].filter((x) => !PKINDS.has(x));
	mt.forEach((x) => allT.add(x)); mi.forEach((x) => allI.add(x)); mk.forEach((x) => allK.add(x));
	const objs = [t.plats.length ? `${t.plats.length} moving platforms` : '', t.rooms.length ? `${t.rooms.length} rooms` : '', t.arena ? 'boss arena' : '', t.switches ? 'switch channels on' : ''].filter(Boolean);
	console.log(`${String(t.id).padStart(2)}  needs beyond the palette: tiles [${mt}] items [${mi}] enemies [${mk}]${objs.length ? '  + objects: ' + objs.join(', ') : ''}`);
}
console.log('\nAcross all levels, not in the palette:\n  tiles', [...allT].sort().join(', '), '\n  items', [...allI].sort().join(', '), '\n  enemies', [...allK].sort().join(', '));
console.log('\nAll tiles', Object.keys(TILES).length - 1, ', items', Object.keys(ITEMS).length, ', enemy kinds', Object.keys(KINDS).length);
