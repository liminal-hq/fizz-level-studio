// Compares a catalogue's keys and tokens with English
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Catalogue } from './active';
import { enMessages } from './messages';

export interface Parity {
	/** Keys English has and the catalogue lacks. */
	missing: string[];
	/** Keys the catalogue has and English does not. */
	extra: string[];
	/** Keys whose `{name}` tokens differ from English's, a bug in a translation. */
	tokenMismatch: string[];
}

/** A message's `{name}` tokens, sorted and joined, to compare two messages. */
export function tokens(message: string): string {
	return [...message.matchAll(/\{(\w+)\}/g)]
		.map((match) => match[1])
		.sort()
		.join(',');
}

/** How `catalogue` differs from the English source. */
export function catalogueParity(catalogue: Catalogue): Parity {
	const english = enMessages as Record<string, string>;
	const own = catalogue as Record<string, string>;
	return {
		missing: Object.keys(english).filter((key) => !(key in own)),
		extra: Object.keys(own).filter((key) => !(key in english)),
		tokenMismatch: Object.keys(own).filter(
			(key) => key in english && tokens(own[key]!) !== tokens(english[key]!),
		),
	};
}

/** The problems that fail the parity test for `locale`: a gap, a stray key or a token mismatch. */
export function parityFailures(locale: string, catalogue: Catalogue): string[] {
	const parity = catalogueParity(catalogue);
	return [
		...parity.missing.map((key) => `${locale} lacks ${key}`),
		...parity.extra.map((key) => `${locale} has ${key}, which English does not`),
		...parity.tokenMismatch.map((key) => `${locale} ${key} has different {tokens} from English`),
	];
}
