// The canvas commands: Pick this tile, Paint here, Erase here, and Show on the canvas
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Owned by the level package. They act on the keyboard cursor (a right-click moves it first), so
// they work from the keyboard and the palette too. The contract commit holds only the ids.

import type { CommandDef } from './registry';

export const CANVAS_PICK_HERE = 'canvas.pickHere';
export const CANVAS_PAINT_HERE = 'canvas.paintHere';
export const CANVAS_ERASE_HERE = 'canvas.eraseHere';
export const SELECTION_REVEAL = 'selection.reveal';
export const INSPECTOR_SHOW = 'panel.inspector.show';

/** The canvas commands. */
export function canvasCommands(): CommandDef[] {
	return [];
}
