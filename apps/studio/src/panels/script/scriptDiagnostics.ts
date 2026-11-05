// Shows the parser's problems as marks in the script: a squiggle on the line and a gutter marker
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The problems come from the backend with their codes and messages; this only finds where on the
// page each one goes.

import { setDiagnostics, lintGutter, type Diagnostic } from '@codemirror/lint';
import type { EditorState, Extension, Text, TransactionSpec } from '@codemirror/state';
import type { ViewDiagnostic } from '@liminal-hq/fizz-studio-protocol/generated/ViewDiagnostic';
import { t } from '../../i18n/messages';

/**
 * One mark per problem, over the text of the problem's line (from its first character that is not
 * a space), or over the whole of an empty line. A line past the end of the script marks the last
 * line, so a problem is never lost.
 */
export function lintDiagnostics(doc: Text, problems: readonly ViewDiagnostic[]): Diagnostic[] {
	return problems.map((problem) => {
		const number = Math.min(Math.max(Math.trunc(problem.line), 1), doc.lines);
		const line = doc.line(number);
		const indent = line.text.length - line.text.trimStart().length;
		const from = line.text.trim() === '' ? line.from : line.from + indent;
		return {
			from,
			to: line.to,
			severity: 'error' as const,
			source: problem.code,
			message: t('script.lint', { code: problem.code, message: problem.message }),
		};
	});
}

/** The transaction that replaces the editor's marks with those for `problems`. */
export function diagnosticsTransaction(
	state: EditorState,
	problems: readonly ViewDiagnostic[],
): TransactionSpec {
	return setDiagnostics(state, lintDiagnostics(state.doc, problems));
}

/** The gutter that carries a marker beside each problem line. */
export const diagnosticsGutter: Extension = lintGutter();
