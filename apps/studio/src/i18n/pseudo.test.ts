// Tests the pseudo-locale transforms: tokens survive, text is accented and lengthened
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import enXA from './catalogues/en-XA';
import arXB from './catalogues/ar-XB';
import { enMessages } from './messages';
import { accentMessage, EXPANSION, pseudoCatalogue, rightToLeftMessage } from './pseudo';

describe('accentMessage', () => {
	it('accents letters, brackets the text and lengthens it', () => {
		const out = accentMessage('Save level');
		expect(out.startsWith('[')).toBe(true);
		expect(out.endsWith(']')).toBe(true);
		expect(out).toContain('Šàṽé ĺéṽéĺ');
		expect(out.length).toBeGreaterThanOrEqual('Save level'.length * (1 + EXPANSION));
	});

	it('leaves {name} tokens exactly as they are', () => {
		const out = accentMessage('Open {name} of {count}');
		expect(out).toContain('{name}');
		expect(out).toContain('{count}');
		expect(out).not.toMatch(/\{[^}]*[^\w}][^}]*\}/);
	});

	it('does not count tokens towards the padding', () => {
		expect(accentMessage('{name}')).toBe('[{name}]');
	});
});

describe('rightToLeftMessage', () => {
	it('wraps the text in a right-to-left embedding and marks tokens', () => {
		const out = rightToLeftMessage('Why, {name}?');
		expect(out.startsWith('‫')).toBe(true);
		expect(out.endsWith('‬')).toBe(true);
		expect(out).toContain('‏{name}‏');
		expect(out).toContain('؟');
		expect(out).toContain('،');
	});
});

describe('pseudoCatalogue', () => {
	it('transforms every English message and keeps every key', () => {
		expect(Object.keys(enXA)).toEqual(Object.keys(enMessages));
		expect(Object.keys(arXB)).toEqual(Object.keys(enMessages));
		for (const [id, message] of Object.entries(enXA)) {
			expect(message).toBe(accentMessage((enMessages as Record<string, string>)[id]!));
		}
	});

	it('applies the transform it is given', () => {
		expect(pseudoCatalogue({ 'app.name': 'x' }, (m) => m + m)).toEqual({ 'app.name': 'xx' });
	});
});
