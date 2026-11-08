// Tests for where the script editor draws its popups: in the page, not inside the clipped panel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView, showTooltip } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { scriptExtensions } from './scriptExtensions';

let view: EditorView | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
	view?.destroy();
	host?.remove();
	view = host = null;
	document.body.replaceChildren();
});

/** An editor inside an `overflow: hidden` box, as in a panel, with a popup open on its first word. */
function openPopup(editable: boolean): HTMLElement {
	host = document.createElement('div');
	host.style.overflow = 'hidden';
	document.body.append(host);
	view = new EditorView({
		parent: host,
		state: EditorState.create({
			doc: 'crystal x=10',
			extensions: scriptExtensions({ editable, words: [], label: 'Script' }),
		}),
	});
	const dom = document.createElement('div');
	dom.className = 'fls-doc';
	view.dispatch({
		effects: StateEffect.appendConfig.of(showTooltip.of({ pos: 0, create: () => ({ dom }) })),
	});
	return dom;
}

describe('the script editor’s popups', () => {
	for (const editable of [true, false]) {
		it(`are drawn fixed in the page's body, outside the clipping panel (${editable ? 'editable' : 'read-only'})`, () => {
			const dom = openPopup(editable);
			const tooltip = dom.closest('.cm-tooltip') as HTMLElement | null;
			expect(tooltip).not.toBeNull();
			expect(host!.contains(tooltip)).toBe(false);
			expect(tooltip!.parentElement?.parentElement).toBe(document.body);
			expect(tooltip!.style.position).toBe('fixed');
			// The editor's theme classes follow the popup into the body, so its theme still applies.
			const themeClasses = view!.dom.className.split(' ').filter((c) => c.startsWith('ͼ'));
			expect(themeClasses.length).toBeGreaterThan(0);
			for (const c of themeClasses)
				expect(tooltip!.parentElement!.classList.contains(c)).toBe(true);
		});
	}
});
