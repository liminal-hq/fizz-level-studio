// The right-click menu of the script editor: Copy, Select all, Find, Fold all and Unfold all
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Owned by the chrome package. The rows are the `script.*` commands in `scriptCommands.ts`, which
// the Script panel publishes handlers for. The contract commit holds only the signature.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import type { BridgeSnapshot } from './commandBridge';
import type { ScriptEditorContextTarget } from './contextTargets';

/** The rows of the menu for the script editor, its gutter or a hover tooltip over it. */
export function scriptMenuItems(
	_target: ScriptEditorContextTarget,
	_snapshot: BridgeSnapshot,
): MenuItem[] {
	return [];
}
