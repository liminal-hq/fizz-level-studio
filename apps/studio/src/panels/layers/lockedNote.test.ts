// Tests for the note shown when a lock refuses a change
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { t } from '../../i18n/messages';
import { levelSections } from '../../test/levelFixtures';
import { layerList, lockedProblem } from './lockedNote';

describe('lockedProblem', () => {
	it('names one layer in the singular message', () => {
		const problem = lockedProblem(['treats'], levelSections());
		expect(t(problem.id, problem.values)).toBe(
			'Treats is locked. Unlock it in Layers to change it.',
		);
	});

	it('lists several layers in the plural message', () => {
		const problem = lockedProblem(['treats', 'edits'], levelSections());
		expect(t(problem.id, problem.values)).toBe(
			'Treats and Edits are locked. Unlock them in Layers to change them.',
		);
	});

	it('names a layer the level does not list from the catalogue', () => {
		expect(layerList(['walls'], [])).toBe('Walls');
	});
});
