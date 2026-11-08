// Tests for the text field helpers: which boxes have the menu, what they allow, and what each choice does to them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTextFieldAction, textFieldOf, textFieldState, textFieldTarget } from './textField';

let exec: ReturnType<typeof vi.fn>;
beforeEach(() => {
	exec = vi.fn(() => true);
	Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
});
afterEach(() => {
	document.body.innerHTML = '';
});

function mount(html: string): HTMLElement {
	document.body.innerHTML = html;
	return document.body.firstElementChild as HTMLElement;
}

describe('textFieldOf', () => {
	it.each([
		['<input />', true],
		['<input type="text" />', true],
		['<input type="number" />', true],
		['<input type="search" />', true],
		['<input type="password" />', true],
		['<textarea></textarea>', true],
		['<div contenteditable="true"><span>x</span></div>', true],
		['<input type="checkbox" />', false],
		['<input type="range" />', false],
		['<input type="color" />', false],
		['<button>go</button>', false],
		['<div contenteditable="false"></div>', false],
		['<div class="cm-editor"><div contenteditable="true" class="cm-content"></div></div>', false],
		['<p>text</p>', false],
	])('%s -> %s', (html, expected) => {
		const root = mount(html);
		const hit = root.querySelector('span, .cm-content') ?? root;
		expect(textFieldOf(hit) !== null).toBe(expected);
	});

	it('is null for no target', () => {
		expect(textFieldOf(null)).toBeNull();
	});
});

describe('textFieldState', () => {
	it('reads the selection, the text and read-only from an input', () => {
		const input = mount('<input value="hello" />') as HTMLInputElement;
		input.setSelectionRange(1, 3);
		expect(textFieldState(input)).toEqual({ hasSelection: true, hasText: true, readOnly: false });
		input.setSelectionRange(2, 2);
		expect(textFieldState(input).hasSelection).toBe(false);
		input.readOnly = true;
		expect(textFieldState(input).readOnly).toBe(true);
	});

	it('reads a disabled input as read-only and an empty one as having no text', () => {
		const input = mount('<input disabled />') as HTMLInputElement;
		expect(textFieldState(input)).toMatchObject({ readOnly: true, hasText: false });
	});

	it('never has a selection to cut or copy in a password box', () => {
		const input = mount('<input type="password" value="secret" />') as HTMLInputElement;
		input.select();
		expect(textFieldState(input).hasSelection).toBe(false);
	});

	it('keeps Cut and Copy on offer in a number box, which cannot report a selection', () => {
		const input = mount('<input type="number" value="4" />') as HTMLInputElement;
		expect(textFieldState(input).hasSelection).toBe(true);
	});

	it('reads a content-editable', () => {
		const box = mount('<div contenteditable="true">words</div>');
		expect(textFieldTarget(box).field).toMatchObject({ hasText: true, hasSelection: false });
	});
});

describe('runTextFieldAction', () => {
	const clipboard = (text: string | null) => ({ readText: vi.fn(async () => text) });

	it.each(['undo', 'redo', 'cut', 'copy'] as const)(
		'runs %s through the webview',
		async (action) => {
			const input = mount('<input value="x" />') as HTMLInputElement;
			await runTextFieldAction(input, action, clipboard(null));
			expect(exec).toHaveBeenCalledWith(action);
			expect(document.activeElement).toBe(input);
		},
	);

	it('selects all the text of an input', async () => {
		const input = mount('<input value="hello" />') as HTMLInputElement;
		await runTextFieldAction(input, 'selectAll', clipboard(null));
		expect(input.selectionStart).toBe(0);
		expect(input.selectionEnd).toBe(5);
	});

	it('selects all of a content-editable through the webview', async () => {
		const box = mount('<div contenteditable="true">words</div>');
		await runTextFieldAction(box, 'selectAll', clipboard(null));
		expect(exec).toHaveBeenCalledWith('selectAll');
	});

	it('pastes the clipboard text with insertText, which keeps the undo history', async () => {
		const input = mount('<input />') as HTMLInputElement;
		const source = clipboard('pasted');
		await runTextFieldAction(input, 'paste', source);
		expect(source.readText).toHaveBeenCalledOnce();
		expect(exec).toHaveBeenCalledWith('insertText', false, 'pasted');
	});

	it('writes the text itself, and says the value changed, when the webview refuses insertText', async () => {
		exec.mockReturnValue(false);
		const input = mount('<input value="ab" />') as HTMLInputElement;
		input.setSelectionRange(1, 1);
		const onInput = vi.fn();
		input.addEventListener('input', onInput);
		await runTextFieldAction(input, 'paste', clipboard('XY'));
		expect(input.value).toBe('aXYb');
		expect(onInput).toHaveBeenCalledOnce();
	});

	it('pastes nothing when the clipboard has no text', async () => {
		const input = mount('<input />') as HTMLInputElement;
		await runTextFieldAction(input, 'paste', clipboard(null));
		expect(exec).not.toHaveBeenCalledWith('insertText', false, expect.anything());
	});

	it('does nothing to a field that has left the page', async () => {
		const input = mount('<input />') as HTMLInputElement;
		input.remove();
		await runTextFieldAction(input, 'copy', clipboard(null));
		expect(exec).not.toHaveBeenCalled();
	});
});
