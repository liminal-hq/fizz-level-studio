// Tests for where the script editor draws its popups: in the page, not inside the clipped panel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView, showTooltip } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { POPUP_LAYER_ID, popupLayer, scriptExtensions } from './scriptExtensions';

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
			// The popups sit in the page's one popup layer, which is a direct child of `body`.
			expect(tooltip!.parentElement?.parentElement).toBe(document.getElementById(POPUP_LAYER_ID));
			expect(document.getElementById(POPUP_LAYER_ID)?.parentElement).toBe(document.body);
			expect(tooltip!.style.position).toBe('fixed');
			// The editor's theme classes follow the popup into the body, so its theme still applies.
			const themeClasses = view!.dom.className.split(' ').filter((c) => c.startsWith('ͼ'));
			expect(themeClasses.length).toBeGreaterThan(0);
			for (const c of themeClasses)
				expect(tooltip!.parentElement!.classList.contains(c)).toBe(true);
		});
	}
});

describe('the popups’ layer', () => {
	it('takes no layout space, so it cannot make the page scroll', () => {
		const layer = popupLayer();
		expect(layer.parentElement).toBe(document.body);
		expect(layer.style.position).toBe('fixed');
		expect(layer.style.width).toBe('0px');
		expect(layer.style.height).toBe('0px');
		// It is a stacking context of its own, so it must carry the menu level to stay above the panels.
		expect(layer.style.zIndex).toBe('var(--fls-z-menu)');
	});

	it('is one element, shared by every editor, and made again if the body was cleared', () => {
		const first = popupLayer();
		expect(popupLayer()).toBe(first);
		document.body.replaceChildren();
		const second = popupLayer();
		expect(second).not.toBe(first);
		expect(second.isConnected).toBe(true);
		expect(document.querySelectorAll(`#${POPUP_LAYER_ID}`)).toHaveLength(1);
	});

	it('holds the popups’ theme wrapper, so no wrapper is left in the body to take space', () => {
		openPopup(true);
		openPopup(false);
		const wrappers = [...document.body.children].filter((el) => el.querySelector('.cm-tooltip'));
		expect(wrappers.map((el) => el.id)).toEqual([POPUP_LAYER_ID]);
		expect(document.querySelectorAll(`#${POPUP_LAYER_ID}`)).toHaveLength(1);
	});
});
