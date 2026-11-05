// Puts the editor together: the features, their keys (VS Code's where the library has them) and theme
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
	selectLine,
	toggleComment,
} from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import {
	gotoLine,
	highlightSelectionMatches,
	openSearchPanel,
	search,
	searchKeymap,
	selectNextOccurrence,
} from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
	crosshairCursor,
	drawSelection,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	rectangularSelection,
	type KeyBinding,
} from '@codemirror/view';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { phraseExtension } from './editorPhrases';
import { fizzLanguageSupport } from './fizzLanguage';
import { diagnosticsGutter } from './scriptDiagnostics';
import { scriptCompletion } from './scriptCompletion';
import { scriptDocs } from './scriptHover';
import { keepToBackend, revealExtension } from './scriptSync';
import { scriptTheme } from './scriptTheme';

/**
 * The keys that differ from the library's, so they behave as in VS Code: Ctrl+G goes to a line,
 * Ctrl+H opens find and replace, Ctrl+L selects the line, Ctrl+D selects the next match (which the
 * search keymap also gives), Ctrl+/ toggles a `//` comment. Mod is Ctrl, or Cmd on a Mac.
 */
export const vsCodeKeys: readonly KeyBinding[] = [
	{ key: 'Mod-g', run: gotoLine, preventDefault: true },
	{ key: 'Mod-h', run: openSearchPanel, preventDefault: true },
	{ key: 'Mod-l', run: selectLine, preventDefault: true },
	{ key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
	{ key: 'Mod-/', run: toggleComment, preventDefault: true },
];

export interface ScriptEditorOptions {
	/** False keeps the text read-only: the caret, selections, find and folding still work. */
	editable: boolean;
	/** The documented words, for hover text and (when editable) completion. */
	words: readonly WordDoc[];
	/** The name screen readers give the editor. */
	label: string;
}

/**
 * Every extension the script editor uses. Editing features (history, completion, closing
 * brackets) are added only when `editable`; a read-only editor refuses every change that did not
 * come from the backend.
 */
export function scriptExtensions({ editable, words, label }: ScriptEditorOptions): Extension[] {
	const common: Extension[] = [
		phraseExtension(),
		lineNumbers(),
		highlightActiveLineGutter(),
		foldGutter(),
		diagnosticsGutter,
		drawSelection(),
		EditorState.allowMultipleSelections.of(true),
		// Alt+click adds a caret; Alt+Shift+drag selects a column, as VS Code does.
		EditorView.clickAddsSelectionRange.of((event) => event.altKey && !event.shiftKey),
		rectangularSelection({ eventFilter: (event) => event.altKey && event.shiftKey }),
		crosshairCursor({ key: 'Alt' }),
		bracketMatching(),
		highlightActiveLine(),
		highlightSelectionMatches(),
		search({ top: true }),
		fizzLanguageSupport,
		scriptDocs(words),
		revealExtension,
		scriptTheme,
		EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'true' }),
		EditorState.readOnly.of(!editable),
		keymap.of([...vsCodeKeys]),
		keymap.of([
			...(editable ? [...closeBracketsKeymap, ...historyKeymap, ...completionKeymap] : []),
			...foldKeymap,
			...searchKeymap,
			...lintKeymap,
			...defaultKeymap,
		]),
	];
	if (!editable) return [...common, keepToBackend];
	return [...common, history(), closeBrackets(), indentOnInput(), scriptCompletion(words)];
}
