// Writes the level rasteriser's golden data by running the TypeScript rasteriser over every tracked level.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/gen-fizz1-raster.ts [--check]
//
// Each tracked level script that parses without errors becomes `fixtures/fizz1/raster/<slug>.json`:
// the world the TypeScript rasteriser builds, with tiles as ids row by row (row 0 is the bottom) and
// a palette that maps each tile word to its id. With `--check` nothing is written; the process
// exits 1 when the committed files differ from regenerated ones. The Rust crate's tests read the files.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TILE_NOTES } from '../packages/language/src/docs.ts';
import { parse } from '../packages/language/src/parser.ts';
import { rasterise } from '../packages/mcp/src/world.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fixtures', 'fizz1', 'raster');

/** The tracked level scripts under `levels/` and `scratch/` that parse without errors. */
function levelPaths(): string[] {
	const listed = spawnSync('git', ['ls-files', '-z', '--', 'levels', 'scratch'], {
		cwd: ROOT,
		encoding: 'utf8',
	});
	if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
	return listed.stdout
		.split('\0')
		.filter((p) => p.endsWith('.fizz'))
		.filter((p) => parse(readFileSync(join(ROOT, p), 'utf8')).errors.length === 0);
}

/** Each tile word's id, which must be unique so the ids can stand for the words. */
function palette(): Record<string, number> {
	const ids: Record<string, number> = {};
	const seen = new Set<number>();
	for (const [word, { id }] of Object.entries(TILE_NOTES)) {
		if (seen.has(id)) throw new Error(`tile id ${id} is used twice`);
		seen.add(id);
		ids[word] = id;
	}
	return ids;
}

/** One line per row of a grid, so a golden file diffs by row. */
function rows<T>(grid: T[], w: number, h: number): string {
	const lines: string[] = [];
	for (let y = 0; y < h; y++) lines.push('\t\t' + JSON.stringify(grid.slice(y * w, (y + 1) * w)));
	return '[\n' + lines.join(',\n') + '\n\t]';
}

function golden(path: string): string {
	const ids = palette();
	const world = rasterise(parse(readFileSync(join(ROOT, path), 'utf8')).ast);
	if (!world) throw new Error(`${path} has no level header`);
	const tiles = world.tiles.map((t) => {
		if (!(t in ids)) throw new Error(`${path}: tile ${t} has no id`);
		return ids[t];
	});
	const fields: [string, string][] = [
		['from', JSON.stringify(path)],
		['w', JSON.stringify(world.w)],
		['h', JSON.stringify(world.h)],
		['name', JSON.stringify(world.name)],
		['id', JSON.stringify(world.id)],
		['theme', JSON.stringify(world.theme)],
		['area', JSON.stringify(world.area)],
		['ground', JSON.stringify(world.ground)],
		['palette', JSON.stringify(ids)],
		['tiles', rows(tiles, world.w, world.h)],
		['liquid', rows(world.liquid.map(Number), world.w, world.h)],
		['hAt', JSON.stringify(world.hAt)],
		['items', JSON.stringify(world.items)],
		['spawns', JSON.stringify(world.spawns)],
		['hovers', JSON.stringify(world.hovers)],
		['switches', JSON.stringify(world.switches)],
		['start', JSON.stringify(world.start)],
	];
	return '{\n' + fields.map(([k, v]) => `\t${JSON.stringify(k)}: ${v}`).join(',\n') + '\n}\n';
}

const wanted = new Map<string, string>();
for (const path of levelPaths()) {
	wanted.set(path.replace(/\.fizz$/, '').replaceAll('/', '-') + '.json', golden(path));
}
const onDisk = existsSync(OUT) ? readdirSync(OUT) : [];

if (process.argv.includes('--check')) {
	const problems: string[] = [];
	for (const [name, text] of wanted) {
		const full = join(OUT, name);
		if (!existsSync(full)) problems.push(`missing: ${name}`);
		else if (readFileSync(full, 'utf8') !== text) problems.push(`differs: ${name}`);
	}
	for (const name of onDisk) if (!wanted.has(name)) problems.push(`stale: ${name}`);
	if (problems.length > 0) {
		console.error(problems.join('\n'));
		console.error(
			'\nfixtures/fizz1/raster is out of date; run `bun run gen:raster` and commit the result.',
		);
		process.exit(1);
	}
	console.log(`fixtures/fizz1/raster is up to date (${wanted.size} files).`);
} else {
	for (const name of onDisk) if (!wanted.has(name)) rmSync(join(OUT, name));
	mkdirSync(OUT, { recursive: true });
	for (const [name, text] of wanted) writeFileSync(join(OUT, name), text);
	console.log(`wrote ${wanted.size} files to fixtures/fizz1/raster.`);
}
