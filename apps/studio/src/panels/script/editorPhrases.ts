// The editor library's own words, taken from the message catalogue
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EditorState } from '@codemirror/state';
import { t, type MessageId } from '../../i18n/messages';

/** Each phrase the editor library shows, with the message that says it. */
export const PHRASE_MESSAGES: Readonly<Record<string, MessageId>> = {
	'Fold line': 'script.cm.foldLine',
	'Unfold line': 'script.cm.unfoldLine',
	'Folded lines': 'script.cm.foldedLines',
	'Unfolded lines': 'script.cm.unfoldedLines',
	'folded code': 'script.cm.foldedCode',
	unfold: 'script.cm.unfold',
	to: 'script.cm.to',
	'Go to line': 'script.cm.gotoLine',
	go: 'script.cm.go',
	Find: 'script.cm.find',
	Replace: 'script.cm.replaceLabel',
	next: 'script.cm.next',
	previous: 'script.cm.previous',
	all: 'script.cm.all',
	'match case': 'script.cm.matchCase',
	regexp: 'script.cm.regexp',
	'by word': 'script.cm.byWord',
	replace: 'script.cm.replace',
	'replace all': 'script.cm.replaceAll',
	close: 'script.cm.close',
	'current match': 'script.cm.currentMatch',
	'on line': 'script.cm.onLine',
	'replaced match on line $': 'script.cm.replacedMatchOnLine',
	'replaced $ matches': 'script.cm.replacedMatches',
	Diagnostics: 'script.cm.diagnostics',
	'No diagnostics': 'script.cm.noDiagnostics',
	Completions: 'script.cm.completions',
	'Selection deleted': 'script.cm.selectionDeleted',
	'Control character': 'script.cm.controlCharacter',
};

/** The phrase table for the active language. */
export function editorPhrases(): Record<string, string> {
	return Object.fromEntries(Object.entries(PHRASE_MESSAGES).map(([phrase, id]) => [phrase, t(id)]));
}

/** The state facet that gives the editor library its words. */
export function phraseExtension() {
	return EditorState.phrases.of(editorPhrases());
}
