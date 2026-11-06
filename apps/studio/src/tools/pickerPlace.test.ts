// Tests for where the tool picker sits: inside the map, and out from under the docks
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { uncoveredRect } from '../canvas/viewport';
import { DEFAULT_PICKER, PICKER_MARGIN, clampPicker } from './pickerPlace';

const pill = { w: 220, h: 44 };

describe('clampPicker', () => {
	it('keeps the pill one margin inside the map', () => {
		const map = { w: 600, h: 400 };
		expect(clampPicker({ x: -50, y: -50 }, pill, map)).toEqual(DEFAULT_PICKER);
		expect(clampPicker({ x: 9999, y: 9999 }, pill, map)).toEqual({
			x: 600 - 220 - PICKER_MARGIN,
			y: 400 - 44 - PICKER_MARGIN,
		});
		expect(clampPicker({ x: 100.4, y: 50.6 }, pill, map)).toEqual({ x: 100, y: 51 });
	});

	it('leaves the place alone until the map is measured', () => {
		expect(clampPicker({ x: 900.2, y: 3 }, pill, { w: 0, h: 0 })).toEqual({ x: 900, y: 3 });
	});

	it('puts the pill at the top-left margin of a map too small for it', () => {
		expect(clampPicker({ x: 50, y: 50 }, pill, { w: 100, h: 30 })).toEqual(DEFAULT_PICKER);
	});
});

describe('the picker over a covered map', () => {
	// The map the picker is held to is the uncovered rectangle, and its place is measured from that
	// rectangle's corner, so in the frame it can never reach under a dock or the status line.
	const frame = { width: 1000, height: 600 };
	const insets = { top: 0, right: 300, bottom: 250, left: 232 };
	const visible = uncoveredRect(frame, insets);
	const map = { w: visible.width, h: visible.height };
	const inFrame = (at: { x: number; y: number }) => ({ x: visible.x + at.x, y: visible.y + at.y });

	it('stays inside the uncovered rectangle however far it is pushed', () => {
		for (const wanted of [
			{ x: -9999, y: -9999 },
			{ x: 9999, y: 9999 },
			{ x: 9999, y: -9999 },
			{ x: -9999, y: 9999 },
		]) {
			const at = inFrame(clampPicker(wanted, pill, map));
			expect(at.x).toBeGreaterThanOrEqual(insets.left + PICKER_MARGIN);
			expect(at.y).toBeGreaterThanOrEqual(insets.top + PICKER_MARGIN);
			expect(at.x + pill.w).toBeLessThanOrEqual(frame.width - insets.right - PICKER_MARGIN);
			expect(at.y + pill.h).toBeLessThanOrEqual(frame.height - insets.bottom - PICKER_MARGIN);
		}
	});

	it('sits one margin in from the left dock until it is moved', () => {
		expect(inFrame(clampPicker(DEFAULT_PICKER, pill, map))).toEqual({
			x: insets.left + PICKER_MARGIN,
			y: PICKER_MARGIN,
		});
	});
});
