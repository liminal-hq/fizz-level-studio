// Tests for the in-app tooltip: delays, focus, dismissal, the disabled reason, one at a time and the wiring to its trigger
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';
import { TOOLTIP_LAYER_ID } from './tooltipLayer';
import { TOOLTIP_DELAY_MS } from './tooltipModel';
import { resetTooltips } from './tooltipStore';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanup();
	resetTooltips();
	vi.useRealTimers();
});

function row() {
	return render(
		<div>
			<Tooltip label="Save" keys="Ctrl+S">
				<button type="button" aria-label="Save">
					S
				</button>
			</Tooltip>
			<Tooltip label="Undo" reason="Nothing to undo yet">
				<button type="button" aria-label="Undo" disabled>
					U
				</button>
			</Tooltip>
			<Tooltip label="Open" keys="Ctrl+O">
				<button type="button" aria-label="Open">
					O
				</button>
			</Tooltip>
		</div>,
	);
}

const button = (name: string) => screen.getByRole('button', { name });
const hover = (el: HTMLElement) => fireEvent.pointerEnter(el, { pointerType: 'mouse' });
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Tooltip', () => {
	it('shows after the hover delay and not before', () => {
		row();
		hover(button('Save'));
		wait(TOOLTIP_DELAY_MS - 1);
		expect(screen.queryByRole('tooltip')).toBeNull();
		wait(1);
		expect(screen.getByRole('tooltip')).toHaveTextContent('SaveCtrlS');
	});

	it('wires aria-describedby while shown, and keeps the aria-label', () => {
		row();
		const save = button('Save');
		expect(save).not.toHaveAttribute('aria-describedby');
		hover(save);
		wait(TOOLTIP_DELAY_MS);
		expect(save).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
		expect(save).toHaveAttribute('aria-label', 'Save');
		fireEvent.pointerLeave(save);
		expect(save).not.toHaveAttribute('aria-describedby');
	});

	it('draws the shortcut as keycaps', () => {
		row();
		hover(button('Save'));
		wait(TOOLTIP_DELAY_MS);
		expect(
			[...screen.getByRole('tooltip').querySelectorAll('kbd')].map((k) => k.textContent),
		).toEqual(['Ctrl', 'S']);
	});

	it('shows at once on keyboard focus and hides on blur', () => {
		row();
		act(() => button('Save').focus());
		expect(screen.getByRole('tooltip')).toBeInTheDocument();
		act(() => button('Save').blur());
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('hides on pointer leave before it showed, so it never appears late', () => {
		row();
		hover(button('Save'));
		wait(200);
		fireEvent.pointerLeave(button('Save'));
		wait(1000);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('hides on Escape, on a press and on a scroll', () => {
		row();
		const open = () => {
			hover(button('Save'));
			wait(TOOLTIP_DELAY_MS);
			expect(screen.getByRole('tooltip')).toBeInTheDocument();
		};
		open();
		fireEvent.keyDown(document.body, { key: 'Escape' });
		expect(screen.queryByRole('tooltip')).toBeNull();
		open();
		fireEvent.pointerDown(button('Save'));
		expect(screen.queryByRole('tooltip')).toBeNull();
		open();
		fireEvent.scroll(document.body);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('never shows for a touch pointer', () => {
		row();
		fireEvent.pointerEnter(button('Save'), { pointerType: 'touch' });
		wait(2000);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('shows one tooltip at a time, and moves to the neighbour at once', () => {
		row();
		hover(button('Save'));
		wait(TOOLTIP_DELAY_MS);
		fireEvent.pointerLeave(button('Save'));
		hover(button('Open'));
		expect(screen.getAllByRole('tooltip')).toHaveLength(1);
		expect(screen.getByRole('tooltip')).toHaveTextContent('OpenCtrlO');
		expect(button('Save')).not.toHaveAttribute('aria-describedby');
	});

	it('shows the reason for a disabled control under its label', () => {
		row();
		hover(button('Undo'));
		wait(TOOLTIP_DELAY_MS);
		expect(screen.getByRole('tooltip')).toHaveTextContent('UndoNothing to undo yet');
	});

	it('goes when its trigger is removed', () => {
		const { unmount } = row();
		act(() => button('Save').focus());
		expect(screen.getByRole('tooltip')).toBeInTheDocument();
		unmount();
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('draws in the one layer that takes no layout space, with pointer events off', () => {
		row();
		act(() => button('Save').focus());
		const layer = document.getElementById(TOOLTIP_LAYER_ID)!;
		expect(layer.parentElement).toBe(document.body);
		expect(layer.style.position).toBe('fixed');
		expect(layer.style.width).toBe('0px');
		expect(layer.style.height).toBe('0px');
		expect(layer).toContainElement(screen.getByRole('tooltip'));
		expect(document.querySelectorAll(`#${TOOLTIP_LAYER_ID}`)).toHaveLength(1);
	});

	it('keeps the trigger’s own handlers', () => {
		const onFocus = vi.fn();
		const onPointerDown = vi.fn();
		render(
			<Tooltip label="Go">
				<button type="button" onFocus={onFocus} onPointerDown={onPointerDown}>
					Go
				</button>
			</Tooltip>,
		);
		const go = screen.getByRole('button', { name: 'Go' });
		act(() => go.focus());
		fireEvent.pointerDown(go);
		expect(onFocus).toHaveBeenCalledOnce();
		expect(onPointerDown).toHaveBeenCalledOnce();
	});
});
