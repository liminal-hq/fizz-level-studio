// Tests for turning the saved accent choice and glass setting into what is drawn
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { PRESET_ACCENTS } from './accent';
import { resolveAccentHex, resolveGlass } from './accentChoice';

describe('resolveAccentHex', () => {
	it('uses the system accent for system, and the studio cyan (null) when there is none', () => {
		expect(resolveAccentHex({ kind: 'system' }, '#3584e4')).toBe('#3584e4');
		expect(resolveAccentHex({ kind: 'system' }, null)).toBeNull();
	});

	it('ignores the system accent for every other choice', () => {
		expect(resolveAccentHex({ kind: 'studio' }, '#3584e4')).toBeNull();
		expect(resolveAccentHex({ kind: 'afterglow-orange' }, '#3584e4')).toBe(
			PRESET_ACCENTS.afterglowOrange,
		);
		expect(resolveAccentHex({ kind: 'afterglow-purple' }, null)).toBe(
			PRESET_ACCENTS.afterglowPurple,
		);
	});

	it('uses a valid custom hex and falls back to the cyan for a bad one', () => {
		expect(resolveAccentHex({ kind: 'custom', hex: '#123abc' }, null)).toBe('#123abc');
		expect(resolveAccentHex({ kind: 'custom', hex: 'nope' }, '#3584e4')).toBeNull();
	});
});

describe('resolveGlass', () => {
	it('follows the system for system, and the person for on and off', () => {
		expect(resolveGlass('system', false)).toBe('glass');
		expect(resolveGlass('system', true)).toBe('solid');
		expect(resolveGlass('on', true)).toBe('glass');
		expect(resolveGlass('off', false)).toBe('solid');
	});
});
