// Tests for the tooltip's timing and placement: the pure model the component draws from
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	TOOLTIP_DELAY_MS,
	TOOLTIP_GAP_PX,
	TOOLTIP_MARGIN_PX,
	TOOLTIP_WARM_DELAY_MS,
	TOOLTIP_WARM_WINDOW_MS,
	keyParts,
	placeTooltip,
	tooltipDelay,
} from './tooltipModel';

describe('tooltipDelay', () => {
	it('rests for about half a second when nothing was showing', () => {
		expect(TOOLTIP_DELAY_MS).toBe(500);
		expect(tooltipDelay({ open: false, closedAt: Number.NEGATIVE_INFINITY, now: 10_000 })).toBe(
			TOOLTIP_DELAY_MS,
		);
	});

	it('is instant while another tooltip is open', () => {
		expect(tooltipDelay({ open: true, closedAt: 0, now: 10_000 })).toBe(TOOLTIP_WARM_DELAY_MS);
	});

	it('is instant just after one closed, and rests again after the warm window', () => {
		expect(
			tooltipDelay({ open: false, closedAt: 1_000, now: 1_000 + TOOLTIP_WARM_WINDOW_MS - 1 }),
		).toBe(TOOLTIP_WARM_DELAY_MS);
		expect(
			tooltipDelay({ open: false, closedAt: 1_000, now: 1_000 + TOOLTIP_WARM_WINDOW_MS }),
		).toBe(TOOLTIP_DELAY_MS);
	});
});

const VIEW = { width: 800, height: 600 };
const TIP = { width: 120, height: 40 };

describe('placeTooltip', () => {
	it('centres the tooltip below its trigger', () => {
		const placed = placeTooltip({ left: 100, top: 50, width: 30, height: 20 }, TIP, VIEW);
		expect(placed).toEqual({ left: 115 - 60, top: 70 + TOOLTIP_GAP_PX, side: 'below' });
	});

	it('flips above when it does not fit below and there is room above', () => {
		const placed = placeTooltip({ left: 100, top: 560, width: 30, height: 20 }, TIP, VIEW);
		expect(placed.side).toBe('above');
		expect(placed.top).toBe(560 - TOOLTIP_GAP_PX - TIP.height);
	});

	it('shifts right from the left edge and left from the right edge', () => {
		const left = placeTooltip({ left: 0, top: 50, width: 20, height: 20 }, TIP, VIEW);
		expect(left.left).toBe(TOOLTIP_MARGIN_PX);
		const right = placeTooltip({ left: 790, top: 50, width: 10, height: 20 }, TIP, VIEW);
		expect(right.left).toBe(VIEW.width - TIP.width - TOOLTIP_MARGIN_PX);
	});

	it('stays below, clamped, when neither side has room but below has more', () => {
		const placed = placeTooltip(
			{ left: 10, top: 5, width: 20, height: 20 },
			{ width: 100, height: 590 },
			VIEW,
		);
		expect(placed.side).toBe('below');
		expect(placed.top).toBe(VIEW.height - 590 - TOOLTIP_MARGIN_PX);
	});

	it('keeps every placement inside the window for a spread of anchors', () => {
		for (let x = -20; x <= 820; x += 40) {
			for (let y = -20; y <= 620; y += 40) {
				const p = placeTooltip({ left: x, top: y, width: 24, height: 24 }, TIP, VIEW);
				expect(p.left).toBeGreaterThanOrEqual(TOOLTIP_MARGIN_PX);
				expect(p.left + TIP.width).toBeLessThanOrEqual(VIEW.width - TOOLTIP_MARGIN_PX);
				expect(p.top).toBeGreaterThanOrEqual(TOOLTIP_MARGIN_PX);
				expect(p.top + TIP.height).toBeLessThanOrEqual(VIEW.height - TOOLTIP_MARGIN_PX);
			}
		}
	});

	it('pins a tooltip bigger than the window to its top-left margin', () => {
		const p = placeTooltip(
			{ left: 50, top: 50, width: 20, height: 20 },
			{ width: 900, height: 700 },
			VIEW,
		);
		expect(p).toMatchObject({ left: TOOLTIP_MARGIN_PX, top: TOOLTIP_MARGIN_PX });
	});
});

describe('keyParts', () => {
	it('splits a shortcut into keys', () => {
		expect(keyParts('Ctrl+Shift+P')).toEqual(['Ctrl', 'Shift', 'P']);
		expect(keyParts('B')).toEqual(['B']);
	});

	it('keeps a plus key as a key', () => {
		expect(keyParts('Ctrl++')).toEqual(['Ctrl', '+']);
	});
});
