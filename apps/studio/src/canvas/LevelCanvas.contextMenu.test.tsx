// Tests for the canvas's right-click and Menu key: what it asks its caller to open, and what it never does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { LevelCanvas, type LevelCanvasProps } from './LevelCanvas';

const view = levelView(12, 8);

function setup(overrides: Partial<LevelCanvasProps> = {}) {
	const props: LevelCanvasProps = {
		view,
		cursor: { x: 5, y: 4 },
		onCursorChange: vi.fn(),
		onToolEvent: vi.fn(),
		onContextCell: vi.fn(),
		...overrides,
	};
	render(<LevelCanvas {...props} />);
	return { props, canvas: screen.getByRole('application') };
}

// At 4x the 12 by 8 level is 192 by 128 pixels, centred in the 640 by 384 window.
const at = (x: number, y: number) => ({
	clientX: (640 - 192) / 2 + x * 16 + 1,
	clientY: (384 - 128) / 2 + (7 - y) * 16 + 1,
});

/** Fires a `contextmenu` and says whether something prevented it. */
function rightClick(canvas: HTMLElement, init: { clientX: number; clientY: number }): boolean {
	const event = createEvent.contextMenu(canvas, { button: 2, ...init });
	fireEvent(canvas, event);
	return event.defaultPrevented;
}

describe('LevelCanvas context menu', () => {
	it('asks for the menu of the cell under the pointer and prevents the browser’s own', () => {
		const { props, canvas } = setup();
		const where = at(3, 2);
		expect(rightClick(canvas, where)).toBe(true);
		expect(props.onContextCell).toHaveBeenCalledTimes(1);
		expect(props.onContextCell).toHaveBeenCalledWith({
			cell: { x: 3, y: 2 },
			at: { x: where.clientX, y: where.clientY },
			keyboard: false,
			focus: canvas,
		});
	});

	it('never paints on a right press', () => {
		const { props, canvas } = setup();
		fireEvent.pointerDown(canvas, { button: 2, ...at(3, 2) });
		fireEvent.pointerUp(canvas, { button: 2, ...at(3, 2) });
		rightClick(canvas, at(3, 2));
		expect(props.onToolEvent).not.toHaveBeenCalled();
		expect(props.onCursorChange).not.toHaveBeenCalled();
	});

	it('has no menu on the margin round the level, and leaves the event to the host', () => {
		const { props, canvas } = setup();
		expect(rightClick(canvas, { clientX: 5, clientY: 5 })).toBe(false);
		expect(props.onContextCell).not.toHaveBeenCalled();
	});

	it('opens nothing under a stroke in progress, or a middle-button pan, and says so on the canvas', () => {
		const { props, canvas } = setup();
		fireEvent.pointerDown(canvas, { button: 0, ...at(1, 1) });
		expect(canvas).toHaveAttribute('data-context-busy');
		expect(rightClick(canvas, at(3, 2))).toBe(true);
		fireEvent.pointerUp(canvas, { button: 0, ...at(1, 1) });
		expect(canvas).not.toHaveAttribute('data-context-busy');
		fireEvent.pointerDown(canvas, { button: 1, buttons: 4, ...at(1, 1) });
		expect(canvas).toHaveAttribute('data-context-busy');
		expect(rightClick(canvas, at(3, 2))).toBe(true);
		fireEvent.pointerUp(canvas, { button: 1, ...at(1, 1) });
		expect(canvas).not.toHaveAttribute('data-context-busy');
		expect(props.onContextCell).not.toHaveBeenCalled();
	});

	it('opens the cursor cell’s menu on the Menu key and on Shift+F10, with the keyboard flag', () => {
		const { props, canvas } = setup();
		canvas.focus();
		fireEvent.keyDown(canvas, { key: 'ContextMenu' });
		fireEvent.keyDown(canvas, { key: 'F10', shiftKey: true });
		expect(props.onContextCell).toHaveBeenCalledTimes(2);
		expect(props.onContextCell).toHaveBeenLastCalledWith(
			expect.objectContaining({ cell: { x: 5, y: 4 }, keyboard: true, focus: canvas }),
		);
	});

	it('keeps the key from reaching the app’s own key handler', () => {
		const { canvas } = setup();
		const seen = vi.fn();
		document.addEventListener('keydown', seen);
		fireEvent.keyDown(canvas, { key: 'F10', shiftKey: true });
		document.removeEventListener('keydown', seen);
		expect(seen).not.toHaveBeenCalled();
	});

	it('only prevents the contextmenu event the browser fires after the key', () => {
		const { props, canvas } = setup();
		fireEvent.keyDown(canvas, { key: 'ContextMenu' });
		expect(rightClick(canvas, { clientX: 0, clientY: 0 })).toBe(true);
		expect(props.onContextCell).toHaveBeenCalledTimes(1);
	});

	it('has no menu without a caller to open it', () => {
		const { canvas } = setup({ onContextCell: undefined });
		expect(rightClick(canvas, at(3, 2))).toBe(false);
	});
});
