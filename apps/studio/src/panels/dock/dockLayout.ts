// The dock's reducers: pure moves from one layout to the next, never changing their input
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Each function takes a workspace (or a session for the moves that are not saved) and returns the
// new one; a move that cannot apply returns its input unchanged. A panel is always in exactly one
// place: moving it takes it out of the old one first, so none is lost or doubled.

import type { PanelEntry } from '@liminal-hq/fizz-studio-protocol/generated/PanelEntry';
import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { WindowPlacement } from '@liminal-hq/fizz-studio-protocol/generated/WindowPlacement';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { PanelPlacement } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlacement';
import type { Size } from '../float/panelGeometry';
import { clampZoneSize } from './dockGeometry';
import { dockAtHome, rememberHome } from './dockHome';
import { ZONE_IDS, zoneOf } from './dockModel';

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
	// An explicit place replaces whatever was remembered about the last one.
	entry.home_spot = null;
	return next;
}

/**
 * Docks a panel in a zone the person chose from its menu. A panel that is away (floating or in a
 * window) and that chooses the zone it left goes back to its place there; any other choice is
 * explicit and uses `dockPanel`'s default place.
 */
export function dockToZone(workspace: Workspace, id: string, zone: ZoneId): Workspace {
	const entry = entryOf(workspace, id);
	if (entry && entry.place !== 'docked' && entry.home === zone && entry.home_spot?.zone === zone) {
		return dockAtHome(detach(workspace, id), id);
	}
	return dockPanel(workspace, id, zone);
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(n, hi));
}

/**
 * Shows or hides a panel without moving it: a hidden docked panel keeps its tab and a hidden
 * floating one its rectangle. The flag is the panel's `float.visible`, which is kept whatever the
 * panel's place. Showing a docked panel makes it the showing tab of its group and opens its zone;
 * showing a floating one brings it to the front.
 */
export function setPanelVisible(workspace: Workspace, id: string, visible: boolean): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry) return workspace;
	const zone = zoneOf(workspace, id);
	if (entry.float.visible === visible && !(visible && zone)) return workspace;
	let next = structuredClone(workspace);
	next.panels[id]!.float.visible = visible;
	if (visible && zone) next = setZoneCollapsed(activateTab(next, id), zone, false);
	if (visible && entry.place === 'floating') next.panels[id]!.float.z = topZ(next) + 1;
	return next;
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
	const spot = rememberHome(workspace, id);
	const next = detach(workspace, id);
	const target = next.panels[id]!;
	if (from) {
		target.home = from;
		target.home_spot = spot;
	}
	target.place = 'floating';
	target.float = { ...target.float, ...rect, visible: true, z: topZ(next) + 1 };
	return next;
}

/**
 * Docks a floating panel, or one in its own window, back exactly where it left: its zone, its tab
 * group, its place among the group's tabs, whether it was the showing tab (`dockHome.ts`).
 */
export function dockBack(workspace: Workspace, id: string): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry || entry.place === 'docked') return workspace;
	return dockAtHome(detach(workspace, id), id);
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
	const spot = rememberHome(workspace, id);
	const next = detach(workspace, id);
	const target = next.panels[id]!;
	if (from) {
		target.home = from;
		target.home_spot = spot;
	}
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

/**
 * Records where a panel's own window is, whatever the panel's place: a window that moves while it
 * closes reports after the panel has come back, and the record is kept for the next time it is torn
 * off. The place itself is not touched.
 */
export function placeWindow(workspace: Workspace, id: string, at: WindowPlacement): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry) return workspace;
	const was = entry.window;
	if (was && was.x === at.x && was.y === at.y && was.w === at.w && was.h === at.h) {
		return workspace;
	}
	const next = structuredClone(workspace);
	next.panels[id]!.window = { ...at };
	return next;
}

/** Brings a panel in its own window back to where it was before: exactly where it left its zone, or floating. */
export function bringBack(workspace: Workspace, id: string): Workspace {
	const entry = entryOf(workspace, id);
	if (!entry || entry.place !== 'window') return workspace;
	if (entry.window_from === 'floating') return floatPanel(workspace, id);
	return dockAtHome(detach(workspace, id), id);
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

/**
 * Maximises a panel wherever it is shown or reachable. A docked panel is made the showing tab and
 * its zone is unfolded first, so a panel in a folded dock (or peeking from its rail) can fill the
 * workspace; the dock is left open when it is restored. A panel in a window, an unknown one and a
 * hidden floating one are refused, and the input is returned unchanged.
 */
export function maximiseDocked(
	workspace: Workspace,
	session: DockSession,
	id: string,
): { workspace: Workspace; session: DockSession } {
	const entry = entryOf(workspace, id);
	if (!entry || entry.place === 'window') return { workspace, session };
	if (entry.place === 'floating' && !entry.float.visible) return { workspace, session };
	const zone = zoneOf(workspace, id);
	// Nothing is rewritten when the panel already shows in an open dock, so no save follows.
	const showing =
		zone !== null &&
		!workspace.zones[zone].collapsed &&
		workspace.zones[zone].groups.some((g) => g.tabs.includes(id) && g.active === id);
	const ready =
		zone && !showing ? setZoneCollapsed(activateTab(workspace, id), zone, false) : workspace;
	return { workspace: ready, session: maximisePanel(session, ready, id) };
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
