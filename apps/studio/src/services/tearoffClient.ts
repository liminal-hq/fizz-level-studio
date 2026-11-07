// The tear-off plugin as the panel drag uses it: feature flags, the ghost, drop regions and the compositor's window drag
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Modelled on Waypoint's `tearoffClient.ts`. The interface is what the drag logic sees, so the
// tests drive it with a fake and the real client (`tauriTearoffClient.ts`) is a thin wrapper over
// the plugin's `guest-js`.

import type {
	DragHover,
	DragLeave,
	DropReport,
	Hit,
	PayloadDropped,
	Point,
	Region,
	Size,
	ToplevelBeginReport,
	ToplevelDragEnded,
	ToplevelDragStarted,
} from '@liminal-hq/plugin-window-tearoff';

export type {
	DragHover,
	DragLeave,
	DropReport,
	Hit,
	PayloadDropped,
	Point,
	Region,
	Size,
	ToplevelBeginReport,
	ToplevelDragEnded,
	ToplevelDragStarted,
};

/** Stops listening; safe to call twice. */
export type Unsubscribe = () => void;

/**
 * What the plugin can do on this system. Each flag is a probe the plugin made, never a platform
 * check, so a desktop that cannot do a thing simply reports `false` and the drag takes the next
 * path: the compositor's window drag (Wayland), the ghost that follows the cursor (X11, Windows),
 * or none, which leaves the panel menu's Tear off and Dock back.
 */
export interface TearoffFeatures {
	/** A ghost window can be shown and moved under the cursor. */
	ghost: boolean;
	/** The native cursor is live while a button is held. */
	cursorFollow: boolean;
	/** A window can be placed at a position. */
	windowPosition: boolean;
	/** Another window's drop regions can be hit-tested. */
	hitTest: boolean;
	/** The compositor can move a real window with the pointer for the whole drag (Wayland, `xdg-toplevel-drag`). */
	toplevelDrag: boolean;
}

/** Every feature off: what a window has before the plugin has answered, and without the plugin. */
export const NO_TEAROFF: TearoffFeatures = {
	ghost: false,
	cursorFollow: false,
	windowPosition: false,
	hitTest: false,
	toplevelDrag: false,
};

/** What a panel drag carries: which panel, what was pressed, and what the ghost card says. */
export interface PanelDragPayload {
	kind: 'panel';
	panel: string;
	/** What was pressed: a rail entry or tab, a panel header, or a Script tab. */
	source: 'tab' | 'header' | 'scriptTab';
	/** The panel's name, drawn on the ghost card. */
	title: string;
	/** What a release would do, drawn under the title. */
	label?: string;
}

/** Narrows an opaque payload to a panel drag's, or null for anything else (another window's word is not trusted). */
export function readPanelDragPayload(raw: unknown): PanelDragPayload | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const v = raw as Record<string, unknown>;
	if (v.kind !== 'panel' || typeof v.panel !== 'string') return null;
	const source = v.source === 'tab' || v.source === 'scriptTab' ? v.source : 'header';
	return {
		kind: 'panel',
		panel: v.panel,
		source,
		title: typeof v.title === 'string' ? v.title : v.panel,
		...(typeof v.label === 'string' ? { label: v.label } : {}),
	};
}

export type BeginResult = 'following' | 'noGhost' | 'alreadyActive';

/** Everything the panel drag asks of the tear-off plugin. */
export interface TearoffClient {
	/** The probed features. The first call can take a second on Wayland, so it is asked once and kept. */
	features(): Promise<TearoffFeatures>;
	begin(payload: PanelDragPayload, grabOffset: Point, size: Size): Promise<BeginResult>;
	update(payload: PanelDragPayload): Promise<void>;
	end(outcome: 'drop' | 'cancel'): Promise<DropReport>;
	/** The registered region under the cursor now, without ending the drag. */
	hitTest(): Promise<Hit | null>;
	/** Replaces this window's drop regions, in logical pixels from the top-left of its content. */
	setDropRegions(regions: Region[]): Promise<void>;
	/** The plugin ended a drag that ran too long. */
	onTimeout(listener: () => void): Unsubscribe;
	/** The cursor froze while a button was held (`true`) or moved again (`false`). */
	onCursorStale(listener: (stale: boolean) => void): Unsubscribe;

	/** Drags the window `windowLabel` with the compositor, from the press in this window. */
	beginToplevelDrag(
		payload: PanelDragPayload,
		windowLabel: string,
		grabOffset: Point,
	): Promise<ToplevelBeginReport>;
	/** Cancels the toplevel drag in progress. */
	endToplevelDrag(): Promise<void>;
	/** The compositor took the drag this window began: the page gets no pointer events until it ends. */
	onToplevelStarted(listener: (started: ToplevelDragStarted) => void): Unsubscribe;
	/** A toplevel drag this window began, or that moved this window, ended. */
	onToplevelEnded(listener: (ended: ToplevelDragEnded) => void): Unsubscribe;
	/** A toplevel drag's payload was dropped on this window. */
	onPayloadDropped(listener: (dropped: PayloadDropped) => void): Unsubscribe;
	/** A toplevel drag's payload is over this window (the compositor's drag gives the page no pointer events). */
	onDragHover(listener: (hover: DragHover) => void): Unsubscribe;
	onDragLeave(listener: (leave: DragLeave) => void): Unsubscribe;
}
