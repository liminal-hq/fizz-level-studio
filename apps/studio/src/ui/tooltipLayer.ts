// The one layer the tooltips are drawn in: fixed, with no size, so it takes no layout space
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** The id of the tooltips' layer, so tests and the live checks can find it. */
export const TOOLTIP_LAYER_ID = 'fls-tooltip-layer';

/**
 * The element in the page's `body` that holds the tooltip, a sibling of the script editor's popup
 * layer (`fls-popup-layer`). It is fixed and has no size, so it takes no layout space and nothing in
 * it can make the shell scroll; the tooltip is `position: fixed` and places against the window. It
 * sits one step under the menus (`--fls-z-menu`) and over the docks, rails and floating panels, and
 * as a box of its own it is never clipped by a panel's `overflow` or moved by a glass
 * `backdrop-filter`. It is made on first use, and again if the page's body was cleared.
 */
export function tooltipLayer(): HTMLElement {
	const existing = document.getElementById(TOOLTIP_LAYER_ID);
	if (existing?.isConnected) return existing;
	const layer = document.createElement('div');
	layer.id = TOOLTIP_LAYER_ID;
	Object.assign(layer.style, {
		position: 'fixed',
		inset: '0',
		width: '0',
		height: '0',
		overflow: 'visible',
		pointerEvents: 'none',
		zIndex: 'calc(var(--fls-z-menu) - 1)',
	});
	document.body.append(layer);
	return layer;
}
