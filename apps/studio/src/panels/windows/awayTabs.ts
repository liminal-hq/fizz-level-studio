// Puts the panels that are away in windows of their own back into the dock's tabs, as markers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A panel in its own window has no place in any zone in the saved workspace. The main window still
// shows it, as a tab in the zone it came from (its `home`) whose content is the "open in its own
// window" notice, so the person sees where it went and can dock it back. This is a drawing aid: the
// saved workspace is never changed.

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import { PANEL_IDS } from '../dock/dockModel';

/** The ids of the panels in a window of their own, in the Panels menu's order. */
export function awayPanels(workspace: Workspace): string[] {
	return PANEL_IDS.filter((id) => workspace.panels[id]?.place === 'window');
}

/**
 * `workspace` with each panel away in a window added as the last tab of the last group of its home
 * zone (a group of its own when the zone has none), whether it came from a dock or from floating:
 * a torn-off panel never leaves a floating panel over the level, and a floating panel's remembered
 * rectangle stays in the saved workspace for when it comes back. An away panel named in `shown` is
 * the showing tab of its group, since the saved workspace cannot say which tab an away panel had.
 */
export function withAwayTabs(workspace: Workspace, shown: readonly string[] = []): Workspace {
	const away = awayPanels(workspace);
	if (away.length === 0) return workspace;
	const next = structuredClone(workspace);
	for (const id of away) {
		const zone = next.zones[workspace.panels[id]!.home];
		const group = zone.groups[zone.groups.length - 1];
		if (group) {
			group.tabs.push(id);
			if (shown.includes(id)) group.active = id;
		} else zone.groups.push({ tabs: [id], active: id });
	}
	return next;
}
