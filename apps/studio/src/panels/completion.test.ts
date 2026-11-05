// Tests for word completion
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { describe, expect, it } from 'vitest';
import { acceptWord, completionsFor, wordBefore } from './completion';

const doc = (word: string, kind: string): WordDoc => ({
	word,
	kind,
	syntax: `${word} ...`,
	example: word,
	note: '',
});

const words = [
	doc('grass', 'tile'),
	doc('path', 'tile'),
	doc('paint', 'statement'),
	doc('pa', 'enemy'),
	doc('paint', 'tile'),
	doc('place', 'statement'),
];

describe('wordBefore', () => {
	it('reads the word that ends at the caret', () => {
		expect(wordBefore('  paint gr', 10)).toEqual({ start: 8, prefix: 'gr' });
		expect(wordBefore('paint', 3)).toEqual({ start: 0, prefix: 'pai' });
		expect(wordBefore('x=1 ', 4)).toEqual({ start: 4, prefix: '' });
	});

	it('takes hyphens as part of a word', () => {
		expect(wordBefore('key-r', 5).prefix).toBe('key-r');
	});
});

describe('completionsFor', () => {
	it('offers paint for pa, statements before tiles before enemies, each word once', () => {
		const result = completionsFor('pa', 2, words);
		expect(result.items.map((d) => d.word)).toEqual(['paint', 'path', 'pa']);
		expect(result.items[0]?.kind).toBe('statement');
		expect(result.start).toBe(0);
		expect(result.end).toBe(2);
	});

	it('completes the word at the caret, not the end of the line', () => {
		const result = completionsFor('paint gr x=1', 8, words);
		expect(result.items.map((d) => d.word)).toEqual(['grass']);
		expect(result.start).toBe(6);
	});

	it('offers nothing for an empty word or no match', () => {
		expect(completionsFor('paint ', 6, words).items).toEqual([]);
		expect(completionsFor('zz', 2, words).items).toEqual([]);
	});

	it('offers nothing for a word already typed in full with nothing longer', () => {
		expect(completionsFor('grass', 5, words).items).toEqual([]);
		expect(completionsFor('place', 5, words).items).toEqual([]);
	});

	it('matches without regard to case and respects the limit', () => {
		expect(completionsFor('PA', 2, words).items.length).toBe(3);
		expect(completionsFor('pa', 2, words, 2).items.length).toBe(2);
	});
});

describe('acceptWord', () => {
	it('swaps the typed word for the chosen one and puts the caret after it', () => {
		const completion = completionsFor('paint gr x=1', 8, words);
		expect(acceptWord('paint gr x=1', completion, 'grass')).toEqual({
			text: 'paint grass x=1',
			caret: 11,
		});
	});
});
