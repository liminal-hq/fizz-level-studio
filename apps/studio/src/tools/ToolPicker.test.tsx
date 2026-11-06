// Tests for the floating tool picker: its keys, its place, and moving it inside the map
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ToolPickerPlacement } from '@liminal-hq/fizz-studio-protocol/generated/ToolPickerPlacement';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Size } from '../panels/float/panelGeometry';
import { DEFAULT_PICKER, PICKER_MARGIN, clampPicker } from './pickerPlace';
import { ToolPicker } from './ToolPicker';
import type { ToolId } from './tool';

const MAP: Size = { w: 640, h: 384 };

function renderPicker(
	options: { place?: ToolPickerPlacement | null; map?: Size; tool?: ToolId } = {},
) {
	const onTool = vi.fn();
	const onPlace = vi.fn();
	const props = {
		tool: options.tool ?? ('paint' as ToolId),
		onTool,
		map: options.map ?? MAP,
		place: options.place ?? null,
		onPlace,
	};
	const view = render(<ToolPicker {...props} />);
	// A test may draw two pickers, so each looks only inside its own.
	const picker = within(view.container).getByRole('group', { name: 'Tools' });
	const grip = within(picker).getByRole('button', { name: 'Move the tools' });
	const placeOf = () => ({
		x: picker.style.getPropertyValue('--fls-picker-x'),
		y: picker.style.getPropertyValue('--fls-picker-y'),
	});
	return { ...view, props, onTool, onPlace, picker, grip, placeOf };
}

function drag(grip: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
	fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: from.x, clientY: from.y });
	fireEvent.pointerMove(grip, { pointerId: 1, clientX: to.x, clientY: to.y });
	fireEvent.pointerUp(grip, { pointerId: 1, clientX: to.x, clientY: to.y });
}

describe('clampPicker', () => {
	it('keeps the picker one margin inside the map', () => {
		const pill = { w: 200, h: 48 };
		expect(clampPicker({ x: -50, y: -5 }, pill, MAP)).toEqual(DEFAULT_PICKER);
		expect(clampPicker({ x: 5000, y: 5000 }, pill, MAP)).toEqual({
			x: MAP.w - pill.w - PICKER_MARGIN,
			y: MAP.h - pill.h - PICKER_MARGIN,
		});
		expect(clampPicker({ x: 100.4, y: 60.6 }, pill, MAP)).toEqual({ x: 100, y: 61 });
	});

	it('puts the picker at the top-left margin of a map too small for it', () => {
		expect(clampPicker({ x: 90, y: 90 }, { w: 200, h: 48 }, { w: 120, h: 40 })).toEqual(
			DEFAULT_PICKER,
		);
	});

	it('leaves the place alone until the map has been measured', () => {
		expect(clampPicker({ x: 900, y: 700 }, { w: 0, h: 0 }, { w: 0, h: 0 })).toEqual({
			x: 900,
			y: 700,
		});
	});
});

describe('ToolPicker', () => {
	it('names every key by its tool, draws an icon and carries the shortcut in its tooltip', () => {
		const { picker } = renderPicker();
		const expected = [
			['Paint', 'B'],
			['Erase', 'E'],
			['Pick', 'I'],
			['Select', 'S'],
			['Stamp', 'T'],
			['Inspect', 'Q'],
		] as const;
		expect(picker.querySelectorAll('button[data-tool]')).toHaveLength(expected.length);
		for (const [name, key] of expected) {
			const button = screen.getByRole('button', { name });
			expect(picker).toContainElement(button);
			expect(button).toHaveAttribute('title', `${name} (${key})`);
			expect(button).toHaveAttribute('aria-keyshortcuts', key);
			expect(button.textContent).toBe('');
			const icon = button.querySelector('svg');
			expect(icon).not.toBeNull();
			expect(icon).toHaveAttribute('aria-hidden', 'true');
		}
	});

	it('lights the current tool and chooses another on a click', async () => {
		const user = userEvent.setup();
		const { onTool } = renderPicker({ tool: 'select' });
		expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'false');
		await user.click(screen.getByRole('button', { name: 'Stamp' }));
		expect(onTool).toHaveBeenCalledWith('stamp');
		await user.click(screen.getByRole('button', { name: 'Inspect' }));
		expect(onTool).toHaveBeenCalledWith('inspect');
	});

	it('sits at the top-left corner until it is moved, and where it was moved to after', () => {
		expect(renderPicker().placeOf()).toEqual({ x: '8px', y: '8px' });
		const { picker } = renderPicker({ place: { x: 120, y: 40 } });
		expect(picker.style.getPropertyValue('--fls-picker-x')).toBe('120px');
		expect(picker.style.getPropertyValue('--fls-picker-y')).toBe('40px');
	});

	it('follows a drag of its grip and reports where the drag ended', () => {
		const { grip, onPlace, placeOf } = renderPicker();
		fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
		fireEvent.pointerMove(grip, { pointerId: 1, clientX: 160, clientY: 140 });
		expect(placeOf()).toEqual({ x: '68px', y: '48px' });
		expect(onPlace).not.toHaveBeenCalled();
		fireEvent.pointerUp(grip, { pointerId: 1, clientX: 160, clientY: 140 });
		expect(onPlace).toHaveBeenCalledTimes(1);
		expect(onPlace).toHaveBeenCalledWith({ x: 68, y: 48 });
	});

	it('keeps a drag inside the map', () => {
		const { grip, onPlace } = renderPicker({ map: { w: 300, h: 200 } });
		drag(grip, { x: 10, y: 10 }, { x: 5000, y: 5000 });
		expect(onPlace).toHaveBeenLastCalledWith({ x: 300 - PICKER_MARGIN, y: 200 - PICKER_MARGIN });
		const back = renderPicker({ place: { x: 100, y: 100 } });
		drag(back.grip, { x: 0, y: 0 }, { x: -900, y: -900 });
		expect(back.onPlace).toHaveBeenLastCalledWith(DEFAULT_PICKER);
	});

	it('is drawn inside a map that shrank, without moving its saved place', () => {
		const { rerender, props, placeOf, onPlace } = renderPicker({ place: { x: 500, y: 300 } });
		expect(placeOf()).toEqual({ x: '500px', y: '300px' });
		rerender(<ToolPicker {...props} map={{ w: 200, h: 120 }} />);
		expect(placeOf()).toEqual({ x: '192px', y: '112px' });
		expect(onPlace).not.toHaveBeenCalled();
		rerender(<ToolPicker {...props} map={MAP} />);
		expect(placeOf()).toEqual({ x: '500px', y: '300px' });
	});

	it('puts itself back when Escape ends a drag', () => {
		const { grip, onPlace, placeOf } = renderPicker({ place: { x: 40, y: 40 } });
		fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
		fireEvent.pointerMove(grip, { pointerId: 1, clientX: 80, clientY: 80 });
		expect(placeOf()).toEqual({ x: '120px', y: '120px' });
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(placeOf()).toEqual({ x: '40px', y: '40px' });
		fireEvent.pointerUp(grip, { pointerId: 1, clientX: 80, clientY: 80 });
		expect(onPlace).not.toHaveBeenCalled();
	});

	it('moves by the arrow keys on its grip, further with Shift, and stays inside', async () => {
		const user = userEvent.setup();
		const { grip, onPlace } = renderPicker({ place: { x: 40, y: 40 } });
		grip.focus();
		await user.keyboard('{ArrowRight}');
		expect(onPlace).toHaveBeenLastCalledWith({ x: 48, y: 40 });
		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		expect(onPlace).toHaveBeenLastCalledWith({ x: 40, y: 72 });
		onPlace.mockClear();
		const corner = renderPicker({ place: null });
		corner.grip.focus();
		await user.keyboard('{ArrowLeft}{ArrowUp}');
		expect(corner.onPlace).not.toHaveBeenCalled();
	});

	it('takes the pointer only inside its own box', () => {
		render(
			<div data-testid="map">
				<canvas data-testid="canvas" />
				<ToolPicker tool="paint" onTool={() => {}} map={MAP} place={null} onPlace={() => {}} />
			</div>,
		);
		const picker = screen.getByRole('group', { name: 'Tools' });
		expect(picker).not.toContainElement(screen.getByTestId('canvas'));
		expect(picker.parentElement).toBe(screen.getByTestId('map'));
	});
});
