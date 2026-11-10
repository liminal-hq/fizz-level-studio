// Keeps the panels in windows of their own and their windows in step: tear off, dock back, restore
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The saved workspace says where each panel is (`place` is `window` for a torn-off one) and is the
// source of truth. This hook makes the real windows follow it: a panel that the saved arrangement
// has in a window gets one when the editor starts, a panel moved out of a window by any other route
// (the Dock left button on its tab, say) has its window closed, and a window that closes by itself
// (its own close button, Dock back in the window) brings its panel back through the model. It
// assumes nothing it has not been told: a failed command leaves the panel where it was.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PanelPlaced } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlaced';
import type { WindowPlacement } from '@liminal-hq/fizz-studio-protocol/generated/WindowPlacement';
import { panelFromLabel } from '../../app/windowKind';
import { registerFlush } from '../../services/pendingWrites';
import { panelWindowClient, type PanelWindowClient } from '../../services/panelWindowClient';
import type { DockLayoutHandle } from '../dock/useDockLayout';
import { PANEL_IDS } from '../dock/dockModel';
import type { PanelId } from '../float/panelSpecs';
import { recordPlacement } from './placement';

/** How long a moving window is left alone before its place is recorded, in milliseconds. */
export const PLACE_DELAY_MS = 250;

export interface PanelWindows {
	/** Whether each panel is in a window of its own. */
	away: Record<PanelId, boolean>;
	/**
	 * Opens the panel's window (or brings it forward) and records the panel as away. `at` is where the
	 * window opens, in physical pixels (a panel dragged out opens where it was let go); without it the
	 * window opens where the workspace last had it.
	 */
	tearOff(id: PanelId, at?: WindowPlacement | null): void;
	/**
	 * Opens the panel's window hidden, for the compositor to drag, and records the panel as away.
	 * Resolves to the window's label, or null when it could not be opened. A drag that does not
	 * happen puts the panel back with `dockBack`.
	 */
	tearOffHidden(id: PanelId): Promise<string | null>;
	/** Closes the panel's window and brings the panel back to where it was. */
	dockBack(id: PanelId): void;
}

export function usePanelWindows(
	dock: DockLayoutHandle,
	client: PanelWindowClient = panelWindowClient,
): PanelWindows {
	const { workspace, loaded } = dock;
	const [known, setKnown] = useState(false);
	/** The panels whose window is open, as far as this hook knows. */
	const opened = useRef(new Set<string>());
	/** The panels whose window is being opened or closed by this hook right now. */
	const busy = useRef(new Set<string>());
	const latest = useRef(dock);
	latest.current = dock;
	/** Where each panel's window last reported it was, waiting for the window to stop moving. */
	const pending = useRef(new Map<string, PanelPlaced>());
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	/** Records every place waiting, in the workspace that is active now. */
	const record = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		for (const [id, placed] of pending.current) {
			const was = latest.current.workspace.panels[id]?.window ?? null;
			latest.current.placeWindow(id, recordPlacement(was, placed));
		}
		pending.current.clear();
	}, []);

	// A window closing at quit time must not lose where it was: record, then write the dock now.
	useEffect(
		() =>
			registerFlush(async () => {
				record();
				await latest.current.flush();
			}),
		[record],
	);

	useEffect(() => {
		let live = true;
		const stop = client.onClosed((label) => {
			const panel = panelFromLabel(label);
			if (panel === null) return;
			// Where the window was when it closed is recorded before the panel comes back.
			record();
			opened.current.delete(panel);
			latest.current.bringBack(panel);
		});
		const stopPlaced = client.onPlaced((placed) => {
			const panel = panelFromLabel(placed.label);
			if (panel === null) return;
			pending.current.set(panel, placed);
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(record, PLACE_DELAY_MS);
		});
		client
			.open()
			.then((labels) => {
				if (!live) return;
				for (const label of labels) {
					const panel = panelFromLabel(label);
					if (panel !== null) opened.current.add(panel);
				}
				setKnown(true);
			})
			.catch(() => live && setKnown(true));
		return () => {
			live = false;
			stop();
			stopPlaced();
			if (timer.current) clearTimeout(timer.current);
		};
	}, [client, record]);

	const open = useCallback(
		(id: PanelId, then?: (placed: PanelPlaced) => void, at?: WindowPlacement | null) => {
			if (busy.current.has(id)) return;
			busy.current.add(id);
			// The window opens where it was asked to, or where the active workspace last had it, fitted
			// to the screens now.
			const remembered = at ?? latest.current.workspace.panels[id]?.window ?? null;
			client
				.tearOff(id, remembered)
				.then((placed) => {
					opened.current.add(id);
					then?.(placed);
				})
				.catch(() => {})
				.finally(() => busy.current.delete(id));
		},
		[client],
	);

	const close = useCallback(
		(id: PanelId, then?: () => void) => {
			if (busy.current.has(id)) return;
			busy.current.add(id);
			client
				.dockBack(id)
				.then(() => {
					opened.current.delete(id);
					then?.();
				})
				.catch(() => {})
				.finally(() => busy.current.delete(id));
		},
		[client],
	);

	/** Records the place a window actually opened at, which differs from the record when it was fitted. */
	const keep = useCallback((id: PanelId, placed: PanelPlaced) => {
		const was = latest.current.workspace.panels[id]?.window ?? null;
		latest.current.placeWindow(id, recordPlacement(was, placed));
	}, []);

	// Make the windows match the saved arrangement once both are known.
	useEffect(() => {
		if (!known || !loaded) return;
		for (const id of PANEL_IDS) {
			const inWindow = workspace.panels[id]?.place === 'window';
			if (inWindow && !opened.current.has(id)) open(id, (placed) => keep(id, placed));
			else if (!inWindow && opened.current.has(id)) close(id);
		}
	}, [known, loaded, workspace, open, close, keep]);

	const tearOff = useCallback(
		(id: PanelId, at?: WindowPlacement | null) =>
			open(
				id,
				(placed) => {
					const was = latest.current.workspace.panels[id]?.window ?? null;
					latest.current.sendToWindow(id, recordPlacement(was, placed));
				},
				at,
			),
		[open],
	);
	const tearOffHidden = useCallback(
		(id: PanelId) =>
			new Promise<string | null>((resolve) => {
				if (busy.current.has(id)) return resolve(null);
				busy.current.add(id);
				const remembered = latest.current.workspace.panels[id]?.window ?? null;
				client
					.tearOff(id, remembered, { hidden: true })
					.then((placed) => {
						opened.current.add(id);
						// Away at once: the panel's place is the window while it is dragged, so nothing
						// that syncs the windows with the workspace closes the window mid-drag.
						latest.current.sendToWindow(id, recordPlacement(remembered, placed));
						resolve(placed.label);
					})
					.catch(() => resolve(null))
					.finally(() => busy.current.delete(id));
			}),
		[client],
	);
	const dockBack = useCallback(
		(id: PanelId) => close(id, () => latest.current.bringBack(id)),
		[close],
	);

	const away = useMemo(
		() =>
			Object.fromEntries(
				PANEL_IDS.map((id) => [id, workspace.panels[id]?.place === 'window']),
			) as Record<PanelId, boolean>,
		[workspace],
	);

	return { away, tearOff, tearOffHidden, dockBack };
}
