// The right-click menus of the chrome: panel headers, rails and tabs, the script tab, the commands row, the workspace switcher, the zoom pill, the tools, History and the Palette
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Owned by the chrome package. The contract commit holds only the signature; the rows arrive with it.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import type { BridgeSnapshot } from './commandBridge';
import type {
	BrushContextTarget,
	CommandsRowContextTarget,
	HistoryContextTarget,
	PanelContextTarget,
	ScriptTabContextTarget,
	ToolsContextTarget,
	WorkspaceContextTarget,
	ZoomContextTarget,
} from './contextTargets';

export type ChromeContextTarget =
	| PanelContextTarget
	| ScriptTabContextTarget
	| CommandsRowContextTarget
	| WorkspaceContextTarget
	| ZoomContextTarget
	| ToolsContextTarget
	| HistoryContextTarget
	| BrushContextTarget;

/** The rows of the menu for a piece of the chrome; none where it has no menu. */
export function chromeMenuItems(
	_target: ChromeContextTarget,
	_snapshot: BridgeSnapshot,
): MenuItem[] {
	return [];
}
