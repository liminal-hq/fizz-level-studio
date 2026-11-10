// Tests for a panel drag keeping the webview's own selection and drag and drop out of it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDockDrag } from './useDockDrag';

function Probe() {
	const drag = useDockDrag({ locate: () => null, onDrop: () => {} });
	return <button onPointerDown={(e) => drag.begin(e, 'palette', 'tab')}>grab</button>;
}

const cancelled = (type: string) => {
	const event = new Event(type, { bubbles: true, cancelable: true });
	document.body.dispatchEvent(event);
	return event.defaultPrevented;
};

describe('a panel drag', () => {
	it('refuses the page’s text selection and native drag while it runs, and only then', () => {
		render(<Probe />);
		expect(cancelled('selectstart')).toBe(false);
		expect(cancelled('dragstart')).toBe(false);
		fireEvent.pointerDown(screen.getByText('grab'), {
			pointerId: 1,
			button: 0,
			clientX: 10,
			clientY: 10,
		});
		act(() => {
			fireEvent.pointerMove(document, { pointerId: 1, clientX: 60, clientY: 80 });
		});
		expect(cancelled('selectstart')).toBe(true);
		expect(cancelled('dragstart')).toBe(true);
		act(() => {
			fireEvent.pointerUp(document, { pointerId: 1, clientX: 60, clientY: 80 });
		});
		expect(cancelled('selectstart')).toBe(false);
		expect(cancelled('dragstart')).toBe(false);
	});

	it('clears a selection already made when the press starts', () => {
		render(
			<>
				<p id="text">some selected text</p>
				<Probe />
			</>,
		);
		const range = document.createRange();
		range.selectNodeContents(document.getElementById('text')!);
		window.getSelection()!.addRange(range);
		expect(window.getSelection()!.rangeCount).toBe(1);
		fireEvent.pointerDown(screen.getByText('grab'), {
			pointerId: 1,
			button: 0,
			clientX: 10,
			clientY: 10,
		});
		expect(window.getSelection()!.rangeCount).toBe(0);
		fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 10 });
	});
});
