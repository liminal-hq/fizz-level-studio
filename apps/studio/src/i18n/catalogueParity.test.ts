// Tests the parity check: every other catalogue has exactly English's keys and tokens
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import arXB from './catalogues/ar-XB';
import enXA from './catalogues/en-XA';
import { catalogueParity, parityFailures, tokens } from './catalogueParity';
import { enMessages } from './messages';

describe('catalogue parity', () => {
	it('holds the pseudo-locales to English', () => {
		expect(parityFailures('en-XA', enXA)).toEqual([]);
		expect(parityFailures('ar-XB', arXB)).toEqual([]);
	});

	it('reports a missing key, an extra key and a token mismatch', () => {
		const parity = catalogueParity({
			'chrome.close': 'Close {oops}',
			'not.a.key': 'x',
		} as never);
		expect(parity.missing).toContain('app.name');
		expect(parity.missing).not.toContain('chrome.close');
		expect(parity.extra).toEqual(['not.a.key']);
		expect(parity.tokenMismatch).toEqual(['chrome.close']);
	});

	it('names each problem in the failure list', () => {
		const failures = parityFailures('xx', { 'not.a.key': 'x' } as never);
		expect(failures).toContain('xx has not.a.key, which English does not');
		expect(failures).toContain('xx lacks app.name');
	});

	it('reads tokens regardless of order', () => {
		expect(tokens('{b} and {a}')).toBe('a,b');
	});

	it('finds no empty message in English', () => {
		for (const [id, message] of Object.entries(enMessages)) {
			expect(message, id).not.toBe('');
		}
	});
});
