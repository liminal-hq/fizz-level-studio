// A panel's remembered home: the place it left in its zone, and putting it back there
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// When a panel leaves a zone (floated, torn off, dragged out) the zone alone is not enough to dock
// it back where it sat. `rememberHome` records the group it was in, the tab it followed and the tab
// that followed it (ids, so the place survives the others being reordered, moved or removed while it
// is away), whether it was the showing tab, whether the zone was folded and the zone's size when it
// was the only panel. `slotIn` puts a panel back, falling back step by step and never failing: the
// group of a neighbour, else the group at the remembered index, else a group of its own.

import type { HomeSpot } from '@liminal-hq/fizz-studio-protocol/generated/HomeSpot';
import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { Zone } from '@liminal-hq/fizz-studio-protocol/generated/Zone';
import { clampZoneSizeAbsolute } from './dockGeometry';
import { dockedIn, zoneOf } from './dockModel';

/** The place a docked panel holds now, or null when it is not docked. */
export function rememberHome(workspace: Workspace, id: string): HomeSpot | null {
	const zone = zoneOf(workspace, id);
	if (!zone) return null;
	const z = workspace.zones[zone];
	const group = z.groups.findIndex((g) => g.tabs.includes(id));
	const g = z.groups[group]!;
	const at = g.tabs.indexOf(id);
	return {
		zone,
		group,
		after: g.tabs[at - 1] ?? null,
		before: g.tabs[at + 1] ?? null,
		active: g.active === id,
		folded: z.collapsed,
		size: dockedIn(workspace, zone).length === 1 ? z.size : null,
	};
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(n, hi));
}

/**
 * Puts `id` into `zone` (changing it in place) as `spot` says, and returns whether the zone had no
 * panels (so it was rebuilt). With no spot the panel joins the zone's last group, or has a group of
 * its own when the zone is empty. `show` makes the panel the showing tab of a group it joins; a group
 * of its own always shows it.
 */
export function slotIn(zone: Zone, id: string, spot: HomeSpot | null, show: boolean): boolean {
	if (zone.groups.length === 0) {
		zone.groups.push({ tabs: [id], active: id });
		return true;
	}
	if (!spot) {
		const group = zone.groups[zone.groups.length - 1]!;
		group.tabs.push(id);
		if (show) group.active = id;
		return false;
	}
	const findGroup = (neighbour: string | null) =>
		neighbour === null ? -1 : zone.groups.findIndex((g) => g.tabs.includes(neighbour));
	const afterGroup = findGroup(spot.after);
	const beforeGroup = afterGroup >= 0 ? -1 : findGroup(spot.before);
	let target = afterGroup >= 0 ? afterGroup : beforeGroup;
	let index: number;
	if (afterGroup >= 0) {
		index = zone.groups[afterGroup]!.tabs.indexOf(spot.after!) + 1;
	} else if (beforeGroup >= 0) {
		index = zone.groups[beforeGroup]!.tabs.indexOf(spot.before!);
	} else if (spot.after === null && spot.before === null) {
		// It had a group to itself: it gets one again, at the place it had among the groups.
		zone.groups.splice(clamp(spot.group, 0, zone.groups.length), 0, { tabs: [id], active: id });
		return false;
	} else {
		// Its neighbours have left this zone: the group at its old index, at the end it was at.
		target = clamp(spot.group, 0, zone.groups.length - 1);
		index = spot.after === null ? 0 : zone.groups[target]!.tabs.length;
	}
	const group = zone.groups[target]!;
	group.tabs.splice(clamp(index, 0, group.tabs.length), 0, id);
	if (show) group.active = id;
	return false;
}

/**
 * `detached` (the workspace with the panel out of every group) with the panel docked back where it
 * left, in its entry's `home` zone, and its record of the place cleared since it has been used. A
 * zone with nothing in it is recreated at the size it had and as folded as it was; a zone that has
 * panels keeps its fold, since the person set it that way after the panel left. An entry with no
 * record (a file from before it was kept) docks at the end of the zone's last group, showing, with
 * its zone open.
 */
export function dockAtHome(detached: Workspace, id: string): Workspace {
	const next = structuredClone(detached);
	const entry = next.panels[id]!;
	const zoneId = entry.home;
	const zone = next.zones[zoneId];
	const spot = entry.home_spot && entry.home_spot.zone === zoneId ? entry.home_spot : null;
	const rebuilt = slotIn(zone, id, spot, spot === null || spot.active);
	if (!spot) zone.collapsed = false;
	else if (rebuilt) {
		zone.collapsed = spot.folded;
		if (spot.size !== null) zone.size = clampZoneSizeAbsolute(zoneId, spot.size);
	}
	entry.place = 'docked';
	entry.home_spot = null;
	return next;
}
