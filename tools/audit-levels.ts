// Lists what each real level uses that the language cannot say yet, from the game's own data.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/audit-levels.ts <truth-dir>   (the directory FIZZ_DUMP_ALL wrote)
import { readdirSync, readFileSync } from 'node:fs';
import { TILES, ITEMS, KINDS } from '../packages/language/src/tables.ts';

const dir = process.argv[2];
const tilesRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/tiles.rs', import.meta.url), 'utf8');
const idOf: Record<string, number> = {};
for (const m of tilesRs.matchAll(/pub const ([A-Z0-9_]+): u8 = (\d+);/g)) idOf[m[1]] = Number(m[2]);
const nameOfId = new Map<number, string>();
for (const [rust, id] of Object.entries(idOf)) nameOfId.set(id, rust);
const knownIds = new Set(Object.values(TILES).map((r) => idOf[r]));
const knownItems = new Set(Object.values(ITEMS));
const knownKinds = new Set(Object.values(KINDS));
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => parseInt(a) - parseInt(b));
for (const f of files) {
	const t = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
	const used = new Map<number, number>();
	for (const id of t.data as number[]) if (id) used.set(id, (used.get(id) ?? 0) + 1);
	const noTile = [...used.keys()].filter((id) => !knownIds.has(id)).map((id) => `${id}=${nameOfId.get(id) ?? '?'}`);
	const noItem = [...new Set((t.items as [string, number, number][]).map((i) => i[0]).filter((k) => !knownItems.has(k)))];
	const noKind = [...new Set((t.spawns as [string][]).map((s) => s[0]).filter((k) => !knownKinds.has(k)))];
	const plats = (t.plats as number[][]);
	const oddPlats = plats.filter((p) => p[5] !== 2 || p[6] !== 0.5 || p[7] !== 0 || p[8] !== 0).length;
	const frac = (t.items as [string, number, number][]).filter((i) => i[1] % 1 !== 0.5 || i[2] % 1 !== 0.5).length;
	console.log(`${String(t.id).padStart(2)} ${t.w}x${t.h} tiles ${used.size} kinds, items ${t.items.length}, spawns ${t.spawns.length}, plats ${plats.length} (${oddPlats} sized/dwell/phase), rooms ${t.rooms.length}, arena ${t.arena ? 'yes' : 'no'}, switches ${t.switches}, floorSolid ${t.floorSolid}`);
	if (noTile.length || noItem.length || noKind.length || frac) console.log('   MISSING', { tiles: noTile, items: noItem, spawns: noKind, fractionalItems: frac });
}
