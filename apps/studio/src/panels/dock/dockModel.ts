// The dock layout's types, limits and defaults: where each panel lives in a workspace
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Every panel is in exactly one state: docked in a zone (left, right or bottom), floating over the
// level, or in its own window. A zone holds tab groups of docked panels and has a size, a
// collapsed flag (a collapsed zone folds to a rail) and caps. A workspace is one named
// arrangement of all of that. The types are the ones `ts-rs` generates from the protocol crate
// (`packages/protocol/src/generated/`: `Workspace`, `Zone`, `PanelEntry`, `DockSettings` and so
// on), and the defaults are read from the fixture the settings crate's tests also check, so the
// two cannot drift apart.

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import defaults from '@liminal-hq/fizz-studio-protocol/fixtures/default-dock';
import type { PanelId } from '../float/panelSpecs';

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
