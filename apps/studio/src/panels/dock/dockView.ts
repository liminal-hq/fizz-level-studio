// What the dock draws: the arrangement without hidden panels, and with every zone folded to its rail in level-first
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A saved workspace keeps every panel where it is, hidden or not. The dock draws a copy of it: a
// hidden panel has no tab, a group with nothing showing has gone, and a zone with nothing showing
// takes no room, not even a rail. Level-first folds the open zones in the drawn copy, so every
// zone keeps its rail and the level has the rest. The saved workspace is never touched.

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { PanelId } from '../float/panelSpecs';
import { ZONE_IDS } from './dockModel';

/** The workspace as it is drawn. */
export function visibleWorkspace(workspace: Workspace, levelFirst = false): Workspace {
	const next = structuredClone(workspace);
	for (const zone of ZONE_IDS) {
		const z = next.zones[zone];
		z.groups = z.groups
			.map((group) => {
				const tabs = group.tabs.filter((id) => workspace.panels[id]?.float.visible === true);
				return { tabs, active: tabs.includes(group.active) ? group.active : (tabs[0] ?? '') };
			})
			.filter((group) => group.tabs.length > 0);
		if (levelFirst) z.collapsed = true;
	}
	return next;
}

/**
 * What choosing a panel on its zone's rail does, read from the workspace as it is drawn: a folded
 * zone opens on it, the panel showing in an open zone folds the zone, and any other panel becomes
 * the showing one of its group. Null for a panel that is on no rail.
 */
export type RailChoice = 'open' | 'fold' | 'show';

export function railChoice(view: Workspace, id: string): RailChoice | null {
	const zone = ZONE_IDS.find((z) => view.zones[z].groups.some((g) => g.tabs.includes(id)));
	if (!zone) return null;
	if (view.zones[zone].collapsed) return 'open';
	return view.zones[zone].groups.some((g) => g.active === id) ? 'fold' : 'show';
}

/** Whether each panel is shown, as the Panels menu and the application menu list them. */
export function shownPanels(
	workspace: Workspace,
	ids: readonly PanelId[],
): Record<PanelId, boolean> {
	return Object.fromEntries(
		ids.map((id) => [id, workspace.panels[id]?.float.visible === true]),
	) as Record<PanelId, boolean>;
}
