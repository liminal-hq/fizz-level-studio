// Finds the documentation for a script word and draws it, for hover, completion and the keyboard
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The words and their notes come from the backend (`LevelClient.words()`); nothing here knows the
// language, only how to look a word up and show what the backend said.

import type { Text } from '@codemirror/state';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { t, type MessageId } from '../../i18n/messages';

/** The characters a script word is made of. */
const WORD_CHAR = /[A-Za-z0-9_-]/;

export interface WordAt {
	word: string;
	from: number;
	to: number;
}

/** The word at (or just before) `pos` on its line, or `null` between words. */
export function wordAt(doc: Text, pos: number): WordAt | null {
	const line = doc.lineAt(pos);
	let start = pos - line.from;
	let end = start;
	const text = line.text;
	while (start > 0 && WORD_CHAR.test(text[start - 1]!)) start--;
	while (end < text.length && WORD_CHAR.test(text[end]!)) end++;
	if (start === end) return null;
	const word = text.slice(start, end);
	// A number is not a word the language documents.
	if (/^\d/.test(word)) return null;
	return { word, from: line.from + start, to: line.from + end };
}

/** True when `pos` is in a line's first word, where a statement or a section heading goes. */
export function atLineStart(doc: Text, from: number): boolean {
	const line = doc.lineAt(from);
	return line.text.slice(0, from - line.from).trim() === '';
}

const STATEMENT_KINDS = new Set(['statement', 'section']);

/**
 * The entry for a word. Where a word has several (such as `level`, a statement and a tile name in
 * another script), the one that fits its place wins: a statement or section as the first word of a
 * line, anything else after it.
 */
export function pickDoc(
	words: readonly WordDoc[],
	word: string,
	firstOnLine: boolean,
): WordDoc | null {
	const matches = words.filter((entry) => entry.word === word);
	if (matches.length === 0) return null;
	const fits = matches.find((entry) => STATEMENT_KINDS.has(entry.kind) === firstOnLine);
	return fits ?? matches[0]!;
}

/** The label of a word's kind, such as `statement`, in the active language. */
export function kindLabel(kind: string): string {
	const id = `script.kind.${kind}` as MessageId;
	return t(id);
}

function append(parent: HTMLElement, tag: string, text: string, className?: string): HTMLElement {
	const element = parent.ownerDocument.createElement(tag);
	element.textContent = text;
	if (className) element.className = className;
	parent.appendChild(element);
	return element;
}

/** The documentation of one word as DOM: its name and kind, what it does, how to write it. */
export function docElement(entry: WordDoc, owner: Document = document): HTMLElement {
	const root = owner.createElement('div');
	root.className = 'fls-doc';
	const head = append(root, 'div', '');
	append(head, 'span', entry.word, 'fls-doc-word');
	append(head, 'span', kindLabel(entry.kind), 'fls-doc-kind');
	append(root, 'p', entry.note, 'fls-doc-note');
	if (entry.syntax) {
		append(root, 'span', t('script.docSyntax'), 'fls-doc-label');
		append(root, 'code', entry.syntax);
	}
	if (entry.example) {
		append(root, 'span', t('script.docExample'), 'fls-doc-label');
		append(root, 'code', entry.example);
	}
	return root;
}
