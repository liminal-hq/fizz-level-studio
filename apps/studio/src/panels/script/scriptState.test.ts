// Tests for the editor's state: following the backend's text, revealing lines, read-only, features
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { redo, undo } from '@codemirror/commands';
import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { fizzLanguage } from './fizzLanguage';
import { scriptExtensions, vsCodeKeys } from './scriptExtensions';
import {
	clampLine,
	revealedLines,
	revealTransaction,
	syncTransaction,
	textChange,
} from './scriptSync';
import { diagnosticsTransaction } from './scriptDiagnostics';

function state(text: string, editable = false) {
	return EditorState.create({
		doc: text,
		extensions: scriptExtensions({ editable, words: [], label: 'Script text' }),
	});
}

describe('textChange', () => {
	it('is the smallest change between two texts', () => {
		expect(textChange('abc', 'abc')).toBeNull();
		expect(textChange('hello world', 'hello brave world')).toEqual({
			from: 6,
			to: 6,
			insert: 'brave ',
		});
		expect(textChange('a\nb\nc\n', 'a\nc\n')).toEqual({ from: 2, to: 4, insert: '' });
		expect(textChange('', 'new')).toEqual({ from: 0, to: 0, insert: 'new' });
		expect(textChange('aaa', 'aa')).toEqual({ from: 2, to: 3, insert: '' });
	});
});

describe('following the backend', () => {
	it('applies an outside change and keeps the caret and the selections where they were', () => {
		const first = state('one\ntwo\nthree\n');
		const caret = first.update({
			selection: EditorSelection.create([EditorSelection.cursor(9), EditorSelection.cursor(1)]),
		}).state;
		const spec = syncTransaction(caret, 'zero\none\ntwo\nthree\n');
		const next = caret.update(spec!).state;
		expect(next.doc.toString()).toBe('zero\none\ntwo\nthree\n');
		expect(next.selection.ranges.map((r) => r.head)).toEqual([6, 14]);
		expect(syncTransaction(next, next.doc.toString())).toBeNull();
	});

	it('refuses a change the backend did not make while read-only', () => {
		const first = state('abc');
		const typed = first.update({ changes: { from: 0, insert: 'x' } });
		expect(typed.state.doc.toString()).toBe('abc');
		expect(first.update(syncTransaction(first, 'abcd')!).state.doc.toString()).toBe('abcd');
		expect(first.readOnly).toBe(true);
	});

	it('keeps selections, several at once, while read-only', () => {
		const next = state('abc def abc').update({
			selection: EditorSelection.create([
				EditorSelection.range(0, 3),
				EditorSelection.range(8, 11),
			]),
		}).state;
		expect(next.selection.ranges).toHaveLength(2);
	});

	it('does not take history or typing aids until a change can be sent', () => {
		const read = state('abc');
		expect(undo({ state: read, dispatch: () => {} })).toBe(false);
		const edit = state('abc', true);
		expect(edit.readOnly).toBe(false);
		expect(redo({ state: edit, dispatch: () => {} })).toBe(false);
	});
});

describe('revealing a line', () => {
	it('selects its start and marks it, and the mark goes when the person selects elsewhere', () => {
		const first = state('a\nb\nc\n');
		const shown = first.update(revealTransaction(first, 2)).state;
		expect(shown.selection.main.head).toBe(2);
		expect(revealedLines(shown)).toEqual([2]);
		const moved = shown.update({ selection: { anchor: 4 }, userEvent: 'select.pointer' }).state;
		expect(revealedLines(moved)).toEqual([]);
	});

	it('keeps the mark on its line when text is added above it', () => {
		const shown = state('a\nb\n').update(revealTransaction(state('a\nb\n'), 2)).state;
		const grown = shown.update(syncTransaction(shown, 'z\na\nb\n')!).state;
		expect(revealedLines(grown)).toEqual([3]);
	});

	it('takes a line past either end to the nearest line', () => {
		const first = state('a\nb');
		expect(clampLine(first, 99)).toBe(2);
		expect(clampLine(first, 0)).toBe(1);
		expect(revealedLines(first.update(revealTransaction(first, 99)).state)).toEqual([2]);
	});
});

describe('problems', () => {
	it('can be set on a state without a view', () => {
		const first = state('level\n  bad\n');
		const next = first.update(
			diagnosticsTransaction(first, [{ line: 2, code: 'E1', message: 'm' }]),
		);
		expect(next.state.doc.toString()).toBe('level\n  bad\n');
	});
});

describe('the script language', () => {
	it('comments with a double slash', () => {
		const comment = state('x').languageDataAt<{ line: string }>('commentTokens', 0);
		expect(comment[0]?.line).toBe('//');
		expect(fizzLanguage.name).toBe('fizz');
	});
});

describe('the keys', () => {
	it('carry the editor commands a person used in VS Code', () => {
		const keys = vsCodeKeys.map((k) => k.key);
		expect(keys).toEqual(expect.arrayContaining(['Mod-g', 'Mod-h', 'Mod-d', 'Mod-/']));
	});
});
