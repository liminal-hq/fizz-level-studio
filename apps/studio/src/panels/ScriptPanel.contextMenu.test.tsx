// Tests for the script editor's right-click menu: its rows, the keys it shows, and what each does to the editor
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EditorView } from '@codemirror/view';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { ContextMenuHost } from '../app/ContextMenuHost';
import { createCommandBridge } from '../commands/commandBridge';
import { ScriptPanel } from './ScriptPanel';

const TEXT = 'script fizz1 0\nlevel test\n  paint grass\n  paint dirt\n';

function mount() {
	const bridge = createCommandBridge();
	bridge.setFacts({ editorOpen: true, hasLevel: true });
	const { container } = render(
		<ContextMenuHost bridge={bridge} nativeMenu={{ allowed: async () => false }}>
			<ScriptPanel text={TEXT} diagnostics={[]} />
		</ContextMenuHost>,
	);
	const editor = container.querySelector<HTMLElement>('.cm-editor')!;
	return { bridge, container, editor, view: EditorView.findFromDOM(editor)! };
}

const rows = () => [
	...screen.getByRole('menu').querySelectorAll<HTMLElement>('[role^="menuitem"]'),
];
const row = (name: RegExp) => rows().find((r) => name.test(r.textContent ?? ''))!;

beforeEach(() => {
	// A browser tells the page about a selection change a moment later; happy-dom does it inside the
	// call that moved the selection, which lands in the middle of the editor's own update.
	const dispatch = document.dispatchEvent.bind(document);
	let pending = false;
	vi.spyOn(document, 'dispatchEvent').mockImplementation((event) => {
		if (event.type !== 'selectionchange') return dispatch(event);
		// Coalesced, as a browser does: one event for a burst of changes.
		if (!pending) {
			pending = true;
			setTimeout(() => {
				pending = false;
				dispatch(event);
			}, 0);
		}
		return true;
	});
	Object.defineProperty(document, 'execCommand', { value: vi.fn(() => true), configurable: true });
});

afterEach(() => vi.restoreAllMocks());

describe('the script editor menu', () => {
	it('opens over the text with Copy, Select all, Find, Fold all and Unfold all', async () => {
		const { container } = mount();
		expect(fireEvent.contextMenu(container.querySelector('.cm-line')!)).toBe(false);
		await screen.findByRole('menu', { name: 'Script menu' });
		expect(rows().map((r) => r.querySelector('.label')?.textContent)).toEqual([
			'Copy',
			'Select all',
			'Find',
			'Fold all',
			'Unfold all',
		]);
		// No native title on the editor itself; the dimmed Copy says why through its row.
		expect(row(/^Copy/)).toHaveAttribute('aria-disabled', 'true');
		expect(row(/^Copy/)).toHaveAttribute('title', 'Select some of the script first.');
	});

	it('gives the line numbers the same menu', async () => {
		const { container } = mount();
		fireEvent.contextMenu(container.querySelector('.cm-lineNumbers .cm-gutterElement')!);
		await screen.findByRole('menu', { name: 'Script menu' });
		expect(rows()).toHaveLength(5);
	});

	it('selects all of the script, and puts the focus in the editor', async () => {
		const { container, view } = mount();
		fireEvent.contextMenu(container.querySelector('.cm-line')!);
		await screen.findByRole('menu');
		fireEvent.click(row(/^Select all/));
		await waitFor(() => expect(view.state.selection.main.to).toBe(TEXT.length));
		expect(view.state.selection.main.from).toBe(0);
		expect(view.hasFocus).toBe(true);
	});

	it('copies the selection through the browser, once something is selected', async () => {
		const { container, view } = mount();
		view.dispatch({ selection: { anchor: 0, head: 6 } });
		fireEvent.contextMenu(container.querySelector('.cm-line')!);
		await screen.findByRole('menu');
		expect(row(/^Copy/)).not.toHaveAttribute('aria-disabled', 'true');
		fireEvent.click(row(/^Copy/));
		expect(document.execCommand).toHaveBeenCalledWith('copy');
	});

	it('opens the search panel for Find', async () => {
		const { container } = mount();
		fireEvent.contextMenu(container.querySelector('.cm-line')!);
		await screen.findByRole('menu');
		fireEvent.click(row(/^Find/));
		await waitFor(() => expect(container.querySelector('.cm-search')).not.toBeNull());
	});

	it('folds and unfolds without error', async () => {
		const { container } = mount();
		for (const name of [/^Fold all/, /^Unfold all/]) {
			fireEvent.contextMenu(container.querySelector('.cm-line')!);
			await screen.findByRole('menu');
			fireEvent.click(row(name));
			await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
		}
	});

	it('gives a hover tooltip, which sits outside the panel, Copy alone', async () => {
		mount();
		const tip = document.createElement('div');
		tip.className = 'cm-tooltip';
		document.body.append(tip);
		fireEvent.contextMenu(tip);
		await screen.findByRole('menu', { name: 'Script menu' });
		expect(rows().map((r) => r.querySelector('.label')?.textContent)).toEqual(['Copy']);
		tip.remove();
	});

	it('opens from the keyboard at the caret and gives the focus back to the editor', async () => {
		const { view } = mount();
		view.focus();
		fireEvent.keyDown(view.contentDOM, { key: 'F10', shiftKey: true });
		await screen.findByRole('menu', { name: 'Script menu' });
		fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
		await act(async () => {});
		expect(view.hasFocus).toBe(true);
	});
});
