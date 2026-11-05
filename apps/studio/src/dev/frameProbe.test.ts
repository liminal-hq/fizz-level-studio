// Tests for the frame probe's arithmetic
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { expandToRgba, percentile } from './frameProbe';

describe('percentile', () => {
	it('uses the nearest rank', () => {
		const values = [5, 1, 3, 2, 4, 10, 9, 8, 7, 6];
		expect(percentile(values, 0.5)).toBe(5);
		expect(percentile(values, 0.95)).toBe(10);
		expect(percentile(values, 0)).toBe(1);
	});

	it('is zero for no values', () => {
		expect(percentile([], 0.5)).toBe(0);
	});
});

describe('expandToRgba', () => {
	it('looks each index up in the palette and makes it opaque', () => {
		const palette = new Uint8Array(768);
		palette.set([10, 20, 30], 3);
		palette.set([40, 50, 60], 6);
		const out = new Uint8ClampedArray(8);
		expandToRgba(new Uint8Array([1, 2]), palette, out);
		expect(Array.from(out)).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
	});
});
