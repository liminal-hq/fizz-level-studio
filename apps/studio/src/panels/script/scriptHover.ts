// Documentation for the word under the pointer or the caret, as a popup that names itself
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { StateEffect, StateField, type Extension, type EditorState } from '@codemirror/state';
import { EditorView, hoverTooltip, keymap, showTooltip, type Tooltip } from '@codemirror/view';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { t } from '../../i18n/messages';
import { atLineStart, docElement, pickDoc, wordAt } from './scriptDocs';

/** The popup for the word at `pos`, or `null` when it has no documentation. */
export function docTooltip(
	state: EditorState,
	words: readonly WordDoc[],
	pos: number,
): Tooltip | null {
	const found = wordAt(state.doc, pos);
	if (!found) return null;
	const entry = pickDoc(words, found.word, atLineStart(state.doc, found.from));
	if (!entry) return null;
	return {
		pos: found.from,
		end: found.to,
		above: true,
		create() {
			const dom = docElement(entry);
			dom.setAttribute('role', 'tooltip');
			dom.setAttribute('aria-label', t('script.docPopup'));
			return { dom };
		},
	};
}

/** Hovering a word shows its documentation. */
export function hoverDocs(words: readonly WordDoc[]): Extension {
	return hoverTooltip((view, pos) => docTooltip(view.state, words, pos), { hoverTime: 350 });
}

const openDocs = StateEffect.define<boolean>();

/** The popup the keyboard opens at the caret; any move of the caret, an edit or Escape closes it. */
function keyboardDocs(words: readonly WordDoc[]): Extension {
	const field = StateField.define<Tooltip | null>({
		create: () => null,
		update(value, tr) {
			for (const effect of tr.effects) {
				if (effect.is(openDocs)) {
					return effect.value ? docTooltip(tr.state, words, tr.state.selection.main.head) : null;
				}
			}
			return tr.docChanged || tr.selection ? null : value;
		},
		provide: (f) => showTooltip.compute([f], (state) => state.field(f)),
	});
	const toggle = (view: EditorView) => {
		const open = view.state.field(field) !== null;
		view.dispatch({ effects: openDocs.of(!open) });
		return true;
	};
	return [
		field,
		keymap.of([
			{ key: 'Mod-k Mod-i', run: toggle },
			{
				key: 'Escape',
				run: (view) => {
					if (view.state.field(field) === null) return false;
					view.dispatch({ effects: openDocs.of(false) });
					return true;
				},
			},
		]),
	];
}

/** Both ways to the documentation: the pointer, and Ctrl+K Ctrl+I at the caret. */
export function scriptDocs(words: readonly WordDoc[]): Extension {
	return [hoverDocs(words), keyboardDocs(words)];
}
