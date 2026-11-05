// The script's look in the editor: cosmetic colouring, folding by indentation and `//` comments
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Nothing here decides what a script means. The parser in Rust owns that, and its problems arrive
// as diagnostics. The tokens only tell words, numbers, ranges, fields, strings and comments apart.

import {
	foldService,
	HighlightStyle,
	StreamLanguage,
	syntaxHighlighting,
} from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';

interface LineState {
	/** True until the first word of the line has been read. */
	first: boolean;
}

const NUMBER = /^-?\d+(?:\.\d+)?(?:\.\.-?\d+(?:\.\d+)?)?/;
const FIELD = /^[A-Za-z][\w-]*(?==)/;
const WORD = /^[A-Za-z][\w-]*/;

/** The colouring of a `.fizz` script, line by line. */
export const fizzLanguage = StreamLanguage.define<LineState>({
	name: 'fizz',
	startState: () => ({ first: true }),
	blankLine: (state) => {
		state.first = true;
	},
	token(stream, state) {
		if (stream.sol()) state.first = true;
		if (stream.eatSpace()) return null;
		if (stream.match('//')) {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.eat('"')) {
			while (!stream.eol()) {
				const next = stream.next();
				if (next === '\\') stream.next();
				else if (next === '"') break;
			}
			state.first = false;
			return 'string';
		}
		if (stream.match(NUMBER)) {
			state.first = false;
			return 'number';
		}
		if (stream.match(FIELD)) {
			state.first = false;
			return 'propertyName';
		}
		if (stream.match(WORD)) {
			const heading = state.first && stream.indentation() === 0;
			const statement = state.first;
			state.first = false;
			if (heading) return 'def';
			return statement ? 'keyword' : 'atom';
		}
		stream.next();
		state.first = false;
		return null;
	},
	languageData: { commentTokens: { line: '//' } },
});

/** The colours of those tokens, from the theme's `--fls-*` tokens. */
export const fizzHighlight = HighlightStyle.define([
	{ tag: tags.definition(tags.variableName), color: 'var(--fls-text-primary)', fontWeight: '700' },
	{ tag: tags.keyword, color: 'var(--fls-syntax-keyword)' },
	{ tag: tags.atom, color: 'var(--fls-text-secondary)' },
	{ tag: tags.number, color: 'var(--fls-syntax-number)' },
	{ tag: tags.string, color: 'var(--fls-syntax-string)' },
	{ tag: tags.propertyName, color: 'var(--fls-syntax-field)' },
	{ tag: tags.comment, color: 'var(--fls-syntax-comment)', fontStyle: 'italic' },
]);

function indentOf(text: string): number {
	return text.length - text.trimStart().length;
}

function isBlank(text: string): boolean {
	return text.trim() === '';
}

/**
 * The lines a section hides when folded: the indented lines under an unindented line, up to the
 * last indented one before the next unindented line. `null` when the line is not a heading or has
 * nothing under it.
 */
export function foldSection(
	lines: readonly string[],
	index: number,
): { from: number; to: number } | null {
	const heading = lines[index];
	if (heading === undefined || isBlank(heading) || indentOf(heading) > 0) return null;
	if (heading.trimStart().startsWith('//')) return null;
	let last = -1;
	for (let next = index + 1; next < lines.length; next++) {
		const text = lines[next]!;
		if (isBlank(text)) continue;
		if (indentOf(text) === 0) break;
		last = next;
	}
	return last < 0 ? null : { from: index, to: last };
}

/** Folds a heading line over the indented lines under it. */
export const fizzFolding: Extension = foldService.of(
	(state: EditorState, lineStart: number, lineEnd: number) => {
		const line = state.doc.lineAt(lineStart);
		if (line.from !== lineStart || line.to !== lineEnd) return null;
		const lines: string[] = [];
		const limit = state.doc.lines;
		for (let n = line.number; n <= limit; n++) {
			const text = state.doc.line(n).text;
			lines.push(text);
			if (n > line.number && !isBlank(text) && indentOf(text) === 0) break;
		}
		const range = foldSection(lines, 0);
		if (!range) return null;
		return { from: lineEnd, to: state.doc.line(line.number + range.to).to };
	},
);

/** The language, its colours and its folding, as one extension. */
export const fizzLanguageSupport: Extension = [
	fizzLanguage,
	syntaxHighlighting(fizzHighlight),
	fizzFolding,
];
