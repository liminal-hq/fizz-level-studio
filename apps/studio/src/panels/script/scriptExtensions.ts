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
	tooltips,
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

/**
 * Where the editor's popups (the hover documentation, completion, problems) are drawn: fixed in the
 * page's `body`, so they sit above the docks, rails and floating panels and are never cut off by the
 * panel's `overflow` or by a glass `backdrop-filter`, which makes a containing block of its own. The
 * library moves the popup to stay on screen, and copies the editor's theme classes onto it there.
 */
export function popupPlacement(): Extension {
	return tooltips({ parent: popupLayer(), position: 'fixed' });
}

/** The id of the popups' layer, so tests and the live checks can find it. */
export const POPUP_LAYER_ID = 'fls-popup-layer';

/**
 * The one element in the page's `body` that holds the editor's popups. The library puts its popup
 * wrapper (a `position: relative` div as tall as the page) straight into the parent it is given, and
 * that wrapper took layout space in `body`, doubling the document's height, so revealing a line
 * scrolled the whole app shell. This layer is fixed and has no size, so it takes no space and nothing
 * in it can make the page scroll; the popups themselves are `position: fixed`, so they still place
 * against the viewport. It is made on first use, and again if the page's body was cleared.
 */
export function popupLayer(): HTMLElement {
	const existing = document.getElementById(POPUP_LAYER_ID);
	if (existing?.isConnected) return existing;
	const layer = document.createElement('div');
	layer.id = POPUP_LAYER_ID;
	Object.assign(layer.style, {
		position: 'fixed',
		inset: '0',
		width: '0',
		height: '0',
		overflow: 'visible',
		// A fixed box is a stacking context of its own, so the popups' own z-index only counts inside it:
		// the layer takes the menu level itself, to stay above the docks and floating panels.
		zIndex: 'var(--fls-z-menu)',
	});
	document.body.append(layer);
	return layer;
}

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
		popupPlacement(),
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
			// Ctrl+Shift+M maximises the panel, so the lint panel's own binding for it is left out.
			...lintKeymap.filter((binding) => binding.key !== 'Mod-Shift-m'),
			...defaultKeymap,
		]),
	];
	if (!editable) return [...common, keepToBackend];
	return [...common, history(), closeBrackets(), indentOnInput(), scriptCompletion(words)];
}
