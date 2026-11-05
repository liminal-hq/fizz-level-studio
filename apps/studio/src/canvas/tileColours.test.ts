// Tests for the tile word to colour mapping
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	TILE_TOKENS,
	UNKNOWN_TILE_TOKEN,
	glyphOf,
	resolveTileColours,
	tileToken,
} from './tileColours';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/theme/tokens.css'), 'utf8');

describe('tileToken', () => {
	it('maps a known word and falls back to neutral for an unknown one', () => {
		expect(tileToken('grass')).toBe('--fls-tile-nature');
		expect(tileToken('lava-from-the-future')).toBe(UNKNOWN_TILE_TOKEN);
	});

	it('only names custom properties that tokens.css defines', () => {
		const tokens = new Set([...Object.values(TILE_TOKENS), UNKNOWN_TILE_TOKEN]);
		for (const token of tokens) expect(tokensCss).toContain(`${token}:`);
	});
});

describe('glyphOf', () => {
	it('is the first letter, upper case', () => {
		expect(glyphOf('grass')).toBe('G');
		expect(glyphOf('one-way')).toBe('O');
		expect(glyphOf('')).toBe('');
	});
});

describe('resolveTileColours', () => {
	const values: Record<string, string> = {
		'--fls-tile-solid': ' #111 ',
		'--fls-tile-unknown': '#999',
	};
	const read = (token: string) => values[token] ?? '';

	it('gives one colour per palette index, nothing for empty, neutral for the unreadable', () => {
		expect(resolveTileColours(['empty', 'fill', 'grass', 'mystery'], read)).toEqual([
			'',
			'#111',
			'#999',
			'#999',
		]);
	});
});
