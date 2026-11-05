// Tests the locale root: nothing draws before the catalogue, and a change rebuilds the content
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetActiveLocale, setActiveLocale } from './active';
import { forgetCatalogues } from './loadCatalogue';
import { LocaleRoot } from './LocaleRoot';
import { t } from './messages';

afterEach(() => {
	forgetCatalogues();
	resetActiveLocale();
});

/** Records the text of every render, so a flash of English before the pseudo-locale would show. */
const renders: string[] = [];
function Probe() {
	renders.push(t('app.name'));
	return <p data-testid="probe">{t('app.name')}</p>;
}

describe('LocaleRoot', () => {
	it('draws nothing until the catalogue is in, then draws in the locale at once', async () => {
		renders.length = 0;
		render(
			<LocaleRoot locale="en-XA" developer>
				<Probe />
			</LocaleRoot>,
		);
		expect(screen.queryByTestId('probe')).toBeNull();
		expect(await screen.findByTestId('probe')).toHaveTextContent(/^\[Ƒîžž/);
		expect(renders.every((text) => text.startsWith('['))).toBe(true);
	});

	it('shows English when the pseudo-locale is asked for outside a developer build', async () => {
		render(
			<LocaleRoot locale="en-XA" developer={false}>
				<Probe />
			</LocaleRoot>,
		);
		expect(await screen.findByTestId('probe')).toHaveTextContent('Fizz Level Studio');
	});

	it('rebuilds the content when the locale in force changes', async () => {
		render(
			<LocaleRoot locale="en-CA" developer>
				<Probe />
			</LocaleRoot>,
		);
		expect(await screen.findByTestId('probe')).toHaveTextContent('Fizz Level Studio');
		act(() => setActiveLocale('en-XA', { 'app.name': 'Changed' }));
		expect(screen.getByTestId('probe')).toHaveTextContent('Changed');
	});
});
