// The dock layout's types, limits and defaults: where each panel lives in a workspace
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Every panel is in exactly one state: docked in a zone (left, right or bottom), floating over the
// level, or in its own window. A zone holds tab groups of docked panels and has a size, a
// collapsed flag (a collapsed zone folds to a rail) and caps. A workspace is one named
// arrangement of all of that. The shapes below mirror the settings crate's wire types (their
// names and snake_case fields), and the defaults are read from the fixture the settings crate's
// tests also check, so the two cannot drift apart.

import type { PanelPlacement } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlacement';
import defaults from '@liminal-hq/fizz-studio-protocol/fixtures/default-dock';
import type { PanelId } from '../float/panelSpecs';

export type ZoneId = 'left' | 'right' | 'bottom';
export type PlaceKind = 'docked' | 'floating' | 'window';

/** Panels sharing one slot of a zone as tabs, one of them showing. */
export interface TabGroup {
	tabs: string[];
	active: string;
}

export interface Zone {
	/** Width for the left and right zones, height for the bottom zone, in pixels. */
	size: number;
	/** Folded to a rail showing each panel's icon and title. */
	collapsed: boolean;
	groups: TabGroup[];
}

/** Where a torn-off window sits on the screen, in pixels. */
export interface WindowPlacement {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PanelEntry {
	place: PlaceKind;
	/** The zone the panel was last docked in: where it goes when it docks back. */
	home: ZoneId;
	/** Where it floats, kept while it is docked so it floats again where it was. */
	float: PanelPlacement;
	/** Where its own window sits, kept after it comes back. */
	window: WindowPlacement | null;
	/** What it was before it went to its own window: where it returns to. */
	window_from: PlaceKind;
}

/** One named arrangement of every panel. */
export interface Workspace {
	panels: { [id: string]: PanelEntry };
	zones: Record<ZoneId, Zone>;
}

export interface DockSettings {
	active: string;
	workspaces: { [name: string]: Workspace };
}

/** The panel ids in the order the Panels menu lists them. */
export const PANEL_IDS: readonly PanelId[] = [
	'palette',
	'objects',
	'history',
	'proposals',
	'script',
];

export const ZONE_IDS: readonly ZoneId[] = ['left', 'right', 'bottom'];

interface Fixture {
	limits: {
		side_min: number;
		bottom_min: number;
		cap_percent: number;
		rail: number;
		tool_column: number;
		top_chrome: number;
	};
	active: string;
	default: Workspace;
	workspaces: { [name: string]: Workspace };
}

const fixture = defaults as unknown as Fixture;

/** The smallest a left or right zone is, and the smallest the bottom zone is, in pixels. */
export const SIDE_MIN = fixture.limits.side_min;
export const BOTTOM_MIN = fixture.limits.bottom_min;

/** A zone never exceeds this share of the window dimension in its direction (percent). */
export const CAP_PERCENT = fixture.limits.cap_percent;

/** The thickness of a collapsed zone's rail. */
export const RAIL_SIZE = fixture.limits.rail;

/** The tool column left of everything, and the title bar, menu row and tool bar above. */
export const TOOL_COLUMN = fixture.limits.tool_column;
export const TOP_CHROME = fixture.limits.top_chrome;

/** The largest value any stored size or coordinate may take; the same bound as the settings crate. */
export const MAX_EXTENT = 20_000;

/** The absolute largest zone, whatever the window: a window cannot be larger than this. */
export const ZONE_MAX = 4_000;

export function zoneMin(zone: ZoneId): number {
	return zone === 'bottom' ? BOTTOM_MIN : SIDE_MIN;
}

/** The fixed default arrangement (Palette left; Objects and History right; Script and Proposals below). */
export function defaultWorkspace(): Workspace {
	return structuredClone(fixture.default);
}

/** The shipped arrangement of a workspace named `name`, or the fixed default for any other name. */
export function defaultWorkspaceFor(name: string): Workspace {
	const shipped = fixture.workspaces[name];
	return structuredClone(shipped ?? fixture.default);
}

/** The workspaces a new settings document starts with, and the one that is active. */
export function defaultDock(): DockSettings {
	return { active: fixture.active, workspaces: structuredClone(fixture.workspaces) };
}

/** The zone a docked panel is in, or null when it is floating or in its own window. */
export function zoneOf(workspace: Workspace, id: string): ZoneId | null {
	for (const zone of ZONE_IDS) {
		if (workspace.zones[zone].groups.some((g) => g.tabs.includes(id))) return zone;
	}
	return null;
}

/** The panels docked in a zone, in tab order across its groups. */
export function dockedIn(workspace: Workspace, zone: ZoneId): string[] {
	return workspace.zones[zone].groups.flatMap((g) => g.tabs);
}
