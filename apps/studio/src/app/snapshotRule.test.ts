// Tests for the snapshot revision rule and the main screen's name helpers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import { baseName, levelName } from './MainScreen';
import { newerSnapshot } from './snapshotRule';

describe('newerSnapshot', () => {
	const held = levelSnapshot({ revision: 5n, saved_revision: 2n });

	it('takes a higher revision and ignores a lower one', () => {
		const higher = levelSnapshot({ revision: 6n, saved_revision: 2n });
		expect(newerSnapshot(held, higher)).toBe(higher);
		expect(newerSnapshot(held, levelSnapshot({ revision: 4n }))).toBe(held);
	});

	it('takes a save, which keeps the revision and raises the saved one', () => {
		const saved = levelSnapshot({ revision: 5n, saved_revision: 5n });
		expect(newerSnapshot(held, saved)).toBe(saved);
		expect(newerSnapshot(saved, held)).toBe(saved);
	});

	it('takes a snapshot of another level', () => {
		const other = levelSnapshot({ id: 'other', revision: 1n });
		expect(newerSnapshot(held, other)).toBe(other);
	});
});

describe('names', () => {
	it('uses the last part of a path with either separator', () => {
		expect(baseName('/a/b/c.fizz')).toBe('c.fizz');
		expect(baseName('C:\\levels\\d.fizz')).toBe('d.fizz');
	});

	it('names a level by its own name, else its file', () => {
		expect(levelName(levelSnapshot({}, levelView(4, 4, { name: 'Crater' })))).toBe('Crater');
		expect(levelName(levelSnapshot({ path: '/x/y.fizz' }, levelView(4, 4, { name: ' ' })))).toBe(
			'y.fizz',
		);
	});
});
