// Tests which locales exist, and that pseudo-locales are developer-only
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	intlTagFor,
	isAvailableLocale,
	isRightToLeftLocale,
	pluralTagFor,
	resolveLocale,
} from './locales';

describe('locales', () => {
	it('offers the pseudo-locales only in a developer build', () => {
		expect(isAvailableLocale('en-XA', true)).toBe(true);
		expect(isAvailableLocale('ar-XB', true)).toBe(true);
		expect(isAvailableLocale('en-XA', false)).toBe(false);
		expect(isAvailableLocale('ar-XB', false)).toBe(false);
		expect(isAvailableLocale('en-CA', false)).toBe(true);
		expect(isAvailableLocale('fr-CA', true)).toBe(false);
	});

	it('settles on English for anything unavailable', () => {
		expect(resolveLocale(undefined, true)).toBe('en-CA');
		expect(resolveLocale('en-XA', false)).toBe('en-CA');
		expect(resolveLocale('de-DE', true)).toBe('en-CA');
		expect(resolveLocale('en-XA', true)).toBe('en-XA');
	});

	it('borrows real tags for Intl', () => {
		expect(intlTagFor('en-XA')).toBe('en-CA');
		expect(intlTagFor('ar-XB')).toBe('ar');
		expect(pluralTagFor('ar-XB')).toBe('en');
		expect(isRightToLeftLocale('ar-XB')).toBe(true);
		expect(isRightToLeftLocale('en-XA')).toBe(false);
	});
});
