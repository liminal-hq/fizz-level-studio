// Where the floating tool picker sits over the map, kept inside it as the map changes size
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ToolPickerPlacement } from '@liminal-hq/fizz-studio-protocol/generated/ToolPickerPlacement';
import type { Size } from '../panels/float/panelGeometry';

/** The gap the picker keeps from every edge of the map, in pixels; the floating panels keep the same. */
export const PICKER_MARGIN = 8;

/** Where the picker sits until it is moved: the map's top-left corner, one margin in. */
export const DEFAULT_PICKER: ToolPickerPlacement = { x: PICKER_MARGIN, y: PICKER_MARGIN };

/**
 * Keeps the picker's top-left corner inside the map, one margin from every edge, in whole pixels.
 * A map not yet measured (0 × 0) leaves the place as it is; a map too small for the picker puts it
 * at the top-left margin, and the map clips the rest.
 */
export function clampPicker(at: ToolPickerPlacement, picker: Size, map: Size): ToolPickerPlacement {
	if (!(map.w > 0 && map.h > 0)) return { x: Math.round(at.x), y: Math.round(at.y) };
	const maxX = Math.max(PICKER_MARGIN, map.w - picker.w - PICKER_MARGIN);
	const maxY = Math.max(PICKER_MARGIN, map.h - picker.h - PICKER_MARGIN);
	return {
		x: Math.round(Math.min(Math.max(at.x, PICKER_MARGIN), maxX)),
		y: Math.round(Math.min(Math.max(at.y, PICKER_MARGIN), maxY)),
	};
}
