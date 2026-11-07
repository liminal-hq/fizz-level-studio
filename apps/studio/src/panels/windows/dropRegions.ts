// The main window's drop regions for a panel dragged back: what is registered and what each means
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The tear-off plugin answers "which region is under the cursor" across windows, so a panel window
// can learn where a release over the main window would dock it without seeing the main window's
// page. The main window registers a region for each place a panel can land (a dock, each tab group
// in it, its rail, each entry on the rail, and the level), named so the answer says the place:
//
//   zone:<zone>                  the dock, wherever in it
//   group:<zone>:<n>             the tab group n of the dock (its header, tab strip and body)
//   rail:<zone>                  the dock's rail, past its entries
//   rail:<zone>:<n>:<i>          the rail entry i of group n: the panel lands before it
//   level                        the level: the panel goes back to where it was
//
// Where regions overlap the plugin takes the smallest, so an entry wins over its rail, a group over
// its dock and a dock over the level.

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { Region } from '../../services/tearoffClient';
import type { Point } from '../dock/dockDrop';
import { ZONE_IDS } from '../dock/dockModel';

/** What a release over a region does. */
export type RegionTarget =
	| { kind: 'zone'; zone: ZoneId; group: number | null; index: number | null }
	| { kind: 'level' };

function regionOf(id: string, rect: DOMRect): Region | null {
	if (rect.width < 1 || rect.height < 1) return null;
	return { id, x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/** The regions for the docks, the rails and the level inside `root`, in window coordinates. */
export function collectDropRegions(root: HTMLElement): Region[] {
	const found: (Region | null)[] = [];
	for (const zone of ZONE_IDS) {
		const slot = root.querySelector<HTMLElement>(`[data-drop-zone="${zone}"]`);
		if (slot) found.push(regionOf(`zone:${zone}`, slot.getBoundingClientRect()));
		root.querySelectorAll<HTMLElement>(`[data-group-zone="${zone}"]`).forEach((group, n) => {
			found.push(regionOf(`group:${zone}:${n}`, group.getBoundingClientRect()));
		});
		const rail = root.querySelector<HTMLElement>(`[data-rail="${zone}"]`);
		if (rail) {
			found.push(regionOf(`rail:${zone}`, rail.getBoundingClientRect()));
			const seen = new Map<number, number>();
			rail.querySelectorAll<HTMLElement>('[data-rail-item]').forEach((entry) => {
				const group = Number(entry.dataset.railGroup ?? 0);
				const index = seen.get(group) ?? 0;
				seen.set(group, index + 1);
				found.push(regionOf(`rail:${zone}:${group}:${index}`, entry.getBoundingClientRect()));
			});
		}
	}
	const level = root.querySelector<HTMLElement>('[data-level]');
	if (level) found.push(regionOf('level', level.getBoundingClientRect()));
	return found.filter((region): region is Region => region !== null);
}

const isZone = (value: string | undefined): value is ZoneId =>
	value !== undefined && (ZONE_IDS as readonly string[]).includes(value);

const count = (value: string | undefined): number | null =>
	value !== undefined && /^\d+$/.test(value) ? Number(value) : null;

/** What a region id means, or null for an id that is not one of these (another window's word is not trusted). */
export function parseRegion(id: string | null | undefined): RegionTarget | null {
	if (!id) return null;
	if (id === 'level') return { kind: 'level' };
	const [kind, zone, group, index] = id.split(':');
	if (!isZone(zone)) return null;
	switch (kind) {
		case 'zone':
		case 'rail':
			if (group === undefined && index === undefined) {
				return { kind: 'zone', zone, group: null, index: null };
			}
			if (kind === 'zone') return null;
			if (count(group) === null || count(index) === null) return null;
			return { kind: 'zone', zone, group: count(group), index: count(index) };
		case 'group':
			return count(group) === null || index !== undefined
				? null
				: { kind: 'zone', zone, group: count(group), index: null };
		default:
			return null;
	}
}

/** The middle of a registered region, a point the dock's own hit test reads the way it reads the pointer. */
export function regionCentre(regions: readonly Region[], id: string): Point | null {
	const region = regions.find((candidate) => candidate.id === id);
	return region ? { x: region.x + region.width / 2, y: region.y + region.height / 2 } : null;
}
