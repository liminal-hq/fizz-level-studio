// The text-field menu's own actions: what a field can do now, and doing it to the field the menu was opened on
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// These are field actions, not registry commands (D74): they act on whichever box has the focus,
// so they have no palette row, no key of their own and no place in the application menu. The
// webview's own `execCommand` runs them, which keeps the box's undo history and fires `input`.

import type { TextFieldContextTarget, TextFieldState } from '../commands/contextTargets';
import type { TextFieldAction } from '../commands/textFieldMenu';
import type { ClipboardClient } from '../services/clipboardClient';

/** The input types a person types text into; the others (check boxes, sliders, colours) have no text menu. */
const TEXT_INPUT_TYPES = new Set([
	'',
	'text',
	'search',
	'number',
	'email',
	'url',
	'tel',
	'password',
]);

export type TextFieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
/**
 * The text box the event landed in, or null when it is not one: an `input` of a text type, a
 * `textarea`, or an element that is `contenteditable`. The script editor is CodeMirror, which is a
 * `contenteditable` of its own and has its own menu, so it is left out.
 */
export function textFieldOf(target: EventTarget | null): TextFieldElement | null {
	if (!(target instanceof Element)) return null;
	if (target.closest('.cm-editor')) return null;
	const input = target.closest('input');
	if (input) return TEXT_INPUT_TYPES.has(input.type) ? input : null;
	const area = target.closest('textarea');
	if (area) return area;
	const editable = target.closest<HTMLElement>('[contenteditable]');
	if (editable && editable.getAttribute('contenteditable') !== 'false') return editable;
	return null;
}

function isFormField(element: TextFieldElement): element is HTMLInputElement | HTMLTextAreaElement {
	return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

/**
 * What the field can do now. A number box has no selection range to read, so Cut and Copy stay
 * on offer there; a password is never cut or copied, so it reads as having nothing selected.
 */
export function textFieldState(element: TextFieldElement): TextFieldState {
	if (isFormField(element)) {
		const start = element.selectionStart;
		const end = element.selectionEnd;
		const secret = element instanceof HTMLInputElement && element.type === 'password';
		return {
			readOnly: element.readOnly || element.disabled,
			hasSelection: !secret && (start === null || end === null ? true : start !== end),
			hasText: element.value.length > 0,
		};
	}
	const selection = element.ownerDocument.defaultView?.getSelection();
	return {
		readOnly: !element.isContentEditable,
		hasSelection: !!selection && !selection.isCollapsed && element.contains(selection.anchorNode),
		hasText: (element.textContent ?? '').length > 0,
	};
}

/** The menu's target for a field, read as the menu opens. */
export function textFieldTarget(element: TextFieldElement): TextFieldContextTarget {
	return { kind: 'textField', field: textFieldState(element) };
}

/** Puts `text` where the selection is, with the field's undo history and an `input` event. */
function insertText(element: TextFieldElement, text: string): void {
	const document = element.ownerDocument;
	if (document.execCommand('insertText', false, text)) return;
	// A webview that refuses the command: write it ourselves and say the value changed.
	if (isFormField(element)) {
		try {
			element.setRangeText(
				text,
				element.selectionStart ?? element.value.length,
				element.selectionEnd ?? element.value.length,
				'end',
			);
			element.dispatchEvent(new Event('input', { bubbles: true }));
		} catch {
			// A box with no selection range (a number box) is left as it was.
		}
	}
}

/**
 * Runs one menu choice on the field. The menu had the focus, so the field is given it back first
 * (its selection is kept while it is not focused). Paste reads the clipboard through `clipboard`:
 * a webview refuses a script's own `paste`, so the text is read and inserted here instead.
 */
export async function runTextFieldAction(
	element: TextFieldElement,
	action: TextFieldAction,
	clipboard: ClipboardClient,
): Promise<void> {
	if (!element.isConnected) return;
	element.focus({ preventScroll: true });
	const document = element.ownerDocument;
	switch (action) {
		case 'undo':
		case 'redo':
		case 'cut':
		case 'copy':
			document.execCommand(action);
			return;
		case 'selectAll':
			if (isFormField(element)) {
				try {
					element.select();
				} catch {
					document.execCommand('selectAll');
				}
			} else {
				document.execCommand('selectAll');
			}
			return;
		case 'paste': {
			const text = await clipboard.readText();
			if (text === null || !element.isConnected) return;
			// Reading took a moment; the focus may have gone to the menu or elsewhere.
			element.focus({ preventScroll: true });
			insertText(element, text);
			return;
		}
	}
}
