// Checks the TypeScript overworld rasteriser against the game's own overworld.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/verify-overworld.ts <overworld-truth.json> [overworlds/main.fizz]
import { readFileSync } from 'node:fs';
import { parseOverworldOrThrow, rasteriseOverworld } from '../packages/language/src/overworld.ts';
import { LEVEL_IDS, TILES } from '../packages/language/src/tables.ts';

const truth = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const world = rasteriseOverworld(parseOverworldOrThrow(readFileSync(process.argv[3] ?? 'overworlds/main.fizz', 'utf8')))!;
const tilesRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/tiles.rs', import.meta.url), 'utf8');
const idOf: Record<string, number> = {};
for (const m of tilesRs.matchAll(/pub const ([A-Z0-9_]+): u8 = (\d+);/g)) idOf[m[1]] = Number(m[2]);
const wordOfId = new Map<number, string>();
for (const [w, r] of Object.entries(TILES)) wordOfId.set(idOf[r], w);
let bad = 0;
for (let i = 0; i < truth.data.length; i++) if ((wordOfId.get(truth.data[i]) ?? 'empty') !== world.tiles[i]) { if (bad++ < 5) console.log('tile', i % truth.w, Math.floor(i / truth.w), wordOfId.get(truth.data[i]), world.tiles[i]); }
console.log(`tiles: ${truth.data.length - bad} of ${truth.data.length} agree`);
const levelsRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/levels.rs', import.meta.url), 'utf8');
const numOf: Record<string, number> = {};
for (const m of levelsRs.matchAll(/pub const ([A-Z_]+): u8 = (\d+);/g)) numOf[m[1]] = Number(m[2]);
const bitOf = (r: string) => (r === 'secret' ? 1 << 15 : 1 << numOf[LEVEL_IDS[r].rust]);
let pbad = 0;
truth.points.forEach((p: [string, number, number, number, number, number, boolean, boolean], i: number) => {
	const g = world.points[i];
	const level = g.kind === 'level' || g.kind === 'saucer' ? numOf[LEVEL_IDS[g.level as string].rust] : g.kind === 'sign' ? g.level : 0;
	const req = g.req.reduce((a, r) => a | bitOf(r), 0);
	const same = g && g.kind === p[0].toLowerCase() && level === p[1] && g.x === p[2] && g.y === p[3] && (g.kind !== 'tele' || g.to === p[4]) && req === p[5] && g.big === p[6] && g.hidden === p[7];
	if (!same) { pbad++; console.log('point', i, p, g); }
});
console.log(`points: ${truth.points.length - pbad} of ${truth.points.length} agree`);
console.log(`areas: ${JSON.stringify(world.areas.map((a) => [a.x.lo, a.y.lo, a.x.hi, a.y.hi])) === JSON.stringify(truth.areas.map((a: number[]) => [a[0], a[1], a[2], a[3]])) ? 'agree' : 'DIFFER'}; start ${world.start.x === truth.start[0] && world.start.y === truth.start[1] ? 'agrees' : 'DIFFERS'}`);
