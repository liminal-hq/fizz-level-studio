// The rows of a panel's own menu (the vertical ⋮ in its header): where it sits, how it leaves, and the layout
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import type { PanelId } from '../panels/float/panelSpecs';
import { commandRow, menuSections } from './appMenuModel';
import type { BridgeSnapshot } from './commandBridge';
import {
	allCommands,
	dockBackCommandId,
	panelDockCommandId,
	panelFloatCommandId,
	tearOffCommandId,
	viewOf,
} from './registry';

/** The ids of the rows of a panel's menu, in order, for the panel `id`: place, then how it leaves, then the layout. */
export function panelMenuCommandIds(id: PanelId, away: boolean): string[][] {
	return [
		[
			panelDockCommandId(id, 'left'),
			panelDockCommandId(id, 'right'),
			panelDockCommandId(id, 'bottom'),
			panelFloatCommandId(id),
		],
		[away ? dockBackCommandId(id) : tearOffCommandId(id)],
		['view.resetLayout'],
	];
}

/**
 * The menu in a panel's header: Dock left, right and bottom, Float (the row for where the panel is
 * now is ticked and dimmed), Tear off or Dock back, and Reset layout. It is built from the same
 * commands as the Window menu and the palette, with their short labels because the menu already
 * belongs to one panel, and runs them through `runCommand`.
 */
export function panelMenuItems(id: PanelId, snapshot: BridgeSnapshot): MenuItem[] {
	const defs = allCommands(snapshot.facts);
	const away = snapshot.facts.away[id];
	const rows = (ids: string[]): MenuItem[] =>
		ids.flatMap((rowId) => {
			const def = defs.find((command) => command.id === rowId);
			return def ? commandRow(viewOf(def, snapshot), { short: true }) : [];
		});
	return menuSections(...panelMenuCommandIds(id, away).map(rows));
}
