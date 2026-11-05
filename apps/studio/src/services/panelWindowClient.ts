// Tears a panel out into its own window and docks it back: the app's panel-window commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WindowId } from '@liminal-hq/fizz-studio-protocol/generated/WindowId';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** Sent to every window by Rust when a panel window goes away; the payload is its label. */
export const PANEL_CLOSED_EVENT = 'panel://closed';

/** The first (and, for now, only) window of a panel: `script` is `panel-script-1`. */
export function panelWindowId(panel: string): WindowId {
	return { kind: 'panel', panel, n: 1 };
}

/** The label of a panel's window. */
export function panelLabel(panel: string): string {
	return `panel-${panel}-1`;
}

export interface PanelWindowClient {
	/** The labels of the panel windows open now. */
	open(): Promise<string[]>;
	/** Opens the panel's window, or focuses it when it is already open. */
	tearOff(panel: string): Promise<void>;
	/** Closes the panel's window, which puts the panel back where it was. */
	dockBack(panel: string): Promise<void>;
	/** A panel window closed, however it closed; the argument is its label. */
	onClosed(listener: (label: string) => void): () => void;
}

/** The real client: Rust's `open_window`, `open_panels` and `close_panel` commands. */
export const panelWindowClient: PanelWindowClient = {
	open: () => invoke<string[]>('open_panels'),
	tearOff: (panel) => invoke('open_window', { id: panelWindowId(panel) }),
	dockBack: (panel) => invoke('close_panel', { id: panelWindowId(panel) }),
	onClosed(listener) {
		let stop: (() => void) | null = null;
		let cancelled = false;
		void listen<string>(PANEL_CLOSED_EVENT, (event) => listener(event.payload))
			.then((unlisten) => {
				if (cancelled) unlisten();
				else stop = unlisten;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			stop?.();
		};
	},
};
