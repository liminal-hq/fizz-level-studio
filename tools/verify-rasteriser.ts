// Checks the MCP rasteriser against the real level: every tile, item and spawn of `crater()` as the game builds it.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/verify-rasteriser.ts <crater-truth.json> [levels/crater.fizz]
// The truth file is written by the `dump_crater_truth` test in the scratch Rust copy (FIZZ_DUMP=<file>).
import { readFileSync } from 'node:fs';
import { parseOrThrow } from '../packages/language/src/parser.ts';
import { rasterise } from '../packages/mcp/src/world.ts';
import { TILES, ITEMS, KINDS } from '../packages/language/src/tables.ts';

const truthPath = process.argv[2];
const scriptPath = process.argv[3] ?? 'levels/crater.fizz';
const truth = JSON.parse(readFileSync(truthPath, 'utf8'));
const world = rasterise(parseOrThrow(readFileSync(scriptPath, 'utf8')))!;

// Tile ids come from the game's own constants in tiles.rs (read from the scratch copy of the crates).
const tilesRs = readFileSync(new URL('../scratch/rust/episodes/episode-1/game/src/tiles.rs', import.meta.url), 'utf8');
const idOf: Record<string, number> = {};
for (const m of tilesRs.matchAll(/pub const ([A-Z0-9_]+): u8 = (\d+);/g)) idOf[m[1]] = Number(m[2]);
const wordOfId = new Map<number, string>();
for (const [word, rust] of Object.entries(TILES)) if (rust in idOf) wordOfId.set(idOf[rust], word);

let tileMismatch = 0;
const examples: string[] = [];
if (truth.w !== world.w || truth.h !== world.h) throw new Error(`size differs: game ${truth.w}x${truth.h}, rasteriser ${world.w}x${world.h}`);
let filled = 0;
for (let i = 0; i < truth.data.length; i++) {
	const id = truth.data[i] as number;
	const expected = id === 0 ? 'empty' : (wordOfId.get(id) ?? `id${id}`);
	const got = world.tiles[i] && world.tiles[i] !== '' ? world.tiles[i] : 'empty';
	if (id !== 0) filled++;
	if (expected !== got) {
		tileMismatch++;
		if (examples.length < 8) examples.push(`tile x=${i % truth.w} y=${Math.floor(i / truth.w)}: game ${expected}, rasteriser ${got}`);
	}
}

const itemWord = Object.fromEntries(Object.entries(ITEMS).map(([w, r]) => [r, w]));
const kindWord = Object.fromEntries(Object.entries(KINDS).map(([w, r]) => [r, w]));
let itemMismatch = 0;
if (truth.items.length !== world.items.length) { itemMismatch++; examples.push(`item count: game ${truth.items.length}, rasteriser ${world.items.length}`); }
truth.items.forEach((it: [string, number, number], k: number) => {
	const w = world.items[k];
	const ok = w && w.kind === itemWord[it[0]] && w.x + 0.5 === it[1] && w.y + 0.5 === it[2];
	if (!ok) { itemMismatch++; if (examples.length < 12) examples.push(`item #${k}: game ${it[0]} at ${it[1]},${it[2]}, rasteriser ${w ? `${w.kind} at ${w.x + 0.5},${w.y + 0.5}` : 'none'}`); }
});
let spawnMismatch = 0;
if (truth.spawns.length !== world.spawns.length) { spawnMismatch++; examples.push(`spawn count: game ${truth.spawns.length}, rasteriser ${world.spawns.length}`); }
truth.spawns.forEach((sp: [string, number, number, number, boolean], k: number) => {
	const w = world.spawns[k];
	const ok = w && w.kind === kindWord[sp[0]] && w.x === sp[1] && w.y === sp[2] && w.ride === sp[4];
	if (!ok) { spawnMismatch++; if (examples.length < 16) examples.push(`spawn #${k}: game ${sp[0]} at ${sp[1]},${sp[2]}, rasteriser ${w ? `${w.kind} at ${w.x},${w.y}` : 'none'}`); }
});
const startOk = world.start && world.start.x === truth.start[0] && world.start.y === truth.start[1];

console.log(`level ${truth.w} x ${truth.h}: ${filled} filled tiles in the game's data`);
console.log(`tiles:  ${truth.data.length - tileMismatch} of ${truth.data.length} cells agree`);
console.log(`items:  ${truth.items.length - itemMismatch} of ${truth.items.length} agree (cell centre = cell + 0.5, in order)`);
console.log(`spawns: ${truth.spawns.length - spawnMismatch} of ${truth.spawns.length} agree`);
console.log(`start:  ${startOk ? 'agrees' : 'DIFFERS'}`);
if (examples.length) console.log('first differences:\n  ' + examples.join('\n  '));
process.exit(tileMismatch || itemMismatch || spawnMismatch || !startOk ? 1 : 0);
