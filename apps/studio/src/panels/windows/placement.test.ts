// Tests for what is recorded when a panel's window reports where it is
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { recordPlacement } from './placement';

const old = { x: 300, y: 200, w: 520, h: 720 };
const reported = { x: 0, y: 0, w: 640, h: 480 };

describe('recordPlacement', () => {
	it('takes everything a window that knows its position reports', () => {
		expect(recordPlacement(old, { placement: reported, positioned: true })).toEqual(reported);
	});

	it('keeps the recorded position when the platform cannot report one', () => {
		expect(recordPlacement(old, { placement: reported, positioned: false })).toEqual({
			x: 300,
			y: 200,
			w: 640,
			h: 480,
		});
	});

	it('takes the report whole when nothing is recorded yet', () => {
		expect(recordPlacement(null, { placement: reported, positioned: false })).toEqual(reported);
	});
});
