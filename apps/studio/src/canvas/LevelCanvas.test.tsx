// Tests for the level canvas and its objects list: roles, keyboard, pointer and zoom
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { levelView } from '../test/levelFixtures';
import { LevelCanvas, type LevelCanvasProps } from './LevelCanvas';

afterEach(() => {
	vi.restoreAllMocks();
});

const view = levelView(12, 8, {
	items: [{ kind: 'cheezie', x: 4, y: 3 }],
	spawns: [
		{ kind: 'gloop', x: 6, y: 1, dir: null, ride: false },
		{ kind: 'bat', x: 9, y: null, dir: null, ride: false },
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
		expect(screen.getByRole('status')).toHaveTextContent('Cell 5, 4: empty');
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

	it('zooms with the mouse wheel', () => {
		const { canvas } = setup();
		fireEvent.wheel(canvas, { deltaY: -100, clientX: 300, clientY: 200 });
		expect(screen.getByText('Zoom 5×')).toBeInTheDocument();
		fireEvent.wheel(canvas, { deltaY: 100, clientX: 300, clientY: 200 });
		fireEvent.wheel(canvas, { deltaY: 100, clientX: 300, clientY: 200 });
		expect(screen.getByText('Zoom 3×')).toBeInTheDocument();
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

describe('the objects list', () => {
	it('lists items, spawns, the start and problems in a named list', () => {
		setup();
		const list = screen.getByRole('list', { name: 'Objects' });
		const entries = within(list).getAllByRole('listitem');
		expect(entries.map((entry) => entry.textContent)).toEqual([
			'Ben’s start at 1, 1',
			'Item cheezie at 4, 3',
			'Spawn gloop at 6, 1',
			'Spawn bat at column 9',
			'Line 3, E004: unknown tile',
		]);
	});

	it('moves the cursor to an entry when it is chosen from the keyboard', async () => {
		const user = userEvent.setup();
		const { props } = setup();
		await user.click(screen.getByRole('button', { name: 'Item cheezie at 4, 3' }));
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 4, y: 3 });
		const spawn = screen.getByRole('button', { name: 'Spawn gloop at 6, 1' });
		spawn.focus();
		await user.keyboard('{Enter}');
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 6, y: 1 });
		// A spawn with no row rests on the ground in its column (the floor is row 0).
		await user.click(screen.getByRole('button', { name: 'Spawn bat at column 9' }));
		expect(props.onCursorChange).toHaveBeenLastCalledWith({ x: 9, y: 1 });
	});

	it('hands a chosen problem to the caller as its line', async () => {
		const user = userEvent.setup();
		const onSelectLine = vi.fn();
		setup({ onSelectLine });
		await user.click(screen.getByRole('button', { name: /E004/ }));
		expect(onSelectLine).toHaveBeenCalledWith(3);
	});

	it('says so when the level has nothing in it', () => {
		setup({ view: levelView(4, 4, { start: null }) });
		expect(screen.getByText('Nothing placed yet')).toBeInTheDocument();
	});
});
