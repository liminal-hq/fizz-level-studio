// Tests for the script editor's pure parts: word lookup, completion, problem marks, folding, phrases
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EditorState, Text } from '@codemirror/state';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { describe, expect, it } from 'vitest';
import { enMessages } from '../../i18n/messages';
import { PHRASE_MESSAGES, editorPhrases } from './editorPhrases';
import { foldSection } from './fizzLanguage';
import { completionOptions, scriptCompletionSource, sectionOf } from './scriptCompletion';
import { lintDiagnostics } from './scriptDiagnostics';
import { atLineStart, docElement, pickDoc, wordAt } from './scriptDocs';
import { docTooltip } from './scriptHover';

function word(name: string, kind: string): WordDoc {
	return {
		word: name,
		kind,
		syntax: `${name} SYNTAX`,
		example: `${name} EXAMPLE`,
		note: `${name} does a thing.`,
	};
}

const WORDS: WordDoc[] = [
	word('level', 'statement'),
	word('terrain', 'section'),
	word('blocks', 'section'),
	word('plat', 'statement'),
	word('flat', 'segment'),
	word('grass', 'tile'),
	word('cheezie', 'item'),
];

const SCRIPT = 'level "T" 10x6 ground=2\nterrain\n  flat 4\nblocks\n  plat x=1..2 y=3\n';

function doc(text: string): Text {
	return EditorState.create({ doc: text }).doc;
}

describe('wordAt', () => {
	const d = doc('  plat grass x=3..5 red-door');
	it('finds the word the position is in or at the end of', () => {
		expect(wordAt(d, 3)).toEqual({ word: 'plat', from: 2, to: 6 });
		expect(wordAt(d, 6)).toEqual({ word: 'plat', from: 2, to: 6 });
		expect(wordAt(d, 27)?.word).toBe('red-door');
	});
	it('finds nothing between words or on a number', () => {
		expect(wordAt(d, 0)).toBeNull();
		expect(wordAt(d, 14)?.word).toBe('x');
		expect(wordAt(d, 15)).toBeNull();
	});
});

describe('pickDoc', () => {
	const both = [word('start', 'tile'), word('start', 'statement')];
	it('prefers a statement as the first word and anything else after it', () => {
		expect(pickDoc(both, 'start', true)?.kind).toBe('statement');
		expect(pickDoc(both, 'start', false)?.kind).toBe('tile');
		expect(pickDoc(both, 'nothing', true)).toBeNull();
	});
	it('falls back to the only entry', () => {
		expect(pickDoc([word('grass', 'tile')], 'grass', true)?.kind).toBe('tile');
	});
	it('knows whether a word starts its line', () => {
		const d = doc('  plat grass');
		expect(atLineStart(d, 2)).toBe(true);
		expect(atLineStart(d, 7)).toBe(false);
	});
});

describe('the documentation popup', () => {
	it('draws the word, its kind, its note, its syntax and its example', () => {
		const dom = docElement(word('plat', 'statement'));
		expect(dom.textContent).toContain('plat');
		expect(dom.textContent).toContain('statement');
		expect(dom.textContent).toContain('plat does a thing.');
		expect(dom.textContent).toContain('Syntax');
		expect(dom.textContent).toContain('plat EXAMPLE');
	});

	it('is offered for a documented word and for nothing else', () => {
		const state = EditorState.create({ doc: SCRIPT });
		const at = SCRIPT.indexOf('plat') + 1;
		const tip = docTooltip(state, WORDS, at);
		expect(tip?.pos).toBe(SCRIPT.indexOf('plat'));
		expect(tip?.end).toBe(SCRIPT.indexOf('plat') + 4);
		const made = tip?.create({} as never);
		expect(made?.dom.getAttribute('role')).toBe('tooltip');
		expect(docTooltip(state, WORDS, SCRIPT.indexOf('10x6') + 1)).toBeNull();
		expect(docTooltip(state, [], at)).toBeNull();
	});
});

describe('completion', () => {
	const labels = (text: string, caret = text.length) =>
		completionOptions(WORDS, doc(text), caret).map((o) => o.label);

	it('offers statements and headings at the start of an unindented line', () => {
		expect(labels('')).toEqual(['level', 'terrain', 'blocks', 'plat']);
	});

	it('offers statements but not headings on an indented line', () => {
		expect(labels('blocks\n  ')).toEqual(['level', 'plat']);
	});

	it('offers names after the first word, and segments only under terrain', () => {
		expect(labels('blocks\n  plat ')).toEqual(['grass', 'cheezie']);
		expect(labels('terrain\n  flat ')).toContain('flat');
		expect(labels('blocks\n  plat ')).not.toContain('flat');
	});

	it('offers nothing after an equals sign, in a comment or in a string', () => {
		expect(labels('blocks\n  plat x=')).toEqual([]);
		expect(labels('blocks\n  plat // ')).toEqual([]);
		expect(labels('level "ab ')).toEqual([]);
	});

	it('shows each option with its kind and its documentation', () => {
		const [first] = completionOptions(WORDS, doc(''), 0);
		expect(first?.detail).toBe('statement');
		const info = first?.info;
		const shown = typeof info === 'function' ? info(first!) : null;
		expect((shown as HTMLElement).textContent).toContain('level does a thing.');
	});

	it('finds the section by the nearest unindented line above', () => {
		const d = doc(SCRIPT);
		expect(sectionOf(d, 5)).toBe('blocks');
		expect(sectionOf(d, 3)).toBe('terrain');
		expect(sectionOf(d, 1)).toBeNull();
	});

	it('is a source that answers while a word is typed and not otherwise', () => {
		const source = scriptCompletionSource(WORDS);
		const state = EditorState.create({ doc: 'blocks\n  pl' });
		const context = (explicit: boolean, pos = state.doc.length) =>
			({
				state,
				pos,
				explicit,
				matchBefore: (re: RegExp) => {
					const line = state.doc.lineAt(pos);
					const match = new RegExp(`(?:${re.source})$`).exec(line.text.slice(0, pos - line.from));
					return match ? { from: pos - match[0].length, to: pos, text: match[0] } : null;
				},
			}) as never;
		const result = source(context(false)) as { from: number; options: { label: string }[] };
		expect(result.from).toBe(state.doc.length - 2);
		expect(result.options.map((o) => o.label)).toContain('plat');
		expect(source(context(false, 7))).toBeNull();
	});
});

describe('problem marks', () => {
	const d = doc('level "T"\n  paint grss\n\n');
	it('marks the text of the line from its first character', () => {
		const [mark] = lintDiagnostics(d, [{ line: 2, code: 'E004', message: 'unknown tile' }]);
		expect(mark).toMatchObject({ from: 12, to: 22, severity: 'error', source: 'E004' });
		expect(mark?.message).toBe('E004 unknown tile');
	});
	it('marks the whole of an empty line, and the last line for one past the end', () => {
		const [empty, past] = lintDiagnostics(d, [
			{ line: 3, code: 'E001', message: 'a' },
			{ line: 99, code: 'E002', message: 'b' },
		]);
		expect(empty).toMatchObject({ from: 23, to: 23 });
		expect(past).toMatchObject({ from: d.length, to: d.length });
	});
});

describe('folding sections', () => {
	const lines = SCRIPT.split('\n');
	it('folds the indented lines under a heading', () => {
		expect(foldSection(lines, 1)).toEqual({ from: 1, to: 2 });
		expect(foldSection(lines, 3)).toEqual({ from: 3, to: 4 });
	});
	it('does not fold an indented line, a header with nothing under it or a comment', () => {
		expect(foldSection(lines, 2)).toBeNull();
		expect(foldSection(lines, 0)).toBeNull();
		expect(foldSection(['// note', '  x'], 0)).toBeNull();
	});
	it('skips blank lines inside a section but not the ones after it', () => {
		expect(foldSection(['a', '  b', '', '  c', '', 'd'], 0)).toEqual({ from: 0, to: 3 });
	});
});

describe('the editor library phrases', () => {
	it('are all messages in the catalogue, in English', () => {
		for (const id of Object.values(PHRASE_MESSAGES)) expect(id in enMessages).toBe(true);
		const phrases = editorPhrases();
		expect(phrases['Go to line']).toBe('Go to line');
		expect(Object.keys(phrases)).toHaveLength(Object.keys(PHRASE_MESSAGES).length);
	});
});
