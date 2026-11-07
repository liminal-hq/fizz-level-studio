// Tears a panel out into its own window and docks it back: the app's panel-window commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { PanelPlaced } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlaced';
import type { WindowId } from '@liminal-hq/fizz-studio-protocol/generated/WindowId';
import type { WindowPlacement } from '@liminal-hq/fizz-studio-protocol/generated/WindowPlacement';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** Sent to every window by Rust when a panel window goes away; the payload is its label. */
export const PANEL_CLOSED_EVENT = 'panel://closed';

/** Sent to a panel window's main window when the window opens, moves, resizes or closes; the payload is a `PanelPlaced`. */
export const PANEL_PLACED_EVENT = 'panel://placed';

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
	/**
	 * Opens the panel's window, or focuses it when it is already open, and answers where it is.
	 * `placement` is the remembered place from the saved workspace; Rust fits it to the screens that
	 * exist now, and a platform that cannot place windows keeps only the size. `hidden` makes the
	 * window and leaves it hidden, for the compositor's window drag to show.
	 */
	tearOff(
		panel: string,
		placement?: WindowPlacement | null,
		options?: { hidden?: boolean },
	): Promise<PanelPlaced>;
	/** Closes the panel's window, which puts the panel back where it was. */
	dockBack(panel: string): Promise<void>;
	/** A panel window closed, however it closed; the argument is its label. */
	onClosed(listener: (label: string) => void): () => void;
	/** One of this window's panel windows opened, moved, resized or is closing: where it is now. */
	onPlaced(listener: (placed: PanelPlaced) => void): () => void;
}

/** Turns an event subscription that resolves later into an unsubscribe that works at once. */
function hear<T>(event: string, listener: (payload: T) => void): () => void {
	let stop: (() => void) | null = null;
	let cancelled = false;
	void listen<T>(event, (heard) => listener(heard.payload))
		.then((unlisten) => {
			if (cancelled) unlisten();
			else stop = unlisten;
		})
		.catch(() => {});
	return () => {
		cancelled = true;
		stop?.();
	};
}

/** The real client: Rust's `tear_off_panel`, `open_panels` and `close_panel` commands. */
export const panelWindowClient: PanelWindowClient = {
	open: () => invoke<string[]>('open_panels'),
	tearOff: (panel, placement, options) =>
		invoke<PanelPlaced>('tear_off_panel', {
			panel,
			placement: placement ?? null,
			// Hidden only for the compositor's window drag, which shows the window itself.
			...(options?.hidden ? { hidden: true } : {}),
		}),
	dockBack: (panel) => invoke('close_panel', { id: panelWindowId(panel) }),
	onClosed: (listener) => hear<string>(PANEL_CLOSED_EVENT, listener),
	onPlaced: (listener) => hear<PanelPlaced>(PANEL_PLACED_EVENT, listener),
};
