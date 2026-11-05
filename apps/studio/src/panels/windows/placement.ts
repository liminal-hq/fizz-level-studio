// What to record about a torn-off panel's window when its window reports where it is
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { PanelPlaced } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlaced';
import type { WindowPlacement } from '@liminal-hq/fizz-studio-protocol/generated/WindowPlacement';

/**
 * The record for a window that reported `placed`, given the one on record. A platform that cannot
 * say where a window is (Wayland) reports its size only, so the recorded position is kept and only
 * the size is taken.
 */
export function recordPlacement(
	recorded: WindowPlacement | null,
	placed: Pick<PanelPlaced, 'placement' | 'positioned'>,
): WindowPlacement {
	if (placed.positioned || !recorded) return { ...placed.placement };
	return { ...placed.placement, x: recorded.x, y: recorded.y };
}
