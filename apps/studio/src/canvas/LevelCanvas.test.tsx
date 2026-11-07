// Tests for the level canvas: roles, keyboard, pointer and zoom
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { LevelCanvas, type LevelCanvasProps } from './LevelCanvas';

afterEach(() => {
	vi.restoreAllMocks();
});

const view = levelView(12, 8, {
	items: [{ kind: 'cheezie', x: 4, y: 3, line: 9 }],
	spawns: [
		{ kind: 'gloop', x: 6, y: 1, dir: null, ride: false, line: 12 },
		{ kind: 'bat', x: 9, y: null, dir: null, ride: false, line: 13 },
	],
	diagnostics: [{ line: 3, code: 'E004', message: 'unknown tile' }],
});

function setup(overrides: Partial<LevelCanvasProps> = {}) {
	const props: LevelCanvasProps = {
		view,
		cursor: { x: 5, y: 4 },
		onCursorChange: vi.fn(),
		onToolEvent: vi.fn(),
		...overrides,
	};
	render(<LevelCanvas {...props} />);
	return { props, canvas: screen.getByRole('application') };
}

describe('LevelCanvas', () => {
	it('is a named, focusable application region and reports the cursor cell', () => {
		const { canvas } = setup();
		expect(canvas).toHaveAccessibleName('Level canvas, Test Level, 12 by 8 cells');
		expect(canvas).toHaveAttribute('tabindex', '0');
		expect(screen.getByText(/^Cell 5, 4/)).toHaveTextContent('Cell 5, 4: empty');
	});

	it('moves the cursor with the arrow keys, Home and End', async () => {
		const user = userEvent.setup();
		const { props, canvas } = setup();
		canvas.focus();
		await user.keyboard('{ArrowRight}');
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 6, y: 4 });
		await user.keyboard('{ArrowUp}');
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 5, y: 5 });
		await user.keyboard('{ArrowLeft}');
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 4, y: 4 });
		await user.keyboard('{ArrowDown}');
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 5, y: 3 });
		await user.keyboard('{Home}');
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 0, y: 4 });
		await user.keyboard('{End}');
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 11, y: 4 });
	});

	it('applies the tool at the cursor on Space and on Enter', async () => {
		const user = userEvent.setup();
		const { props, canvas } = setup();
		canvas.focus();
		await user.keyboard(' ');
		expect(props.onToolEvent).toHaveBeenNthCalledWith(1, 'down', { x: 5, y: 4 });
		expect(props.onToolEvent).toHaveBeenNthCalledWith(2, 'up', { x: 5, y: 4 });
		await user.keyboard('{Enter}');
		expect(props.onToolEvent).toHaveBeenCalledTimes(4);
	});

	it('zooms with the plus and minus keys and the buttons, from 1x to 16x', async () => {
		const user = userEvent.setup();
		const { canvas } = setup();
		canvas.focus();
		expect(screen.getByText('Zoom 4×')).toBeInTheDocument();
		await user.keyboard('+');
		expect(screen.getByText('Zoom 5×')).toBeInTheDocument();
		await user.keyboard('-');
		await user.keyboard('-');
		expect(screen.getByText('Zoom 3×')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Zoom in' }));
		expect(screen.getByText('Zoom 4×')).toBeInTheDocument();
		canvas.focus();
		for (let i = 0; i < 20; i++) await user.keyboard('-');
		expect(screen.getByText('Zoom 1×')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
		for (let i = 0; i < 20; i++) await user.keyboard('+');
		expect(screen.getByText('Zoom 16×')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
	});

	it('has no zoom buttons in the status line, only in the floating control', () => {
		setup();
		const bar = document.querySelector('[data-canvas-bar]')!;
		expect(bar.querySelector('button')).toBeNull();
		expect(bar).not.toHaveTextContent('Zoom');
		const pill = screen.getByRole('group', { name: 'Canvas zoom' });
		expect(pill.closest('[data-map]')).not.toBeNull();
		expect(pill).toHaveTextContent('4×');
		expect(screen.getByRole('button', { name: 'Fit level' })).toBeInTheDocument();
	});

	it('reports the zoom, and whether it can still change, as it changes', async () => {
		const user = userEvent.setup();
		const onZoomChange = vi.fn();
		const { canvas } = setup({ onZoomChange });
		expect(onZoomChange).toHaveBeenLastCalledWith({ level: 4, canIn: true, canOut: true });
		canvas.focus();
		for (let i = 0; i < 20; i++) await user.keyboard('+');
		expect(onZoomChange).toHaveBeenLastCalledWith({ level: 16, canIn: false, canOut: true });
		for (let i = 0; i < 20; i++) await user.keyboard('-');
		expect(onZoomChange).toHaveBeenLastCalledWith({ level: 1, canIn: true, canOut: false });
	});

	it('zooms and fits when asked with a request, once for each serial', () => {
		const props = { view, cursor: { x: 5, y: 4 }, onCursorChange: vi.fn(), onToolEvent: vi.fn() };
		const { rerender } = render(<LevelCanvas {...props} zoomRequest={null} />);
		rerender(<LevelCanvas {...props} zoomRequest={{ kind: 'in', serial: 1 }} />);
		expect(screen.getByText('Zoom 5×')).toBeInTheDocument();
		rerender(<LevelCanvas {...props} zoomRequest={{ kind: 'in', serial: 1 }} />);
		expect(screen.getByText('Zoom 5×')).toBeInTheDocument();
		rerender(<LevelCanvas {...props} zoomRequest={{ kind: 'out', serial: 2 }} />);
		expect(screen.getByText('Zoom 4×')).toBeInTheDocument();
		// Each zoom step is 48 by 32 px for the 12 by 8 level, so 384 px of height allows 12x.
		rerender(<LevelCanvas {...props} zoomRequest={{ kind: 'fit', serial: 3 }} />);
		expect(screen.getByText('Zoom 12×')).toBeInTheDocument();
	});

	it('asks its caller when its buttons are pressed, if the caller wants to run the commands', async () => {
		const user = userEvent.setup();
		const onZoomAction = vi.fn();
		setup({ onZoomAction });
		await user.click(screen.getByRole('button', { name: 'Zoom in' }));
		await user.click(screen.getByRole('button', { name: 'Fit level' }));
		expect(onZoomAction.mock.calls.map((call) => call[0])).toEqual(['in', 'fit']);
		// The caller zooms; the canvas has not moved by itself.
		expect(screen.getByText('Zoom 4×')).toBeInTheDocument();
	});

	it('fits the level with its own button when nothing else runs it', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole('button', { name: 'Fit level' }));
		expect(screen.getByText('Zoom 12×')).toBeInTheDocument();
	});

	it('zooms with the mouse wheel', () => {
		const { canvas } = setup();
		fireEvent.wheel(canvas, { deltaY: -100, clientX: 300, clientY: 200 });
		expect(screen.getByText('Zoom 5×')).toBeInTheDocument();
		fireEvent.wheel(canvas, { deltaY: 100, clientX: 300, clientY: 200 });
		fireEvent.wheel(canvas, { deltaY: 100, clientX: 300, clientY: 200 });
		expect(screen.getByText('Zoom 3×')).toBeInTheDocument();
	});

	it('does not zoom on a sideways wheel: it pans the map instead', () => {
		const { canvas } = setup();
		fireEvent.wheel(canvas, { deltaX: 120, clientX: 300, clientY: 200 });
		fireEvent.wheel(canvas, { deltaX: -120, clientX: 300, clientY: 200 });
		expect(screen.getByText('Zoom 4×')).toBeInTheDocument();
	});

	it('turns pointer events into tool events in cell coordinates, row 0 at the bottom', () => {
		const { props, canvas } = setup();
		// At 4x the 12 by 8 level is 192 by 128 pixels, centred in the 640 by 384 window.
		const at = (x: number, y: number) => ({
			clientX: (640 - 192) / 2 + x * 16 + 1,
			clientY: (384 - 128) / 2 + (7 - y) * 16 + 1,
		});
		fireEvent.pointerDown(canvas, { button: 0, ...at(2, 0) });
		fireEvent.pointerMove(canvas, at(3, 0));
		fireEvent.pointerUp(canvas, at(4, 0));
		expect(props.onToolEvent).toHaveBeenNthCalledWith(1, 'down', { x: 2, y: 0 });
		expect(props.onToolEvent).toHaveBeenNthCalledWith(2, 'move', { x: 3, y: 0 });
		expect(props.onToolEvent).toHaveBeenNthCalledWith(3, 'up', { x: 4, y: 0 });
		expect(props.onCursorChange).toHaveBeenCalledWith({ x: 2, y: 0 });
	});

	it('keeps the level in the part the docks leave and maps the pointer across the whole frame', () => {
		// A 100 px dock on the left and 84 px along the bottom leave 540 by 300 of the 640 by 384
		// frame; the 192 by 128 level is centred in that, not in the frame.
		const { props, canvas } = setup({ insets: { top: 0, right: 0, bottom: 84, left: 100 } });
		const at = (x: number, y: number) => ({
			clientX: 100 + (540 - 192) / 2 + x * 16 + 1,
			clientY: (300 - 128) / 2 + (7 - y) * 16 + 1,
		});
		fireEvent.pointerDown(canvas, { button: 0, ...at(0, 7) });
		fireEvent.pointerUp(canvas, at(11, 0));
		expect(props.onToolEvent).toHaveBeenNthCalledWith(1, 'down', { x: 0, y: 7 });
		expect(props.onToolEvent).toHaveBeenNthCalledWith(2, 'up', { x: 11, y: 0 });
	});

	it('gives the floating controls the uncovered part of the map, and the status line its edges', () => {
		const overlay = vi.fn(() => <span data-testid="floating" />);
		setup({ insets: { top: 0, right: 60, bottom: 84, left: 100 }, overlay });
		// The picker is told the map less the room the zoom control keeps at the bottom.
		expect(overlay).toHaveBeenLastCalledWith({ w: 480, h: 248 });
		const map = screen.getByTestId('floating').parentElement!;
		expect(map).toHaveAttribute('data-map');
		const root = map.closest<HTMLElement>('[style]')!;
		expect(root.style.getPropertyValue('--fls-map-x')).toBe('100px');
		expect(root.style.getPropertyValue('--fls-map-w')).toBe('480px');
		expect(root.style.getPropertyValue('--fls-cover-bottom')).toBe('84px');
		expect(root.style.getPropertyValue('--fls-cover-right')).toBe('60px');
		expect(map).not.toContainElement(screen.getByText(/^Cell /));
		// The zoom control is in the map, which is the part nothing covers.
		expect(map).toContainElement(screen.getByRole('group', { name: 'Canvas zoom' }));
	});

	it('sends no move events while the pointer is up', () => {
		const { props, canvas } = setup();
		fireEvent.pointerMove(canvas, { clientX: 300, clientY: 200 });
		expect(props.onToolEvent).not.toHaveBeenCalled();
	});

	it('draws onto its 2D context', () => {
		const calls: string[] = [];
		const ctx = new Proxy(
			{},
			{
				get: (_target, name) =>
					name === 'setTransform' ? () => {} : () => calls.push(String(name)),
				set: () => true,
			},
		);
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
			ctx as unknown as CanvasRenderingContext2D,
		);
		setup();
		expect(calls).toContain('fillRect');
	});
});
