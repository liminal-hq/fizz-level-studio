// Suggests script words as they are typed, each with its documentation beside it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The words and their notes come from the backend. What this decides is only where on a line a kind
// of word belongs: statements and headings at a line's start, names after its first word.

import {
	autocompletion,
	type Completion,
	type CompletionContext,
	type CompletionResult,
	type CompletionSource,
} from '@codemirror/autocomplete';
import type { Extension, Text } from '@codemirror/state';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { docElement, kindLabel } from './scriptDocs';

const TYPES: Readonly<Record<string, string>> = {
	statement: 'keyword',
	section: 'namespace',
	segment: 'function',
	tile: 'constant',
	item: 'variable',
	enemy: 'class',
	field: 'property',
};

function indentOf(text: string): number {
	return text.length - text.trimStart().length;
}

/**
 * The heading word of the section a line sits in: the first word of the nearest unindented line
 * above it. `null` before any heading.
 */
export function sectionOf(doc: Text, lineNumber: number): string | null {
	for (let n = lineNumber - 1; n >= 1; n--) {
		const text = doc.line(n).text;
		if (text.trim() === '' || text.trimStart().startsWith('//')) continue;
		if (indentOf(text) === 0) return text.trim().split(/\s+/)[0] ?? null;
	}
	return null;
}

function option(entry: WordDoc): Completion {
	return {
		label: entry.word,
		type: TYPES[entry.kind] ?? 'text',
		detail: kindLabel(entry.kind),
		info: () => docElement(entry),
	};
}

/** True when `column` of `text` is inside a comment or an open string. */
function inCommentOrString(text: string, column: number): boolean {
	const before = text.slice(0, column);
	if (before.includes('//')) return true;
	return (before.match(/"/g)?.length ?? 0) % 2 === 1;
}

/**
 * The words that fit where the caret is. As the first word of a line: statements and section
 * headings, headings only when the line is unindented. After the first word: the names of tiles,
 * items and enemies (and terrain segments under `terrain`). After an `=`: nothing, since a value is
 * a number.
 */
export function completionOptions(
	words: readonly WordDoc[],
	doc: Text,
	from: number,
): Completion[] {
	const line = doc.lineAt(from);
	const column = from - line.from;
	if (inCommentOrString(line.text, column)) return [];
	const before = line.text.slice(0, column);
	if (before.endsWith('=')) return [];

	if (before.trim() === '') {
		const unindented = indentOf(line.text) === 0;
		return words
			.filter((entry) => entry.kind === 'statement' || (unindented && entry.kind === 'section'))
			.map((entry) => option(entry));
	}

	const section = sectionOf(doc, line.number);
	return words
		.filter(
			(entry) =>
				['tile', 'item', 'enemy'].includes(entry.kind) ||
				(entry.kind === 'segment' && section === 'terrain'),
		)
		.map((entry) => option(entry));
}

/** The completion source over the backend's words. */
export function scriptCompletionSource(words: readonly WordDoc[]): CompletionSource {
	return (context: CompletionContext): CompletionResult | null => {
		const typed = context.matchBefore(/[A-Za-z][\w-]*/);
		if (!typed && !context.explicit) return null;
		const from = typed ? typed.from : context.pos;
		const options = completionOptions(words, context.state.doc, from);
		if (options.length === 0) return null;
		return { from, options, validFor: /^[\w-]*$/ };
	};
}

/** Autocompletion with the script's words: Ctrl+Space opens it, and it opens as a word is typed. */
export function scriptCompletion(words: readonly WordDoc[]): Extension {
	return autocompletion({
		override: [scriptCompletionSource(words)],
		icons: false,
		maxRenderedOptions: 60,
	});
}
