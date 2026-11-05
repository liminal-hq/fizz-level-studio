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
import { panelFromLabel } from '../../app/windowKind';
import { panelWindowClient, type PanelWindowClient } from '../../services/panelWindowClient';
import type { DockLayoutHandle } from '../dock/useDockLayout';
import { PANEL_IDS } from '../dock/dockModel';
import type { PanelId } from '../float/panelSpecs';

export interface PanelWindows {
	/** Whether each panel is in a window of its own. */
	away: Record<PanelId, boolean>;
	/** Opens the panel's window (or brings it forward) and records the panel as away. */
	tearOff(id: PanelId): void;
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

	useEffect(() => {
		let live = true;
		const stop = client.onClosed((label) => {
			const panel = panelFromLabel(label);
			if (panel === null) return;
			opened.current.delete(panel);
			latest.current.bringBack(panel);
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
		};
	}, [client]);

	const open = useCallback(
		(id: PanelId, then?: () => void) => {
			if (busy.current.has(id)) return;
			busy.current.add(id);
			client
				.tearOff(id)
				.then(() => {
					opened.current.add(id);
					then?.();
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

	// Make the windows match the saved arrangement once both are known.
	useEffect(() => {
		if (!known || !loaded) return;
		for (const id of PANEL_IDS) {
			const inWindow = workspace.panels[id]?.place === 'window';
			if (inWindow && !opened.current.has(id)) open(id);
			else if (!inWindow && opened.current.has(id)) close(id);
		}
	}, [known, loaded, workspace, open, close]);

	const tearOff = useCallback(
		(id: PanelId) => open(id, () => latest.current.sendToWindow(id)),
		[open],
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

	return { away, tearOff, dockBack };
}
