// The tooltip's timing and placement: pure functions, so the component and the tests share one model
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** How long the pointer rests on a trigger before its tooltip appears. */
export const TOOLTIP_DELAY_MS = 500;
/** The delay while moving from one trigger to its neighbour. */
export const TOOLTIP_WARM_DELAY_MS = 0;
/** How soon after one tooltip closes the next counts as moving between neighbours. */
export const TOOLTIP_WARM_WINDOW_MS = 400;
/** The space between a trigger and its tooltip. */
export const TOOLTIP_GAP_PX = 6;
/** The least space kept between a tooltip and the window's edge. */
export const TOOLTIP_MARGIN_PX = 4;

/**
 * The delay before a tooltip shows: none while another is open, a moment after one closed (moving
 * along a row of buttons), the full rest otherwise.
 */
export function tooltipDelay(state: { open: boolean; closedAt: number; now: number }): number {
	const warm = state.open || state.now - state.closedAt < TOOLTIP_WARM_WINDOW_MS;
	return warm ? TOOLTIP_WARM_DELAY_MS : TOOLTIP_DELAY_MS;
}

export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface Placement {
	left: number;
	top: number;
	side: 'below' | 'above';
}

/**
 * Where a tooltip of this size goes: centred under its trigger, flipped above when it does not fit
 * below and there is more room above, and shifted sideways to stay inside the window. A tooltip
 * larger than the window is pinned to its top-left margin rather than pushed off either way.
 */
export function placeTooltip(anchor: Box, tip: Size, viewport: Size): Placement {
	const below = anchor.top + anchor.height + TOOLTIP_GAP_PX;
	const above = anchor.top - TOOLTIP_GAP_PX - tip.height;
	const fitsBelow = below + tip.height <= viewport.height - TOOLTIP_MARGIN_PX;
	const fitsAbove = above >= TOOLTIP_MARGIN_PX;
	const roomBelow = viewport.height - (anchor.top + anchor.height);
	const useAbove = !fitsBelow && (fitsAbove || anchor.top > roomBelow);
	const top = clamp(
		useAbove ? above : below,
		TOOLTIP_MARGIN_PX,
		viewport.height - tip.height - TOOLTIP_MARGIN_PX,
	);
	const centred = anchor.left + anchor.width / 2 - tip.width / 2;
	const left = clamp(centred, TOOLTIP_MARGIN_PX, viewport.width - tip.width - TOOLTIP_MARGIN_PX);
	return { left, top, side: useAbove ? 'above' : 'below' };
}

/** A value kept inside a range; when the range is empty (a tooltip bigger than the window) its start wins. */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

/** The parts of a shortcut's text to draw as keycaps: `Ctrl+Shift+P` is three, and `Ctrl++` is `Ctrl` and `+`. */
export function keyParts(keys: string): string[] {
	return keys.split(/\+(?=.)/).filter((part) => part.length > 0);
}
