// Tests for the host plugin's guest-side frame decoding
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { decodeFrame } from './index';

/** Builds a message the way the Rust host writes it. */
function message(options: { width: number; height: number; palette: boolean; revision?: bigint }) {
	const { width, height, palette, revision = 7n } = options;
	const palettePart = palette ? 768 : 0;
	const buffer = new ArrayBuffer(13 + palettePart + width * height);
	const view = new DataView(buffer);
	view.setBigUint64(0, revision, true);
	view.setUint16(8, width, true);
	view.setUint16(10, height, true);
	view.setUint8(12, palette ? 1 : 0);
	new Uint8Array(buffer, 13 + palettePart).fill(9);
	if (palette) new Uint8Array(buffer, 13, 768).fill(200);
	return buffer;
}

describe('decodeFrame', () => {
	it('reads a frame with a palette', () => {
		const frame = decodeFrame(message({ width: 4, height: 2, palette: true }));
		expect(frame.revision).toBe(7n);
		expect([frame.width, frame.height]).toEqual([4, 2]);
		expect(frame.palette?.length).toBe(768);
		expect(frame.pixels.length).toBe(8);
		expect(frame.pixels[0]).toBe(9);
	});

	it('reads a frame without one', () => {
		const frame = decodeFrame(message({ width: 3, height: 3, palette: false }));
		expect(frame.palette).toBeNull();
		expect(frame.pixels.length).toBe(9);
	});

	it('refuses bytes that are not a whole message', () => {
		const whole = message({ width: 4, height: 2, palette: true });
		expect(() => decodeFrame(whole.slice(0, 5))).toThrow(/header/);
		expect(() => decodeFrame(whole.slice(0, 100))).toThrow(/palette/);
		expect(() => decodeFrame(whole.slice(0, whole.byteLength - 1))).toThrow(/pixels/);
		const flagged = whole.slice(0);
		new DataView(flagged).setUint8(12, 0x80);
		expect(() => decodeFrame(flagged)).toThrow(/unknown flags/);
	});
});
