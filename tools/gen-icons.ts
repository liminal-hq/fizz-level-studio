// Builds the app icon files from the design canvas's "line park" mark: a full cut for large sizes and heavier cuts below 64 px
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Needs `rsvg-convert` and ImageMagick's `magick`. It writes the master `icon.svg` and the files the
// converter makes from it into apps/studio/src-tauri/icons. The results are committed, so only whoever
// changes the icon runs this: `bun run icons`.

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const iconsDir = join(root, 'apps/studio/src-tauri/icons');
/** The committed master: the converter reads this SVG directly. */
const masterSvg = join(iconsDir, 'icon.svg');

/** The tile the mark sits on: the design's "rounded tile", #0c0c10 with a hairline edge. */
const TILE = '#0c0c10';
const TILE_EDGE = 'rgba(255,255,255,0.14)';

/** The gradient the line is drawn in, and the flag's colour, from the Icon page of the design canvas. */
const GRADIENT = `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="14" y1="20" x2="114" y2="120"><stop offset="0" stop-color="#ffaa40"/><stop offset=".55" stop-color="#f43f5e"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>`;
const FLAG = '#22d3ee';

/**
 * One cut of the mark, in a 128 unit box. The drawing loses detail as it gets smaller and the line
 * gets heavier, exactly as the design's size row shows.
 */
interface Cut {
	/** The pixel sizes this cut is used for. */
	sizes: number[];
	stroke: number;
	flagStroke: number;
	/** The mark's share of the tile's width. */
	fill: number;
	body: string;
}

const RIVER_FULL =
	'M104 38C101 40 92.3 44.7 86 50C79.7 55.3 72.7 64.7 66 70C59.3 75.3 51 75 46 82C41 89 37.7 107 36 112';
const RIVER_SECOND =
	'M116 52C112.7 53.3 102.3 55.3 96 60C89.7 64.7 84 74.7 78 80C72 85.3 64 85.7 60 92C56 98.3 55 113.7 54 118';
const RIVER_SHORT = 'M104 38C92 46 72 66 62 74C50 84 42 100 38 112';

const CUTS: Cut[] = [
	{
		sizes: [64, 128, 256, 512, 1024],
		stroke: 5.5,
		flagStroke: 5,
		fill: 0.75,
		body: `<circle cx="64" cy="70" r="50"/><path d="${RIVER_FULL}"/><path d="${RIVER_SECOND}"/><g transform="translate(4 2)"><path d="M30 64V44L37 30L44 44V64Z"/><path d="M37 36V60"/><path d="M22 64V52L26 44L30 52"/><path d="M44 52L48 46L52 52V64H30"/></g><circle cx="92" cy="88" r="10"/><path d="M92 98V110"/>`,
	},
	{
		sizes: [48],
		stroke: 7,
		flagStroke: 6.5,
		fill: 0.8,
		body: `<circle cx="64" cy="70" r="50"/><path d="${RIVER_FULL}"/><g transform="translate(4 2)"><path d="M30 64V44L37 30L44 44V64Z"/></g><circle cx="92" cy="88" r="10"/><path d="M92 98V110"/>`,
	},
	{
		sizes: [32],
		stroke: 9,
		flagStroke: 8,
		fill: 0.82,
		body: `<circle cx="64" cy="70" r="50"/><path d="${RIVER_FULL}"/><g transform="translate(4 2)"><path d="M30 64V44L37 30L44 44V64Z"/></g><circle cx="92" cy="88" r="10"/>`,
	},
	{
		sizes: [24],
		stroke: 11,
		flagStroke: 10,
		fill: 0.84,
		body: `<circle cx="64" cy="70" r="50"/><path d="${RIVER_SHORT}"/><path d="M34 64V38L40 32L46 38V64"/>`,
	},
	{
		sizes: [16],
		stroke: 14,
		flagStroke: 13,
		fill: 0.86,
		body: `<circle cx="64" cy="70" r="48"/><path d="${RIVER_SHORT}"/>`,
	},
];

/** The flag, drawn as the design draws it at each size (the smallest cut moves it to clear the circle). */
function flagPath(size: number): string {
	return size <= 16 ? 'M64 22V6H82' : 'M64 20V4H80V13H64';
}

/** The tile with one cut of the mark centred on it, as an SVG of `size` pixels. */
function tileSvg(cut: Cut, size: number): string {
	const scale = (cut.fill * size) / 128;
	const offset = (size - 128 * scale) / 2;
	const radius = size * 0.232;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${GRADIENT}</defs><rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${radius}" fill="${TILE}" stroke="${TILE_EDGE}"/><g transform="translate(${offset} ${offset}) scale(${scale})"><g fill="none" stroke="url(#g)" stroke-width="${cut.stroke}" stroke-linecap="round" stroke-linejoin="round">${cut.body}</g><g fill="none" stroke="${FLAG}" stroke-width="${cut.flagStroke}" stroke-linejoin="round"><path d="${flagPath(size)}"/></g></g></svg>`;
}

function run(command: string[]): void {
	const result = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' });
	if (result.exitCode !== 0) throw new Error(`${command.join(' ')} failed (${result.exitCode})`);
}

function main(): void {
	const work = mkdtempSync(join(tmpdir(), 'fizz-icons-'));
	try {
		// The master is kept as an SVG in the repository, and the converter takes it as it is.
		const full = CUTS[0] as Cut;
		writeFileSync(masterSvg, `${tileSvg(full, 1024)}\n`);

		// The small sizes get their heavier cuts, rasterised here because the converter would only
		// scale the master down.
		const pngs = new Map<number, string>();
		for (const cut of CUTS.slice(1).concat(CUTS[0] as Cut)) {
			for (const size of cut.sizes.filter((n) => n <= 256)) {
				const svg = join(work, `icon-${size}.svg`);
				const png = join(work, `icon-${size}.png`);
				writeFileSync(svg, tileSvg(cut, size));
				run(['rsvg-convert', '-w', String(size), '-h', String(size), '-o', png, svg]);
				pngs.set(size, png);
			}
		}

		run([
			'bun',
			'run',
			'--cwd',
			join(root, 'apps/studio'),
			'tauri',
			'icon',
			masterSvg,
			'--output',
			iconsDir,
		]);
		// Desktop only: no Android or iOS sets, and none of the Windows Store tiles the config never lists.
		for (const extra of ['android', 'ios'])
			rmSync(join(iconsDir, extra), { recursive: true, force: true });
		for (const name of readdirSync(iconsDir))
			if (/^(Square.*Logo|StoreLogo)\.png$/.test(name)) rmSync(join(iconsDir, name));
		// Replace the 32 px icon with its heavier cut, and rebuild the .ico so Windows picks the right
		// cut for each size.
		run(['cp', pngs.get(32) as string, join(iconsDir, '32x32.png')]);
		run([
			'magick',
			...[16, 24, 32, 48, 64, 256].map((size) => pngs.get(size) as string),
			join(iconsDir, 'icon.ico'),
		]);
		console.log(`Icons written to ${iconsDir}`);
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

main();
