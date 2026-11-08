// The editor's dock layout: loaded from the settings, kept while the editor is open and saved on change
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Panels in windows of their own are followed by `usePanelWindows`. This hook owns
// the active workspace (where each panel is) and the session (what is peeking, what is hidden for
// the level). Every move goes through the pure reducers; the workspace is written back after a
// short pause and once more when the editor closes. A failed read or write leaves the layout as it
// is on screen.

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import type { ToolPickerPlacement } from '@liminal-hq/fizz-studio-protocol/generated/ToolPickerPlacement';
import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { WindowPlacement } from '@liminal-hq/fizz-studio-protocol/generated/WindowPlacement';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DockClient } from '../../services/dockClient';
import { registerFlush } from '../../services/pendingWrites';
import { SAVE_DELAY_MS, type PanelView } from '../float/usePanelLayout';
import { clampRect, isMeasured, type Rect, type Size } from '../float/panelGeometry';
import { PANEL_SPECS, type PanelId } from '../float/panelSpecs';
import { isResetLayoutKey } from '../float/snap';
import { moveFloat, raiseFloat, toggleFloatCollapsed } from './dockFloat';
import {
	INITIAL_SESSION,
	activateTab,
	bringBack,
	closePeek,
	maximiseDocked,
	restorePanel,
	dockToZone,
	floatPanel,
	peekPanel,
	placeWindow,
	reorderTab,
	pinPanel,
	resizeZone,
	sendToWindow,
	setPanelVisible,
	settleSession,
	toggleLevelFirst,
	toggleZone,
	type DockSession,
} from './dockLayout';
import { dropOnZone } from './dockDrop';
import { MAX_EXTENT, PANEL_IDS, defaultDock, defaultWorkspace } from './dockModel';
import { normaliseDock, resetWorkspace } from './dockNormalise';
import { shownPanels, visibleWorkspace } from './dockView';

/** The window size used until the window has been measured, so the caps mean something. */
export const FALLBACK_WINDOW: Size = { w: 1280, h: 800 };

export interface DockLayoutHandle {
	/** The saved arrangement, hidden panels included. */
	workspace: Workspace;
	/** What to draw: hidden panels taken out and, in level-first, every zone folded to its rail. */
	view: Workspace;
	session: DockSession;
	/** The window the caps are measured against. */
	window: Size;
	/** Whether each panel is shown, for the menus. */
	shown: Record<PanelId, boolean>;
	/** The panels floating over the level, as the floating panel draws them. */
	floating: Record<PanelId, PanelView>;
	activate(id: string): void;
	dockTo(id: string, zone: ZoneId): void;
	floatPanel(id: string): void;
	/** Floats a panel at a rectangle, as a drop on the level does. */
	floatAt(id: string, rect: Rect): void;
	/** Docks a panel where a drop put it: the dock, the tab group and the place among its tabs. */
	dropOn(id: string, zone: ZoneId, group: number | null, index: number | null): void;
	/** Moves a docked panel to a place among its group's tabs. */
	reorder(id: string, index: number): void;
	setVisible(id: string, visible: boolean): void;
	toggleZone(zone: ZoneId): void;
	resizeZone(zone: ZoneId, size: number): void;
	/** Puts a zone back at the size the default arrangement gives it. */
	resetZoneSize(zone: ZoneId): void;
	changeFloat(id: PanelId, rect: Rect): void;
	toggleFloatCollapsed(id: PanelId): void;
	raise(id: PanelId): void;
	peek(id: string): void;
	closePeek(): void;
	pin(id: string): void;
	toggleLevelFirst(): void;
	/** Makes an expandable panel fill the workspace (not saved). */
	maximise(id: string): void;
	/** Puts the maximised panel back. */
	restore(): void;
	/** Puts the active workspace back to its shipped arrangement. */
	reset(): void;
	/** True once the saved arrangement has been read (or could not be). */
	loaded: boolean;
	/** Records a panel as in a window of its own, and where that window is when `at` is given. */
	sendToWindow(id: string, at?: WindowPlacement): void;
	/** Brings a panel in a window of its own back to its zone, or to floating. */
	bringBack(id: string): void;
	/** Records where a panel's window is, whatever the panel's place now. */
	placeWindow(id: string, at: WindowPlacement): void;
	/** Where the tool picker was moved to in this workspace; null is the map's top-left corner. */
	toolPicker: ToolPickerPlacement | null;
	/** Records where the tool picker was moved to, in whole pixels from the map's top-left corner. */
	placeToolPicker(at: ToolPickerPlacement): void;
	/** The name of the active workspace. */
	active: string;
	/** The names of every workspace, in the saved order. */
	workspaceNames: string[];
	/** Makes another workspace the active one (nothing happens for a name that is not saved). */
	switchWorkspace(name: string): void;
	/** Writes a change waiting on its pause now; resolves when Rust has it. */
	flush(): Promise<void>;
}

/**
 * Holds the dock for a window of the given size, with `area` the room floating panels float in. It starts from the built-in arrangement and takes
 * the saved one when Rust answers (unless the person has already moved something), and resets on
 * Ctrl+Shift+0.
 */
export function useDockLayout(client: DockClient, windowSize: Size, area: Size): DockLayoutHandle {
	const measured = isMeasured(windowSize) ? windowSize : FALLBACK_WINDOW;
	const sized = useRef(measured);
	sized.current = measured;

	const [dock, setDock] = useState<DockSettings>(defaultDock);
	const [rawSession, setRawSession] = useState<DockSession>(INITIAL_SESSION);
	const rawSessionRef = useRef(rawSession);
	rawSessionRef.current = rawSession;
	const latest = useRef(dock);
	const touched = useRef(false);
	const [loaded, setLoaded] = useState(false);
	const dirty = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	/** Writes the waiting change now; the promise settles when Rust has it (a failure is swallowed). */
	const flush = useCallback((): Promise<void> => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		if (!dirty.current) return Promise.resolve();
		dirty.current = false;
		return client.save(latest.current).catch(() => {});
	}, [client]);
	const write = useCallback(() => void flush(), [flush]);

	// A window that is closing awaits this, so a change made just before is not lost.
	useEffect(() => registerFlush(flush), [flush]);

	const commit = useCallback(
		(next: DockSettings) => {
			if (next === latest.current) return;
			latest.current = next;
			touched.current = true;
			dirty.current = true;
			setDock(next);
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(write, SAVE_DELAY_MS);
		},
		[write],
	);

	useEffect(() => {
		let live = true;
		client.get().then(
			(saved) => {
				if (!live) return;
				if (touched.current) return setLoaded(true);
				const repaired = normaliseDock(
					saved,
					isMeasured(sized.current) ? sized.current : undefined,
				);
				latest.current = repaired;
				setDock(repaired);
				setLoaded(true);
			},
			() => live && setLoaded(true),
		);
		return () => {
			live = false;
		};
	}, [client]);

	// The last change is written when the editor goes away.
	useEffect(() => write, [write]);

	const current = (): Workspace => latest.current.workspaces[latest.current.active]!;
	const workspace = dock.workspaces[dock.active] ?? defaultWorkspace();

	const edit = useCallback(
		(change: (ws: Workspace) => Workspace) => {
			const old = latest.current;
			const was = old.workspaces[old.active];
			if (!was) return;
			const now = change(was);
			if (now === was) return;
			commit({ ...old, workspaces: { ...old.workspaces, [old.active]: now } });
		},
		[commit],
	);

	const session = useMemo(() => settleSession(rawSession, workspace), [rawSession, workspace]);
	useEffect(() => {
		if (session !== rawSession) setRawSession(session);
	}, [session, rawSession]);

	const activate = useCallback((id: string) => edit((ws) => activateTab(ws, id)), [edit]);
	const dockTo = useCallback(
		(id: string, zone: ZoneId) => edit((ws) => dockToZone(ws, id, zone)),
		[edit],
	);
	const toWindow = useCallback(
		(id: string, at?: WindowPlacement) => edit((ws) => sendToWindow(ws, id, at)),
		[edit],
	);
	const record = useCallback(
		(id: string, at: WindowPlacement) => edit((ws) => placeWindow(ws, id, at)),
		[edit],
	);
	const fromWindow = useCallback((id: string) => edit((ws) => bringBack(ws, id)), [edit]);
	const float = useCallback((id: string) => edit((ws) => floatPanel(ws, id)), [edit]);
	const floatAt = useCallback(
		(id: string, rect: Rect) => edit((ws) => floatPanel(ws, id, rect)),
		[edit],
	);
	const dropOn = useCallback(
		(id: string, zone: ZoneId, group: number | null, index: number | null) =>
			edit((ws) => dropOnZone(ws, id, zone, group, index)),
		[edit],
	);
	const reorder = useCallback(
		(id: string, index: number) => edit((ws) => reorderTab(ws, id, index)),
		[edit],
	);
	const setVisible = useCallback(
		(id: string, visible: boolean) => edit((ws) => setPanelVisible(ws, id, visible)),
		[edit],
	);
	const toggleZoneFold = useCallback((zone: ZoneId) => edit((ws) => toggleZone(ws, zone)), [edit]);
	const resize = useCallback(
		(zone: ZoneId, size: number) => edit((ws) => resizeZone(ws, zone, size, sized.current)),
		[edit],
	);
	const resetZoneSize = useCallback(
		(zone: ZoneId) => resize(zone, defaultWorkspace().zones[zone].size),
		[resize],
	);
	const changeFloat = useCallback(
		(id: PanelId, rect: Rect) => edit((ws) => moveFloat(ws, id, rect)),
		[edit],
	);
	const toggleCollapsed = useCallback(
		(id: PanelId) => edit((ws) => toggleFloatCollapsed(ws, id)),
		[edit],
	);
	const raise = useCallback((id: PanelId) => edit((ws) => raiseFloat(ws, id)), [edit]);
	const placeToolPicker = useCallback(
		(at: ToolPickerPlacement) =>
			edit((ws) => {
				const x = Math.max(0, Math.min(Math.round(at.x), MAX_EXTENT));
				const y = Math.max(0, Math.min(Math.round(at.y), MAX_EXTENT));
				if (ws.tool_picker?.x === x && ws.tool_picker?.y === y) return ws;
				return { ...ws, tool_picker: { x, y } };
			}),
		[edit],
	);

	const peek = useCallback(
		(id: string) => setRawSession((s) => peekPanel(settleSession(s, current()), current(), id)),
		[],
	);
	const closePeekNow = useCallback(() => setRawSession((s) => closePeek(s)), []);
	const pin = useCallback(
		(id: string) => {
			const ws = current();
			const moved = pinPanel(ws, rawSessionRef.current, id);
			edit(() => moved.workspace);
			setRawSession(moved.session);
		},
		[edit],
	);
	// Maximising wins over level-first: while a panel fills the workspace, level-first is ignored.
	const levelFirst = useCallback(
		() => setRawSession((s) => (s.maximised !== null ? s : toggleLevelFirst(s))),
		[],
	);
	// A panel stays where it is when maximised. A panel in a folded dock (or peeking from its rail)
	// first unfolds its zone and becomes the showing tab; Restore leaves the dock open. The
	// panel is drawn once, in the open dock, and stays mounted while it fills the workspace.
	const maximise = useCallback(
		(id: string) => {
			const settled = settleSession(rawSessionRef.current, current());
			const moved = maximiseDocked(current(), settled, id);
			if (moved.workspace === current() && moved.session === settled) return;
			edit(() => moved.workspace);
			setRawSession(moved.session);
		},
		[edit],
	);
	const restore = useCallback(() => setRawSession((s) => restorePanel(s)), []);

	const switchWorkspace = useCallback(
		(name: string) => {
			const old = latest.current;
			if (old.active === name || !old.workspaces[name]) return;
			commit({ ...old, active: name });
		},
		[commit],
	);
	const workspaceNames = useMemo(() => Object.keys(dock.workspaces), [dock.workspaces]);

	const reset = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		touched.current = true;
		const fresh = resetWorkspace(latest.current, sized.current);
		latest.current = fresh;
		dirty.current = true;
		setDock(fresh);
		setRawSession(INITIAL_SESSION);
		timer.current = setTimeout(write, SAVE_DELAY_MS);
	}, [write]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!isResetLayoutKey(event)) return;
			event.preventDefault();
			reset();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [reset]);

	const view = useMemo(
		() => visibleWorkspace(workspace, session.levelFirst),
		[workspace, session.levelFirst],
	);
	const shown = useMemo(() => shownPanels(workspace, PANEL_IDS), [workspace]);

	const floating = useMemo(() => {
		return Object.fromEntries(
			PANEL_SPECS.map((spec) => {
				const entry = workspace.panels[spec.id]!;
				const f = entry.float;
				const raw: Rect = { x: f.x, y: f.y, w: f.w, h: f.h };
				const view: PanelView = {
					rect: isMeasured(area) ? clampRect(raw, spec.min, area, f.collapsed) : raw,
					collapsed: f.collapsed,
					visible: entry.place === 'floating' && f.visible && !session.levelFirst,
					z: f.z,
				};
				return [spec.id, view];
			}),
		) as Record<PanelId, PanelView>;
	}, [workspace, area, session.levelFirst]);

	return {
		workspace,
		view,
		session,
		window: measured,
		shown,
		floating,
		activate,
		dockTo,
		floatPanel: float,
		floatAt,
		dropOn,
		reorder,
		setVisible,
		toggleZone: toggleZoneFold,
		resizeZone: resize,
		resetZoneSize,
		changeFloat,
		toggleFloatCollapsed: toggleCollapsed,
		raise,
		peek,
		closePeek: closePeekNow,
		pin,
		toggleLevelFirst: levelFirst,
		maximise,
		restore,
		reset,
		loaded,
		sendToWindow: toWindow,
		bringBack: fromWindow,
		placeWindow: record,
		toolPicker: workspace.tool_picker ?? null,
		placeToolPicker,
		active: dock.active,
		workspaceNames,
		switchWorkspace,
		flush,
	};
}
