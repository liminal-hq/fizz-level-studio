// Tests for the floating panel: dragging, resizing, keys, collapsing and coming to the front
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

	it('shows extra header controls', () => {
		setup({ actions: <button type="button">Extra</button> });
		expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
	});
});
