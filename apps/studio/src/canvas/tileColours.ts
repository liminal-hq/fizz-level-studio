// Maps a tile word to the theme token that colours it on the canvas, with a glyph for each
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** The token for a tile word the studio does not know. */
export const UNKNOWN_TILE_TOKEN = '--fls-tile-unknown';

/** Tile word to the custom property (defined in `theme/tokens.css`) that colours it. */
export const TILE_TOKENS: Readonly<Record<string, string>> = {
	fill: '--fls-tile-solid',
	block: '--fls-tile-solid',
	cracked: '--fls-tile-solid',
	facade: '--fls-tile-building',
	'wall-bg': '--fls-tile-backdrop',
	'one-way': '--fls-tile-platform',
	bridge: '--fls-tile-platform',
	spike: '--fls-tile-hazard',
	choc: '--fls-tile-liquid',
	furnace: '--fls-tile-hazard',
	'slope-r45': '--fls-tile-slope',
	'slope-l45': '--fls-tile-slope',
	'slope-r22a': '--fls-tile-slope',
	'slope-r22b': '--fls-tile-slope',
	'slope-l22a': '--fls-tile-slope',
	'slope-l22b': '--fls-tile-slope',
	'red-door': '--fls-tile-door-red',
	'blue-door': '--fls-tile-door-blue',
	'green-door': '--fls-tile-door-green',
	gate: '--fls-tile-gate',
	'gate-2': '--fls-tile-gate',
	'gate-3': '--fls-tile-gate',
	grass: '--fls-tile-nature',
	tree: '--fls-tile-nature',
	vine: '--fls-tile-nature',
	rock: '--fls-tile-solid',
	river: '--fls-tile-water',
	path: '--fls-tile-path',
	'house-a': '--fls-tile-building',
	'house-b': '--fls-tile-building',
	shop: '--fls-tile-building',
	fountain: '--fls-tile-water',
	rung: '--fls-tile-climb',
	'rung-top': '--fls-tile-climb',
	'conveyor-l': '--fls-tile-conveyor',
	'conveyor-r': '--fls-tile-conveyor',
	exit: '--fls-tile-exit',
	'crystal-tile': '--fls-tile-crystal',
	'mural-origin': '--fls-tile-backdrop',
	'mural-part': '--fls-tile-backdrop',
};

/** The words that draw nothing: an empty cell shows the canvas background. */
export function isEmptyTile(word: string): boolean {
	return word === 'empty';
}

/** The custom property that colours `word`, or the neutral one for a word not in the table. */
export function tileToken(word: string): string {
	return TILE_TOKENS[word] ?? UNKNOWN_TILE_TOKEN;
}

/** The letter drawn on a tile or object: the word's first letter, upper case. */
export function glyphOf(word: string): string {
	const first = [...word][0];
	return first ? first.toUpperCase() : '';
}

/** Reads one custom property's value; the canvas passes `getComputedStyle(...).getPropertyValue`. */
export type TokenReader = (token: string) => string;

/** One CSS colour per palette index, read through `read`; an unreadable token falls back to neutral. */
export function resolveTileColours(palette: readonly string[], read: TokenReader): string[] {
	const neutral = read(UNKNOWN_TILE_TOKEN).trim();
	return palette.map((word) => {
		if (isEmptyTile(word)) return '';
		const value = read(tileToken(word)).trim();
		return value || neutral;
	});
}
