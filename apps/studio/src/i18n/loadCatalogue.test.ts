// Tests on-demand catalogue loading and activation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, describe, expect, it } from 'vitest';
import { activeLocale, activeMessages, resetActiveLocale } from './active';
import { activateLocale, forgetCatalogues, loadCatalogue } from './loadCatalogue';
import { t } from './messages';

afterEach(() => {
	forgetCatalogues();
	resetActiveLocale();
});

describe('loadCatalogue', () => {
	it('loads a catalogue once and shares it', async () => {
		const first = loadCatalogue('en-XA');
		expect(loadCatalogue('en-XA')).toBe(first);
		expect((await first)['app.name']).toMatch(/^\[/);
	});

	it('has an empty English catalogue, since English is the source', async () => {
		expect(await loadCatalogue('en-CA')).toEqual({});
	});
});

describe('activateLocale', () => {
	it('makes the pseudo-locale the one in force in a developer build', async () => {
		expect(await activateLocale({ requested: 'en-XA', developer: true })).toBe('en-XA');
		expect(activeLocale()).toBe('en-XA');
		expect(t('app.name')).toMatch(/^\[.*\]$/);
	});

	it('stays in English for a pseudo-locale in a release build', async () => {
		expect(await activateLocale({ requested: 'en-XA', developer: false })).toBe('en-CA');
		expect(activeMessages()).toEqual({});
		expect(t('app.name')).toBe('Fizz Level Studio');
	});
});
