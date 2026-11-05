// Tests for the brush word lists the Palette panel and the command palette share
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { ENEMY_WORDS, ITEM_WORDS, brushWords } from './brush';

describe('brushWords', () => {
	it('lists the level tiles without empty', () => {
		expect(brushWords('tile', ['empty', 'fill', 'block'], [])).toEqual(['fill', 'block']);
	});

	it('uses the built-in item and enemy lists until the backend sends its words', () => {
		expect(brushWords('item', [], [])).toEqual(ITEM_WORDS);
		expect(brushWords('enemy', [], [{ word: 'gloop', kind: 'tile' }])).toEqual(ENEMY_WORDS);
	});

	it('prefers the documented words of the group when there are some', () => {
		const docs = [
			{ word: 'cheezie', kind: 'item' },
			{ word: 'gloop', kind: 'enemy' },
		];
		expect(brushWords('item', [], docs)).toEqual(['cheezie']);
		expect(brushWords('enemy', [], docs)).toEqual(['gloop']);
	});
});
