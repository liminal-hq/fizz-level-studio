// Tests for the palette matcher: subsequence matching, ranking, highlight ranges and recents
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { matchLabel, rankItems, segments } from './paletteMatch';
import { createRecentCommands } from './paletteRecents';

const item = (id: string, label: string) => ({ id, label });

describe('matchLabel', () => {
	it('matches a subsequence, ignoring case and spaces in the query', () => {
		expect(matchLabel('SVE', 'Save')).not.toBeNull();
		expect(matchLabel('r l', 'Reset layout')).not.toBeNull();
		expect(matchLabel('zz', 'Save')).toBeNull();
		expect(matchLabel('saved', 'Save')).toBeNull();
	});

	it('matches everything, with nothing highlighted, for an empty query', () => {
		expect(matchLabel('', 'Save')).toEqual({ score: 0, ranges: [] });
		expect(matchLabel('  ', 'Save')).toEqual({ score: 0, ranges: [] });
	});

	it('reports the matched runs as ranges', () => {
		expect(matchLabel('sav', 'Save')?.ranges).toEqual([{ start: 0, end: 3 }]);
		expect(matchLabel('rl', 'Reset layout')?.ranges).toEqual([
			{ start: 0, end: 1 },
			{ start: 6, end: 7 },
		]);
	});

	it('prefers word starts to letters in the middle of a word', () => {
		// "gl" could be g-l inside "Brush: gloop", but starting both words is better in "Go to line".
		const wordStarts = matchLabel('gl', 'Go to line…')!;
		const buried = matchLabel('gl', 'Bagel')!;
		expect(wordStarts.score).toBeGreaterThan(buried.score);
		expect(wordStarts.ranges[0]).toEqual({ start: 0, end: 1 });
	});

	it('picks the alignment that lands on word starts', () => {
		const match = matchLabel('rl', 'Reset layout')!;
		expect(match.ranges.map((range) => range.start)).toEqual([0, 6]);
	});

	it('treats a capital after a lower-case letter as a word start', () => {
		expect(matchLabel('tl', 'GoToLine')?.ranges).toEqual([
			{ start: 2, end: 3 },
			{ start: 4, end: 5 },
		]);
	});
});

describe('rankItems', () => {
	const items = [
		item('a', 'Select'),
		item('b', 'Script'),
		item('c', 'Show Script'),
		item('d', 'Save'),
	];

	it('ranks a prefix above a later word start above a scattered match', () => {
		const ranked = rankItems(items, 'sc').map((row) => row.item.id);
		expect(ranked.slice(0, 2)).toEqual(['b', 'c']);
		expect(ranked).toContain('a');
		expect(ranked).not.toContain('d');
	});

	it('keeps the given order between equal scores', () => {
		const same = [item('x', 'Alpha one'), item('y', 'Alpha two'), item('z', 'Alpha one')];
		expect(rankItems(same, 'alpha').map((row) => row.item.id)).toEqual(['x', 'y', 'z']);
		expect(rankItems(same, 'alpha').map((row) => row.item.id)).toEqual(['x', 'y', 'z']);
	});

	it('returns the highlight ranges with each match', () => {
		const [first] = rankItems(items, 'scr');
		expect(first?.item.id).toBe('b');
		expect(first?.ranges).toEqual([{ start: 0, end: 3 }]);
		expect(first?.recent).toBe(false);
	});

	it('lists everything for an empty query, recents first', () => {
		const ranked = rankItems(items, '', ['d', 'missing', 'b']);
		expect(ranked.map((row) => row.item.id)).toEqual(['d', 'b', 'a', 'c']);
		expect(ranked.map((row) => row.recent)).toEqual([true, true, false, false]);
		expect(ranked.every((row) => row.ranges.length === 0)).toBe(true);
	});

	it('ignores recents once something is typed', () => {
		const ranked = rankItems(items, 'sel', ['d']);
		expect(ranked.map((row) => row.item.id)).toEqual(['a']);
	});
});

describe('segments', () => {
	it('splits a label into matched and plain runs', () => {
		expect(
			segments('Reset layout', [
				{ start: 0, end: 1 },
				{ start: 6, end: 7 },
			]),
		).toEqual([
			{ text: 'R', hit: true },
			{ text: 'eset ', hit: false },
			{ text: 'l', hit: true },
			{ text: 'ayout', hit: false },
		]);
		expect(segments('Save', [])).toEqual([{ text: 'Save', hit: false }]);
	});
});

describe('recent commands', () => {
	it('puts the latest first, once, and forgets the oldest past the limit', () => {
		const recents = createRecentCommands(3);
		for (const id of ['a', 'b', 'c', 'a', 'd']) recents.note(id);
		expect(recents.ids()).toEqual(['d', 'a', 'c']);
	});

	it('starts empty', () => {
		expect(createRecentCommands().ids()).toEqual([]);
	});
});
