// Tests for the level-first key
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, describe, expect, it } from 'vitest';
import { isLevelFirstKey } from './dockKeys';

function press(target: Element | Window, init: KeyboardEventInit = {}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		key: 'Tab',
		bubbles: true,
		cancelable: true,
		...init,
	});
	// The event's target is whatever it is dispatched on; dispatch it so the browser sets it.
	target.dispatchEvent(event);
	return event;
}

function seen(target: Element, init?: KeyboardEventInit): boolean {
	let result = false;
	const listen = (event: Event) => {
		result = isLevelFirstKey(event as KeyboardEvent);
	};
	document.addEventListener('keydown', listen);
	press(target, init);
	document.removeEventListener('keydown', listen);
	return result;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('isLevelFirstKey', () => {
	it('answers Tab on the level and on the page itself', () => {
		document.body.innerHTML =
			'<div data-level><canvas id="c" tabindex="0"></canvas></div><input id="i">';
		expect(seen(document.getElementById('c')!)).toBe(true);
		expect(seen(document.body)).toBe(true);
	});

	it('leaves Tab alone in a field, a panel or the script editor', () => {
		document.body.innerHTML =
			'<div data-level></div><input id="i"><div id="p"><div class="cm-content" contenteditable id="s"></div></div>';
		expect(seen(document.getElementById('i')!)).toBe(false);
		expect(seen(document.getElementById('p')!)).toBe(false);
		expect(seen(document.getElementById('s')!)).toBe(false);
	});

	it('ignores other keys and Tab with a modifier', () => {
		document.body.innerHTML = '<div data-level id="l"></div>';
		const level = document.getElementById('l')!;
		expect(seen(level, { key: 'a' })).toBe(false);
		expect(seen(level, { shiftKey: true })).toBe(false);
		expect(seen(level, { ctrlKey: true })).toBe(false);
	});
});
