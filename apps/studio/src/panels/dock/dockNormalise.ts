// Checking and repairing a saved dock layout, so a bad file can never lose a panel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// `validateWorkspace` lists what is wrong with a well-typed layout. `normaliseWorkspace` takes
// anything (a hand-edited file, an older build's) and returns a layout with no problems: every
// panel exactly once, unknown panels gone, no empty tab group, an active tab that exists and sizes
// within the caps. It keeps every value that is usable and takes the default for the rest.

import type { PanelPlacement } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlacement';
import type { Size } from '../float/panelGeometry';
import { clampZoneSize, clampZoneSizeAbsolute } from './dockGeometry';
import {
	MAX_EXTENT,
	PANEL_IDS,
	ZONE_IDS,
	ZONE_MAX,
	defaultDock,
	defaultWorkspace,
	defaultWorkspaceFor,
	zoneMin,
	type DockSettings,
	type PanelEntry,
	type PlaceKind,
	type WindowPlacement,
	type Workspace,
	type ZoneId,
} from './dockModel';

export type DockProblemKind =
	| 'unknown-panel'
	| 'missing-panel'
	| 'duplicate-panel'
	| 'wrong-place'
	| 'empty-group'
	| 'bad-active'
	| 'size-range'
	| 'bad-rect';

export interface DockProblem {
	kind: DockProblemKind;
	panel?: string;
	zone?: ZoneId;
}

function validRect(rect: PanelPlacement): boolean {
	const ok = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;
	return (
		ok(rect.x, 0, MAX_EXTENT) &&
		ok(rect.y, 0, MAX_EXTENT) &&
		ok(rect.w, 1, MAX_EXTENT) &&
		ok(rect.h, 1, MAX_EXTENT)
	);
}

function validWindow(rect: WindowPlacement): boolean {
	const ok = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;
	return (
		ok(rect.x, -MAX_EXTENT, MAX_EXTENT) &&
		ok(rect.y, -MAX_EXTENT, MAX_EXTENT) &&
		ok(rect.w, 1, MAX_EXTENT) &&
		ok(rect.h, 1, MAX_EXTENT)
	);
}

/**
 * What is wrong with a layout, in a stable order; empty when it is sound. With a window size the
 * zone sizes are checked against that window's caps, else against the absolute range.
 */
export function validateWorkspace(workspace: Workspace, window?: Size): DockProblem[] {
	const problems: DockProblem[] = [];
	const known = new Set<string>(PANEL_IDS);
	for (const id of Object.keys(workspace.panels)) {
		if (!known.has(id)) problems.push({ kind: 'unknown-panel', panel: id });
	}
	for (const id of PANEL_IDS) {
		const entry = workspace.panels[id];
		if (!entry) {
			problems.push({ kind: 'missing-panel', panel: id });
			continue;
		}
		if (!validRect(entry.float) || (entry.window && !validWindow(entry.window))) {
			problems.push({ kind: 'bad-rect', panel: id });
		}
		if (entry.place === 'window' && !entry.window) problems.push({ kind: 'bad-rect', panel: id });
	}
	const seen = new Map<string, number>();
	for (const zone of ZONE_IDS) {
		const z = workspace.zones[zone];
		const size = window ? clampZoneSize(zone, z.size, window) : clampZoneSizeAbsolute(zone, z.size);
		if (size !== z.size) problems.push({ kind: 'size-range', zone });
		for (const group of z.groups) {
			if (group.tabs.length === 0) problems.push({ kind: 'empty-group', zone });
			else if (!group.tabs.includes(group.active)) problems.push({ kind: 'bad-active', zone });
			for (const id of group.tabs) {
				seen.set(id, (seen.get(id) ?? 0) + 1);
				if (known.has(id) && workspace.panels[id]?.place !== 'docked') {
					problems.push({ kind: 'wrong-place', panel: id, zone });
				}
				if (!known.has(id)) problems.push({ kind: 'unknown-panel', panel: id, zone });
			}
		}
	}
	for (const id of PANEL_IDS) {
		const count = seen.get(id) ?? 0;
		if (count > 1) problems.push({ kind: 'duplicate-panel', panel: id });
		if (count === 0 && workspace.panels[id]?.place === 'docked') {
			problems.push({ kind: 'wrong-place', panel: id });
		}
	}
	return problems;
}

type Plain = Record<string, unknown>;

function isPlain(value: unknown): value is Plain {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function int(value: unknown, fallback: number, lo: number, hi: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return Math.max(lo, Math.min(Math.round(value), hi));
}

function placeKind(value: unknown, fallback: PlaceKind): PlaceKind {
	return value === 'docked' || value === 'floating' || value === 'window' ? value : fallback;
}

function zoneId(value: unknown, fallback: ZoneId): ZoneId {
	return value === 'left' || value === 'right' || value === 'bottom' ? value : fallback;
}

function normaliseFloat(value: unknown, fallback: PanelPlacement): PanelPlacement {
	const v = isPlain(value) ? value : {};
	return {
		x: int(v.x, fallback.x, 0, MAX_EXTENT),
		y: int(v.y, fallback.y, 0, MAX_EXTENT),
		w: int(v.w, fallback.w, 1, MAX_EXTENT),
		h: int(v.h, fallback.h, 1, MAX_EXTENT),
		collapsed: typeof v.collapsed === 'boolean' ? v.collapsed : fallback.collapsed,
		visible: typeof v.visible === 'boolean' ? v.visible : fallback.visible,
		z: int(v.z, fallback.z, 0, 4_000_000_000),
	};
}

function normaliseWindow(value: unknown): WindowPlacement | null {
	if (!isPlain(value)) return null;
	if (![value.x, value.y, value.w, value.h].every((n) => typeof n === 'number')) return null;
	return {
		x: int(value.x, 0, -MAX_EXTENT, MAX_EXTENT),
		y: int(value.y, 0, -MAX_EXTENT, MAX_EXTENT),
		w: int(value.w, 1, 1, MAX_EXTENT),
		h: int(value.h, 1, 1, MAX_EXTENT),
	};
}

function normaliseEntry(value: unknown, fallback: PanelEntry): PanelEntry {
	const v = isPlain(value) ? value : {};
	const float = normaliseFloat(v.float, fallback.float);
	let window = normaliseWindow(v.window);
	let place = placeKind(v.place, fallback.place);
	// A panel marked as in its own window with no window to show it in floats instead.
	if (place === 'window' && !window) window = { x: float.x, y: float.y, w: float.w, h: float.h };
	const from = placeKind(v.window_from, 'docked');
	return {
		place,
		home: zoneId(v.home, fallback.home),
		float,
		window,
		window_from: from === 'floating' ? 'floating' : 'docked',
	};
}

/**
 * Repairs anything that claims to be a workspace into one with no problems. The layout of a panel
 * the input leaves out is that panel's default, docked where the default docks it.
 */
export function normaliseWorkspace(input: unknown, window?: Size): Workspace {
	const raw = isPlain(input) ? input : {};
	const rawPanels = isPlain(raw.panels) ? raw.panels : {};
	const rawZones = isPlain(raw.zones) ? raw.zones : {};
	const defaults = defaultWorkspace();

	const panels: Workspace['panels'] = {};
	for (const id of PANEL_IDS) panels[id] = normaliseEntry(rawPanels[id], defaults.panels[id]!);

	const zones = {} as Workspace['zones'];
	const placed = new Set<string>();
	for (const zone of ZONE_IDS) {
		const z = isPlain(rawZones[zone]) ? (rawZones[zone] as Plain) : {};
		const groups: Workspace['zones'][ZoneId]['groups'] = [];
		for (const g of Array.isArray(z.groups) ? z.groups : []) {
			if (!isPlain(g) || !Array.isArray(g.tabs)) continue;
			const tabs: string[] = [];
			for (const id of g.tabs) {
				if (typeof id !== 'string' || placed.has(id) || panels[id]?.place !== 'docked') continue;
				placed.add(id);
				tabs.push(id);
			}
			if (tabs.length === 0) continue;
			const active = typeof g.active === 'string' && tabs.includes(g.active) ? g.active : tabs[0]!;
			groups.push({ tabs, active });
		}
		const fallbackSize = defaults.zones[zone].size;
		const size = int(z.size, fallbackSize, zoneMin(zone), ZONE_MAX);
		zones[zone] = {
			size: window ? clampZoneSize(zone, size, window) : clampZoneSizeAbsolute(zone, size),
			collapsed: typeof z.collapsed === 'boolean' ? z.collapsed : defaults.zones[zone].collapsed,
			groups,
		};
	}
	// A panel that says it is docked but is in no group joins its home zone: it is never dropped.
	// They go in the default's tab order, so an empty zone is rebuilt as the default has it.
	const order = ZONE_IDS.flatMap((zone) => defaults.zones[zone].groups.flatMap((g) => g.tabs));
	for (const id of order) {
		const entry = panels[id]!;
		if (entry.place !== 'docked' || placed.has(id)) continue;
		const target = zones[entry.home];
		const group = target.groups[0];
		if (group) group.tabs.push(id);
		else target.groups.push({ tabs: [id], active: id });
		placed.add(id);
	}
	return { panels, zones };
}

/**
 * Repairs a saved dock: each workspace is normalised, a workspace with an empty name is dropped,
 * and a dock left with none, or whose active name is not among them, takes the defaults for
 * what is missing (the first workspace becomes active when the named one is gone).
 */
export function normaliseDock(input: unknown, window?: Size): DockSettings {
	const raw = isPlain(input) ? input : {};
	const rawSpaces = isPlain(raw.workspaces) ? raw.workspaces : {};
	const workspaces: DockSettings['workspaces'] = {};
	for (const [name, value] of Object.entries(rawSpaces)) {
		if (name.trim() === '' || name === '__proto__') continue;
		workspaces[name] = normaliseWorkspace(value, window);
	}
	const names = Object.keys(workspaces);
	if (names.length === 0) {
		const fresh = defaultDock();
		for (const [name, value] of Object.entries(fresh.workspaces)) {
			workspaces[name] = normaliseWorkspace(value, window);
		}
		return { active: fresh.active, workspaces };
	}
	const active =
		typeof raw.active === 'string' && Object.hasOwn(workspaces, raw.active)
			? raw.active
			: names[0]!;
	return { active, workspaces };
}

/** Returns a workspace to its shipped arrangement (the fixed default for a name that has none). */
export function resetWorkspace(dock: DockSettings, window?: Size): DockSettings {
	const fresh = normaliseWorkspace(defaultWorkspaceFor(dock.active), window);
	return { ...dock, workspaces: { ...dock.workspaces, [dock.active]: fresh } };
}

/** Makes another workspace the active one; an unknown name changes nothing. */
export function switchWorkspace(dock: DockSettings, name: string): DockSettings {
	return Object.hasOwn(dock.workspaces, name) && name !== dock.active
		? { ...dock, active: name }
		: dock;
}

/** Saves a copy of the active workspace under a new name and switches to it. */
export function createWorkspace(dock: DockSettings, name: string): DockSettings {
	const trimmed = name.trim();
	const current = dock.workspaces[dock.active];
	if (
		trimmed === '' ||
		trimmed === '__proto__' ||
		Object.hasOwn(dock.workspaces, trimmed) ||
		!current
	)
		return dock;
	return {
		active: trimmed,
		workspaces: { ...dock.workspaces, [trimmed]: structuredClone(current) },
	};
}
