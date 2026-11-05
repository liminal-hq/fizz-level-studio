// Tests for the canvas wheel rules
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { wheelAction } from './wheel';

const plain = { deltaX: 0, deltaY: 0, shiftKey: false, altKey: false };

describe('wheelAction', () => {
	it('zooms in on a wheel rolled up and out on one rolled down', () => {
		expect(wheelAction({ ...plain, deltaY: -100 })).toEqual({ kind: 'zoom', step: 1 });
		expect(wheelAction({ ...plain, deltaY: 100 })).toEqual({ kind: 'zoom', step: -1 });
	});

	it('pans sideways on a horizontal wheel, in the direction it moved', () => {
		expect(wheelAction({ ...plain, deltaX: 80 })).toEqual({ kind: 'pan', dx: 80, dy: 0 });
		expect(wheelAction({ ...plain, deltaX: -40 })).toEqual({ kind: 'pan', dx: -40, dy: 0 });
	});

	it('does not zoom on a swipe that is mostly sideways', () => {
		expect(wheelAction({ ...plain, deltaX: 60, deltaY: 10 })).toEqual({
			kind: 'pan',
			dx: 60,
			dy: 0,
		});
	});

	it('zooms on a swipe that is mostly vertical', () => {
		expect(wheelAction({ ...plain, deltaX: 5, deltaY: -60 })).toEqual({ kind: 'zoom', step: 1 });
	});

	it('pans sideways with Shift and up and down with Alt', () => {
		expect(wheelAction({ ...plain, deltaY: 100, shiftKey: true })).toEqual({
			kind: 'pan',
			dx: 100,
			dy: 0,
		});
		expect(wheelAction({ ...plain, deltaY: 100, altKey: true })).toEqual({
			kind: 'pan',
			dx: 0,
			dy: 100,
		});
	});

	it('does nothing for an event that moved nothing', () => {
		expect(wheelAction(plain)).toEqual({ kind: 'none' });
	});
});
