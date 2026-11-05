// Keeps the editor's text equal to the backend's, and brings a chosen line into view
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	Annotation,
	EditorState,
	StateEffect,
	StateField,
	type TransactionSpec,
} from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** Marks a change that came from the backend, the only kind a read-only editor accepts. */
export const fromBackend = Annotation.define<boolean>();

/**
 * The smallest single change that turns `before` into `after`: what lies between their common
 * start and common end. `null` when they are the same. Applying only this keeps the caret and the
 * selections where they are, whatever changed elsewhere.
 */
export function textChange(
	before: string,
	after: string,
): { from: number; to: number; insert: string } | null {
	if (before === after) return null;
	const shortest = Math.min(before.length, after.length);
	let start = 0;
	while (start < shortest && before.charCodeAt(start) === after.charCodeAt(start)) start++;
	let end = 0;
	while (
		end < shortest - start &&
		before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)
	) {
		end++;
	}
	return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}

/** The transaction that makes the editor's text `text`, or `null` when it already is. */
export function syncTransaction(state: EditorState, text: string): TransactionSpec | null {
	const change = textChange(state.doc.toString(), text);
	if (!change) return null;
	return { changes: change, annotations: fromBackend.of(true) };
}

/** Refuses any change that did not come from the backend. */
export const keepToBackend = EditorState.transactionFilter.of((tr) =>
	tr.docChanged && !tr.annotation(fromBackend) ? [] : tr,
);

const revealLine = StateEffect.define<number | null>();

const revealedLine = Decoration.line({ class: 'cm-revealedLine' });

/** The line the person chose elsewhere, marked until they choose a place in the script. */
const revealedField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(revealLine)) {
				if (effect.value === null) return Decoration.none;
				const line = tr.state.doc.line(effect.value);
				return Decoration.set([revealedLine.range(line.from)]);
			}
		}
		if (tr.selection && tr.isUserEvent('select')) return Decoration.none;
		return tr.docChanged ? value.map(tr.changes) : value;
	},
	provide: (field) => EditorView.decorations.from(field),
});

/** The field that draws the revealed line. */
export const revealExtension = revealedField;

/** The line number `line` clamped into the document's lines. */
export function clampLine(state: EditorState, line: number): number {
	return Math.min(Math.max(Math.trunc(line), 1), state.doc.lines);
}

/**
 * Selects the start of `line`, marks the line and scrolls it into view. A line past the end is
 * the last line.
 */
export function revealTransaction(state: EditorState, line: number): TransactionSpec {
	const number = clampLine(state, line);
	const at = state.doc.line(number).from;
	return {
		selection: { anchor: at },
		effects: [revealLine.of(number), EditorView.scrollIntoView(at, { y: 'center' })],
	};
}

/** The lines (counted from 1) the editor marks as revealed, for tests. */
export function revealedLines(state: EditorState): number[] {
	const lines: number[] = [];
	state.field(revealedField).between(0, state.doc.length, (from) => {
		lines.push(state.doc.lineAt(from).number);
	});
	return lines;
}
