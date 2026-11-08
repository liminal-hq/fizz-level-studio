// The right-click menus of the level: a cell on the canvas, a row of Objects, a row of Layers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Owned by the level package. The contract commit holds only the signature; the rows arrive with it.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import type { BridgeSnapshot } from './commandBridge';
import type {
	CanvasContextTarget,
	LayerRowContextTarget,
	ObjectRowContextTarget,
} from './contextTargets';

export type LevelContextTarget =
	| CanvasContextTarget
	| ObjectRowContextTarget
	| LayerRowContextTarget;

/** The rows of the menu for a thing or cell on the canvas, a row of Objects, or a row of Layers; none for a level that has no such menu. */
export function canvasMenuItems(
	_target: LevelContextTarget,
	_snapshot: BridgeSnapshot,
): MenuItem[] {
	return [];
}
