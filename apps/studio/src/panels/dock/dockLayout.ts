// The dock's reducers: pure moves from one layout to the next, never changing their input
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Each function takes a workspace (or a session for the moves that are not saved) and returns the
// new one; a move that cannot apply returns its input unchanged. A panel is always in exactly one
// place: moving it takes it out of the old one first, so none is lost or doubled.

import type { PanelPlacement } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlacement';
import type { Size } from '../float/panelGeometry';
import { clampZoneSize } from './dockGeometry';
import {
	ZONE_IDS,
	zoneOf,
	type PanelEntry,
	type Workspace,
	type WindowPlacement,
	type ZoneId,
} from './dockModel';

/** The moves that are about the session, not the arrangement: none of them is saved. */
export interface DockSession {
	/** The panel shown full screen over the workspace, if any. */
	maximised: string | null;
	/** The rail item shown over the level, if any. */
	peeking: string | null;
	/** Every docked and floating panel hidden so the level has the room. */
	levelFirst: boolean;
}

export const INITIAL_SESSION: DockSession = { maximised: null, peeking: null, levelFirst: false };

export interface DockPlacement {
	/** Give the panel a tab group of its own instead of joining one. */
	alone?: boolean;
	/** The group to join, or the position for a new group. */
	group?: number;
	/** The position among the group's tabs. */
	index?: number;
}

function entryOf(workspace: Workspace, id: string): PanelEntry | null {
	return workspace.panels[id] ?? null;
}

/** `workspace` with the panel taken out of every tab group; an emptied group goes. */
function detach(workspace: Workspace, id: string): Workspace {
	const next = structuredClone(workspace);
	for (const zone of ZONE_IDS) {
		const groups = next.zones[zone].groups;
		for (const group of groups) {
			const at = group.tabs.indexOf(id);
			if (at < 0) continue;
			group.tabs.splice(at, 1);
			if (group.active === id) group.active = group.tabs[Math.min(at, group.tabs.length - 1)] ?? '';
		}
		next.zones[zone].groups = groups.filter((g) => g.tabs.length > 0);
	}
	return next;
}

function topZ(workspace: Workspace): number {
	return Math.max(0, ...Object.values(workspace.panels).map((e) => e.float.z));
}

/**
 * Docks a panel in a zone, from wherever it is: as a tab of a group already there, or alone in
 * a group of its own. A collapsed zone opens so that the panel shows, and the panel becomes the
 * active tab. Docking a docked panel into another zone moves it.
 */
export function dockPanel(
	workspace: Workspace,
	id: string,
	zone: ZoneId,
	placement: DockPlacement = {},
): Workspace {
	if (!entryOf(workspace, id)) return workspace;
	const next = detach(workspace, id);
	const target = next.zones[zone];
	const alone = placement.alone === true || target.groups.length === 0;
	if (alone) {
		const at = clamp(placement.group ?? target.groups.length, 0, target.groups.length);
		target.groups.splice(at, 0, { tabs: [id], active: id });
	} else {
		const group = target.groups[clamp(placement.group ?? 0, 0, target.groups.length - 1)]!;
		group.tabs.splice(clamp(placement.index ?? group.tabs.length, 0, group.tabs.length), 0, id);
		group.active = id;
	}
	target.collapsed = false;
	const entry = next.panels[id]!;
	entry.place = 'docked';
	entry.home = zone;
	return next;
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(n, hi));
}

/** Makes a docked panel the showing tab of its group. */
export function activateTab(workspace: Workspace, id: string): Workspace {
	const zone = zoneOf(workspace, id);
	if (!zone) return workspace;
	const next = structuredClone(workspace);
	for (const group of next.zones[zone].groups) {
		if (group.tabs.includes(id)) group.active = id;
	}
	return next;
}

/** Moves a docked panel to a position among its group's tabs. */
export function reorderTab(workspace: Workspace, id: string, index: number): Workspace {
	const zone = zoneOf(workspace, id);
	if (!zone) return workspace;
	const next = structuredClone(workspace);
	for (const group of next.zones[zone].groups) {
		const from = group.tabs.indexOf(id);
		if (from < 0) continue;
		group.tabs.splice(from, 1);
		group.tabs.splice(clamp(Math.round(index), 0, group.tabs.length), 0, id);
	}
	return next;
}

/**
 * Floats a panel over the level, at `rect` when given (else where it last floated). Floating a
 * docked panel remembers its zone as the one it docks back to.
 */
export function floatPanel(
	workspace: Workspace,
	id: string,
	rect: Partial<PanelPlacement> = {},
): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry) return workspace;
	const from = zoneOf(workspace, id);
	const next = detach(workspace, id);
	const target = next.panels[id]!;
	if (from) target.home = from;
	target.place = 'floating';
	target.float = { ...target.float, ...rect, visible: true, z: topZ(next) + 1 };
	return next;
}

/** Docks a floating panel, or one in its own window, back in the zone it last had. */
export function dockBack(workspace: Workspace, id: string): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry || entry.place === 'docked') return workspace;
	return dockPanel(workspace, id, entry.home);
}

/** Sends a panel to a window of its own, at `at` when given (else where its window last was). */
export function sendToWindow(workspace: Workspace, id: string, at?: WindowPlacement): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry) return workspace;
	if (entry.place === 'window') {
		if (!at) return workspace;
		const next = structuredClone(workspace);
		next.panels[id]!.window = { ...at };
		return next;
	}
	const from = zoneOf(workspace, id);
	const next = detach(workspace, id);
	const target = next.panels[id]!;
	if (from) target.home = from;
	target.window_from = entry.place;
	target.window = at
		? { ...at }
		: (target.window ?? {
				x: target.float.x,
				y: target.float.y,
				w: target.float.w,
				h: target.float.h,
			});
	target.place = 'window';
	return next;
}

/** Brings a panel in its own window back to where it was before: its zone, or floating. */
export function bringBack(workspace: Workspace, id: string): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry || entry.place !== 'window') return workspace;
	if (entry.window_from === 'floating') return floatPanel(workspace, id);
	return dockPanel(workspace, id, entry.home);
}

export function setZoneCollapsed(
	workspace: Workspace,
	zone: ZoneId,
	collapsed: boolean,
): Workspace {
	if (workspace.zones[zone].collapsed === collapsed) return workspace;
	const next = structuredClone(workspace);
	next.zones[zone].collapsed = collapsed;
	return next;
}

export function toggleZone(workspace: Workspace, zone: ZoneId): Workspace {
	return setZoneCollapsed(workspace, zone, !workspace.zones[zone].collapsed);
}

/** Sets a zone's size, held to its minimum and its cap for a window of `window`. */
export function resizeZone(
	workspace: Workspace,
	zone: ZoneId,
	size: number,
	window: Size,
): Workspace {
	const clamped = clampZoneSize(zone, size, window);
	if (workspace.zones[zone].size === clamped) return workspace;
	const next = structuredClone(workspace);
	next.zones[zone].size = clamped;
	return next;
}

/** Shows a docked panel, from a collapsed zone's rail, over the level. */
export function peekPanel(session: DockSession, workspace: Workspace, id: string): DockSession {
	const zone = zoneOf(workspace, id);
	if (!zone || !workspace.zones[zone].collapsed || session.levelFirst) return session;
	return { ...session, peeking: id };
}

export function closePeek(session: DockSession): DockSession {
	return session.peeking === null ? session : { ...session, peeking: null };
}

/** Makes a peeking panel a real dock again: its zone opens and the panel is the showing tab. */
export function pinPanel(
	workspace: Workspace,
	session: DockSession,
	id: string,
): { workspace: Workspace; session: DockSession } {
	const zone = zoneOf(workspace, id);
	if (!zone) return { workspace, session };
	const opened = setZoneCollapsed(activateTab(workspace, id), zone, false);
	return { workspace: opened, session: closePeek(session) };
}

/** Makes one panel fill the workspace. A panel in its own window has no place to fill. */
export function maximisePanel(session: DockSession, workspace: Workspace, id: string): DockSession {
	const entry = entryOf(workspace, id);
	if (!entry || entry.place === 'window') return session;
	return { ...session, maximised: id, peeking: null };
}

export function restorePanel(session: DockSession): DockSession {
	return session.maximised === null ? session : { ...session, maximised: null };
}

/** Hides every docked and floating panel, or brings the same set back; nothing is rearranged. */
export function toggleLevelFirst(session: DockSession): DockSession {
	return { ...session, levelFirst: !session.levelFirst, peeking: null };
}

/** The session with anything that no longer fits the layout let go (a panel moved, say). */
export function settleSession(session: DockSession, workspace: Workspace): DockSession {
	let next = session;
	const maximised = next.maximised === null ? null : workspace.panels[next.maximised];
	if (next.maximised !== null && (!maximised || maximised.place === 'window')) {
		next = restorePanel(next);
	}
	if (next.peeking !== null) {
		const zone = zoneOf(workspace, next.peeking);
		if (!zone || !workspace.zones[zone].collapsed) next = closePeek(next);
	}
	return next;
}
