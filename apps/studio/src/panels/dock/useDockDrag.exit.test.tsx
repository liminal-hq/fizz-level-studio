// Tests for a window exit taking a panel drag over once the pointer leaves the window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDockDrag, type DockDragOptions, type LeaveWindowInfo } from './useDockDrag';

const down = (el: Element, x: number, y: number) =>
	fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerId: 1 });
const move = (x: number, y: number) =>
	fireEvent.pointerMove(document, { clientX: x, clientY: y, pointerId: 1 });
const up = (x: number, y: number) =>
	fireEvent.pointerUp(document, { clientX: x, clientY: y, pointerId: 1 });

function setup(options: Partial<DockDragOptions> = {}, source: 'header' | 'scriptTab' = 'header') {
	let state: ReturnType<typeof useDockDrag>['state'] = null;
	function Probe() {
		const drag = useDockDrag({ locate: () => null, onDrop: () => {}, ...options });
		state = drag.state;
		return <button onPointerDown={(e) => drag.begin(e, 'script', source)}>grab</button>;
	}
	render(<Probe />);
	return { grab: screen.getByText('grab'), state: () => state };
}

const exitOf = () => ({
	move: vi.fn(),
	drop: vi.fn(),
	cancel: vi.fn(),
});

describe('a window exit', () => {
	it('is told of the press, the source and each move outside, and takes the release', () => {
		const exit = exitOf();
		const onLeaveWindow = vi.fn((_info: LeaveWindowInfo) => exit);
		const onCancel = vi.fn();
		const { grab } = setup({ onLeaveWindow, onCancel }, 'scriptTab');
		down(grab, 10, 10);
		act(() => {
			move(50, 50);
			move(-20, 50);
			move(-40, 60);
		});
		expect(onLeaveWindow).toHaveBeenCalledTimes(1);
		expect(onLeaveWindow.mock.calls[0]![0]).toMatchObject({
			id: 'script',
			source: 'scriptTab',
			start: { x: 10, y: 10 },
			grab: { x: 10, y: 10 },
		});
		expect(exit.move).toHaveBeenCalledWith({ x: -40, y: 60 });
		act(() => up(-60, 60));
		expect(exit.drop).toHaveBeenCalledWith({ x: -60, y: 60 });
		expect(exit.cancel).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('is cancelled by Escape, and the page says so', () => {
		const exit = exitOf();
		const onCancel = vi.fn();
		const { grab } = setup({ onLeaveWindow: () => exit, onCancel });
		down(grab, 10, 10);
		act(() => {
			move(50, 50);
			move(-20, 50);
		});
		act(() => {
			fireEvent.keyDown(document, { key: 'Escape' });
		});
		expect(exit.cancel).toHaveBeenCalledTimes(1);
		// The page still says the move was cancelled; the exit has only to let go.
		expect(onCancel).toHaveBeenCalledWith('script');
	});

	it('lets go when the pointer comes back, and a second exit gets a second call', () => {
		const first = exitOf();
		const second = exitOf();
		const onLeaveWindow = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
		const { grab } = setup({ onLeaveWindow });
		down(grab, 10, 10);
		act(() => {
			move(50, 50);
			move(-20, 50);
			move(30, 40);
		});
		expect(first.cancel).toHaveBeenCalledTimes(1);
		act(() => move(-30, 40));
		expect(onLeaveWindow).toHaveBeenCalledTimes(2);
		act(() => up(-35, 40));
		expect(second.drop).toHaveBeenCalledTimes(1);
		expect(first.drop).not.toHaveBeenCalled();
	});

	it('ends the page’s drag when the exit hands it to the compositor', () => {
		const exit = exitOf();
		let handOver = () => {};
		const { grab, state } = setup({
			onLeaveWindow: (info) => {
				handOver = info.finish;
				return exit;
			},
		});
		down(grab, 10, 10);
		act(() => {
			move(50, 50);
			move(-20, 50);
		});
		expect(state()).not.toBeNull();
		act(() => handOver());
		expect(state()).toBeNull();
		// A later move or release means nothing to the page, and the exit is not cancelled by it.
		act(() => {
			move(-60, 50);
			up(-60, 50);
		});
		expect(exit.drop).not.toHaveBeenCalled();
		expect(exit.cancel).not.toHaveBeenCalled();
	});

	it('cancels the drag as before when nothing took it over', () => {
		const onCancel = vi.fn();
		const { grab } = setup({ onLeaveWindow: () => undefined, onCancel });
		down(grab, 10, 10);
		act(() => {
			move(50, 50);
			move(-20, 50);
			up(-20, 50);
		});
		expect(onCancel).toHaveBeenCalledWith('script');
	});

	it('cancels an exit that is still running when the screen goes away', () => {
		const exit = exitOf();
		const { grab } = setup({ onLeaveWindow: () => exit });
		down(grab, 10, 10);
		act(() => {
			move(50, 50);
			move(-20, 50);
		});
		cleanup();
		expect(exit.cancel).toHaveBeenCalledTimes(1);
	});
});
