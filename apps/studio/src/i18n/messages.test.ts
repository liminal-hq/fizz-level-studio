// Tests the message lookup: fallback to English, `{name}` interpolation and plural forms
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { resetActiveLocale, setActiveLocale } from './active';
import { enMessages, t, tn, type PluralId } from './messages';

afterEach(() => {
	resetActiveLocale();
});

describe('t', () => {
	it('reads the English message by default', () => {
		expect(t('app.name')).toBe('Fizz Level Studio');
	});

	it('reads the active catalogue first and falls back to English for a missing key', () => {
		setActiveLocale('en-XA', { 'chrome.close': 'Shut' });
		expect(t('chrome.close')).toBe('Shut');
		expect(t('chrome.restore')).toBe('Restore');
	});

	it('replaces {name} tokens and leaves unknown ones in place', () => {
		const messages = enMessages as Record<string, string>;
		messages['test.greeting'] = 'Hello, {name}! {missing}';
		try {
			expect(t('test.greeting' as never, { name: 'Fizz' })).toBe('Hello, Fizz! {missing}');
			expect(t('test.greeting' as never, { name: 3 })).toBe('Hello, 3! {missing}');
		} finally {
			delete messages['test.greeting'];
		}
	});
});

describe('tn', () => {
	const messages = enMessages as Record<string, string>;
	beforeAll(() => {
		messages['test.items.one'] = '{count} item';
		messages['test.items.other'] = '{count} items';
	});
	afterAll(() => {
		delete messages['test.items.one'];
		delete messages['test.items.other'];
	});
	const id = 'test.items' as PluralId;

	it('picks the one and other forms and formats the count', () => {
		expect(tn(id, 1)).toBe('1 item');
		expect(tn(id, 0)).toBe('0 items');
		expect(tn(id, 1234)).toBe('1,234 items');
	});

	it('uses the active catalogue form when it has one', () => {
		setActiveLocale('en-XA', { ['test.items.other' as never]: '{count} things' });
		expect(tn(id, 5)).toBe('5 things');
		expect(tn(id, 1)).toBe('1 item');
	});

	it('falls back to .other for a category nobody spells out', () => {
		expect(tn(id, 2, 'ar')).toMatch(/ items$/);
	});
});
