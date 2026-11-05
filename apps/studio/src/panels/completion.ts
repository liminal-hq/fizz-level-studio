// Word completion for a line of script: which documented words continue what has been typed
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';

/** How many suggestions are offered at once. */
export const MAX_SUGGESTIONS = 8;

/** Statements first, then headings, then the words a statement takes. */
const KIND_ORDER = ['statement', 'section', 'segment', 'tile', 'item', 'enemy'];

const WORD_CHARACTER = /[A-Za-z0-9-]/;

export interface Completion {
	/** Where the word being typed starts and ends in the text. */
	start: number;
	end: number;
	items: WordDoc[];
}

function rank(kind: string): number {
	const at = KIND_ORDER.indexOf(kind);
	return at < 0 ? KIND_ORDER.length : at;
}

/** The run of word characters that ends at `caret`, which is the word being typed. */
export function wordBefore(text: string, caret: number): { start: number; prefix: string } {
	let start = caret;
	while (start > 0 && WORD_CHARACTER.test(text[start - 1] ?? '')) start--;
	return { start, prefix: text.slice(start, caret) };
}

/**
 * The documented words that begin with the word being typed at `caret`, most useful first. The
 * words come from the backend (the language in Rust); nothing here knows what a word means. A word
 * already typed in full, with nothing longer to offer, gives no suggestion.
 */
export function completionsFor(
	text: string,
	caret: number,
	words: readonly WordDoc[],
	limit: number = MAX_SUGGESTIONS,
): Completion {
	const { start, prefix } = wordBefore(text, caret);
	const none: Completion = { start, end: caret, items: [] };
	if (prefix === '') return none;
	const lower = prefix.toLowerCase();
	const seen = new Set<string>();
	// The sort is stable, so inside a kind the words keep the language's own order.
	const matches = words
		.filter((doc) => doc.word.startsWith(lower))
		.sort((a, b) => rank(a.kind) - rank(b.kind))
		.filter((doc) => {
			if (seen.has(doc.word)) return false;
			seen.add(doc.word);
			return true;
		});
	if (matches.length === 1 && matches[0]?.word === lower) return none;
	return { start, end: caret, items: matches.slice(0, limit) };
}

/** The text with the typed word replaced by `word`, and where the caret goes. */
export function acceptWord(
	text: string,
	completion: Completion,
	word: string,
): { text: string; caret: number } {
	return {
		text: text.slice(0, completion.start) + word + text.slice(completion.end),
		caret: completion.start + word.length,
	};
}
