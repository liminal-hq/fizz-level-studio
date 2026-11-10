// Tests for the floating panel: dragging, resizing, keys, collapsing and coming to the front
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LeaveWindowInfo } from '../dock/useDockDrag';
import { FloatingPanel, type FloatingPanelProps } from './FloatingPanel';

const rect = { x: 100, y: 100, w: 300, h: 200 };

function setup(over: Partial<FloatingPanelProps> = {}) {
	const onChange = vi.fn();
	const onToggleCollapsed = vi.fn();
	const onRaise = vi.fn();
	const view = render(
		<FloatingPanel
			id="demo"
			title="Demo"
			subtitle="Grass"
			rect={rect}
			collapsed={false}
			z={3}
			min={{ w: 200, h: 120 }}
			area={{ w: 1000, h: 600 }}
			onChange={onChange}
			onToggleCollapsed={onToggleCollapsed}
			onRaise={onRaise}
			{...over}
		>
			<p>Content</p>
		</FloatingPanel>,
	);
	return { onChange, onToggleCollapsed, onRaise, ...view };
}

const pointer = (type: string, x: number, y: number) => ({
	type,
	clientX: x,
	clientY: y,
	button: 0,
});

describe('FloatingPanel', () => {
	it('shows its title, subtitle and content, named by its title', () => {
		setup();
		expect(screen.getByRole('region', { name: 'Demo' })).toBeInTheDocument();
		expect(screen.getByText('Grass')).toBeInTheDocument();
		expect(screen.getByText('Content')).toBeInTheDocument();
	});

	it('is placed by custom properties the stylesheet reads', () => {
		const { container } = setup();
		const panel = container.querySelector('[data-panel="demo"]') as HTMLElement;
		expect(panel.style.getPropertyValue('--fls-float-x')).toBe('100px');
		expect(panel.style.getPropertyValue('--fls-float-h')).toBe('200px');
		expect(panel.style.getPropertyValue('--fls-float-z')).toBe('3');
	});

	it('moves with the header drag and reports the end of it', () => {
		const { onChange } = setup();
		const header = screen.getByRole('heading', { name: 'Demo' }).parentElement as HTMLElement;
		fireEvent.pointerDown(header, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
		fireEvent.pointerMove(header, { pointerId: 1, clientX: 40, clientY: 30 });
		expect(onChange).toHaveBeenLastCalledWith({ ...rect, x: 130, y: 120 }, false);
		fireEvent.pointerUp(header, { pointerId: 1, clientX: 60, clientY: 50 });
		expect(onChange).toHaveBeenLastCalledWith({ ...rect, x: 150, y: 140 }, true);
	});

	it('keeps the panel inside the area while dragging', () => {
		const { onChange } = setup();
		const header = screen.getByRole('heading', { name: 'Demo' }).parentElement as HTMLElement;
		fireEvent.pointerDown(header, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(header, { pointerId: 1, clientX: -900, clientY: 5000 });
		expect(onChange).toHaveBeenLastCalledWith({ ...rect, x: 0, y: 400 }, false);
	});

	it('goes back where it was when Escape cancels a drag', () => {
		const { onChange } = setup();
		const header = screen.getByRole('heading', { name: 'Demo' }).parentElement as HTMLElement;
		fireEvent.pointerDown(header, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(header, { pointerId: 1, clientX: 50, clientY: 50 });
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onChange).toHaveBeenLastCalledWith(rect, true);
		// A later pointer move changes nothing: the drag is over.
		onChange.mockClear();
		fireEvent.pointerMove(header, { pointerId: 1, clientX: 90, clientY: 90 });
		expect(onChange).not.toHaveBeenCalled();
	});

	it('resizes from the corner grip down to the minimum', () => {
		const { onChange } = setup();
		const grip = screen.getByRole('button', { name: 'Resize Demo' });
		fireEvent.pointerDown(grip, { pointerId: 2, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(grip, { pointerId: 2, clientX: 50, clientY: 10 });
		expect(onChange).toHaveBeenLastCalledWith({ ...rect, w: 350, h: 210 }, false);
		fireEvent.pointerMove(grip, { pointerId: 2, clientX: -900, clientY: -900 });
		expect(onChange).toHaveBeenLastCalledWith({ ...rect, w: 200, h: 120 }, false);
	});

	const handleOf = (container: HTMLElement, name: string) =>
		container.querySelector(`[data-resize-handle="${name}"]`) as HTMLElement;

	it.each([
		// handle, pointer travel, then the rectangle it should give: the opposite edges stay put.
		['e', 30, 99, { ...rect, w: 330 }],
		['s', 99, 30, { ...rect, h: 230 }],
		['w', -30, 99, { x: 70, y: 100, w: 330, h: 200 }],
		['n', 99, -30, { x: 100, y: 70, w: 300, h: 230 }],
		['ne', 30, -30, { x: 100, y: 70, w: 330, h: 230 }],
		['nw', -30, -30, { x: 70, y: 70, w: 330, h: 230 }],
		['sw', -30, 30, { x: 70, y: 100, w: 330, h: 230 }],
	] as const)('resizes from the %s handle with a pointer sequence', (name, dx, dy, expected) => {
		const { onChange, container } = setup();
		const handle = handleOf(container, name);
		const mx = dx === 99 ? 0 : dx;
		const my = dy === 99 ? 0 : dy;
		fireEvent.pointerDown(handle, { pointerId: 5, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(handle, { pointerId: 5, clientX: mx, clientY: my });
		expect(onChange).toHaveBeenLastCalledWith(expected, false);
		fireEvent.pointerUp(handle, { pointerId: 5, clientX: mx, clientY: my });
		expect(onChange).toHaveBeenLastCalledWith(expected, true);
	});

	it('holds the right edge when a west drag reaches the minimum size', () => {
		const { onChange, container } = setup();
		const handle = handleOf(container, 'w');
		fireEvent.pointerDown(handle, { pointerId: 5, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(handle, { pointerId: 5, clientX: 900, clientY: 0 });
		expect(onChange).toHaveBeenLastCalledWith({ x: 200, y: 100, w: 200, h: 200 }, false);
	});

	it('keeps a north-west drag inside the area', () => {
		const { onChange, container } = setup();
		const handle = handleOf(container, 'nw');
		fireEvent.pointerDown(handle, { pointerId: 5, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(handle, { pointerId: 5, clientX: -900, clientY: -900 });
		expect(onChange).toHaveBeenLastCalledWith({ x: 0, y: 0, w: 400, h: 300 }, false);
	});

	it('shows a guide for the moving edge only, and clears it on release', () => {
		const onGuides = vi.fn();
		const { container } = setup({ onGuides });
		const handle = handleOf(container, 'w');
		fireEvent.pointerDown(handle, { pointerId: 5, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(handle, { pointerId: 5, clientX: -97, clientY: 0 });
		expect(onGuides).toHaveBeenLastCalledWith([{ axis: 'x', at: 0 }]);
		fireEvent.pointerUp(handle, { pointerId: 5, clientX: -97, clientY: 0 });
		expect(onGuides).toHaveBeenLastCalledWith([]);
	});

	it('puts the panel back when Escape cancels an edge resize', () => {
		const { onChange, container } = setup();
		const handle = handleOf(container, 'n');
		fireEvent.pointerDown(handle, { pointerId: 5, clientX: 0, clientY: 0, button: 0 });
		fireEvent.pointerMove(handle, { pointerId: 5, clientX: 0, clientY: -40 });
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onChange).toHaveBeenLastCalledWith(rect, true);
	});

	it('hides the edge handles from the keyboard and assistive technology', () => {
		const { container } = setup();
		const handles = container.querySelectorAll('[data-resize-handle]');
		expect(handles).toHaveLength(7);
		handles.forEach((h) => {
			expect(h).toHaveAttribute('aria-hidden', 'true');
			expect(h).not.toHaveAttribute('tabindex');
		});
		expect(screen.getAllByRole('button', { name: 'Resize Demo' })).toHaveLength(1);
	});

	it('has no resize handles when collapsed or maximised', () => {
		const first = setup({ collapsed: true });
		expect(first.container.querySelectorAll('[data-resize-handle]')).toHaveLength(0);
		first.unmount();
		const second = setup({ maximised: true });
		expect(second.container.querySelectorAll('[data-resize-handle]')).toHaveLength(0);
	});

	it('moves with the arrow keys on its grip, and Shift takes a larger step', async () => {
		const user = userEvent.setup();
		const { onChange } = setup();
		screen.getByRole('button', { name: 'Move Demo' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(onChange).toHaveBeenLastCalledWith({ ...rect, x: 108 }, true);
		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		expect(onChange).toHaveBeenLastCalledWith({ ...rect, y: 132 }, true);
	});

	it('resizes with the arrow keys on its corner grip', async () => {
		const user = userEvent.setup();
		const { onChange } = setup();
		screen.getByRole('button', { name: 'Resize Demo' }).focus();
		await user.keyboard('{ArrowRight}{ArrowDown}');
		expect(onChange).toHaveBeenNthCalledWith(1, { ...rect, w: 308 }, true);
	});

	it('puts the panel back with Escape after a key move', async () => {
		const user = userEvent.setup();
		const { onChange } = setup();
		screen.getByRole('button', { name: 'Move Demo' }).focus();
		await user.keyboard('{ArrowRight}{Escape}');
		expect(onChange).toHaveBeenLastCalledWith(rect, true);
	});

	it('collapses and expands with its chevron, which says which it will do', async () => {
		const user = userEvent.setup();
		const { onToggleCollapsed, rerender } = setup();
		const open = screen.getByRole('button', { name: 'Collapse Demo' });
		expect(open).toHaveAttribute('aria-expanded', 'true');
		await user.click(open);
		expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
		rerender(
			<FloatingPanel
				id="demo"
				title="Demo"
				rect={rect}
				collapsed
				z={3}
				min={{ w: 200, h: 120 }}
				area={{ w: 1000, h: 600 }}
				onChange={vi.fn()}
				onToggleCollapsed={onToggleCollapsed}
				onRaise={vi.fn()}
			>
				<p>Content</p>
			</FloatingPanel>,
		);
		expect(screen.getByRole('button', { name: 'Expand Demo' })).toHaveAttribute(
			'aria-expanded',
			'false',
		);
		expect(screen.queryByRole('button', { name: 'Resize Demo' })).toBeNull();
	});

	it('comes to the front when grabbed or focused', async () => {
		const user = userEvent.setup();
		const { onRaise } = setup();
		fireEvent.pointerDown(screen.getByText('Content'), pointer('pointerdown', 1, 1));
		expect(onRaise).toHaveBeenCalledTimes(1);
		await user.tab();
		expect(onRaise).toHaveBeenCalledTimes(2);
	});

	it('snaps a drag to a neighbour’s edge and reports the guide, then clears it', () => {
		const onGuides = vi.fn();
		const neighbours = [{ x: 600, y: 500, w: 100, h: 100 }];
		setup({ neighbours, onGuides });
		const header = screen.getByRole('heading', { name: 'Demo' }).parentElement as HTMLElement;
		fireEvent.pointerDown(header, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
		// The panel's right edge (400) lands 3 px short of the neighbour's left edge (600).
		fireEvent.pointerMove(header, { pointerId: 1, clientX: 197, clientY: 0 });
		expect(onGuides).toHaveBeenLastCalledWith([{ axis: 'x', at: 600 }]);
		fireEvent.pointerUp(header, { pointerId: 1, clientX: 197, clientY: 0 });
		expect(onGuides).toHaveBeenLastCalledWith([]);
	});

	it('shows extra header controls', () => {
		setup({ actions: <button type="button">Extra</button> });
		expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
	});

	describe('dragged out of the window', () => {
		const exitOf = () => ({ move: vi.fn(), drop: vi.fn(), cancel: vi.fn() });
		const headerOf = () =>
			screen.getByRole('heading', { name: 'Demo' }).parentElement as HTMLElement;

		it('calls the window exit once, with the press, and hands it the move and the release', () => {
			const exit = exitOf();
			const onLeaveWindow = vi.fn((_info: LeaveWindowInfo) => exit);
			const { onChange } = setup({ onLeaveWindow });
			const header = headerOf();
			fireEvent.pointerDown(header, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: 50, clientY: 50 });
			expect(onLeaveWindow).not.toHaveBeenCalled();
			fireEvent.pointerMove(header, { pointerId: 1, clientX: -30, clientY: 50 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: -60, clientY: 60 });
			expect(onLeaveWindow).toHaveBeenCalledTimes(1);
			expect(onLeaveWindow.mock.calls[0]![0]).toMatchObject({
				id: 'demo',
				source: 'header',
				start: { x: 10, y: 10 },
			});
			expect(exit.move).toHaveBeenLastCalledWith({ x: -60, y: 60 });
			onChange.mockClear();
			fireEvent.pointerUp(header, { pointerId: 1, clientX: -80, clientY: 60 });
			expect(exit.drop).toHaveBeenCalledWith({ x: -80, y: 60 });
			// The panel is put back where it was pressed, for the way back from its window.
			expect(onChange).toHaveBeenLastCalledWith(rect, true);
		});

		it('keeps floating, and lets the exit go, when dropped back inside', () => {
			const exit = exitOf();
			const onDockDrop = vi.fn(() => false);
			const { onChange } = setup({ onLeaveWindow: () => exit, onDockDrop });
			const header = headerOf();
			fireEvent.pointerDown(header, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: -30, clientY: 50 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: 200, clientY: 150 });
			expect(exit.cancel).toHaveBeenCalledTimes(1);
			fireEvent.pointerUp(header, { pointerId: 1, clientX: 200, clientY: 150 });
			expect(exit.drop).not.toHaveBeenCalled();
			expect(onDockDrop).toHaveBeenCalledWith({ x: 200, y: 150 });
			expect(onChange).toHaveBeenLastCalledWith({ ...rect, x: 290, y: 240 }, true);
		});

		it('is cancelled by Escape while outside, and the panel goes back', () => {
			const exit = exitOf();
			const { onChange } = setup({ onLeaveWindow: () => exit });
			const header = headerOf();
			fireEvent.pointerDown(header, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: -30, clientY: 50 });
			fireEvent.keyDown(document, { key: 'Escape' });
			expect(exit.cancel).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenLastCalledWith(rect, true);
			fireEvent.pointerUp(header, { pointerId: 1, clientX: -80, clientY: 60 });
			expect(exit.drop).not.toHaveBeenCalled();
		});

		it('is put back, and not dropped, when the exit finishes the drag itself', () => {
			let finish = () => {};
			const exit = exitOf();
			const { onChange } = setup({
				onLeaveWindow: (info) => {
					finish = info.finish;
					return exit;
				},
			});
			const header = headerOf();
			fireEvent.pointerDown(header, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: -30, clientY: 50 });
			finish();
			expect(onChange).toHaveBeenLastCalledWith(rect, true);
			fireEvent.pointerUp(header, { pointerId: 1, clientX: -80, clientY: 60 });
			expect(exit.drop).not.toHaveBeenCalled();
		});

		it('leaves the exit running when the panel unmounts mid-drag, as it does once torn off', () => {
			const exit = exitOf();
			const { unmount } = setup({ onLeaveWindow: () => exit });
			const header = headerOf();
			fireEvent.pointerDown(header, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: -30, clientY: 50 });
			unmount();
			expect(exit.cancel).not.toHaveBeenCalled();
		});

		it('places the panel as before when no exit is given', () => {
			const onLeaveWindow = vi.fn();
			const { onChange } = setup({ onLeaveWindow });
			const header = headerOf();
			fireEvent.pointerDown(header, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
			fireEvent.pointerMove(header, { pointerId: 1, clientX: -30, clientY: 50 });
			fireEvent.pointerUp(header, { pointerId: 1, clientX: -30, clientY: 50 });
			expect(onLeaveWindow).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenLastCalledWith({ ...rect, x: 60, y: 140 }, true);
		});
	});
});
