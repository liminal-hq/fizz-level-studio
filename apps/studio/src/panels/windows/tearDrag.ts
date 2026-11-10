// Tearing a panel off by dragging it out of the main window: which route the desktop allows, and what a release does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// `useDockDrag` calls `onLeaveWindow` once the pointer is past the window's edge and takes the
// `WindowExit` this returns. The plugin's probes decide the route, never the platform:
//
// 1. `toplevel_drag` (Wayland, where the compositor offers `xdg-toplevel-drag`): the panel's own
//    window is made hidden and the compositor drags it with the pointer for the whole drag. The page
//    gets no more pointer events, so the page's drag is finished at once; the window stays where it
//    is dropped, or is closed again when the drag is cancelled.
// 2. `ghost` with `cursor_follow` (X11, Windows): the plugin's ghost card follows the cursor from the
//    native side. A release over no registered region opens the panel's window where the cursor was.
// 3. Neither: the drag is cancelled with a note, and the panel menu's Tear off still works.

import type { WindowPlacement } from '@liminal-hq/fizz-studio-protocol/generated/WindowPlacement';
import { t } from '../../i18n/messages';
import type {
	DropReport,
	PanelDragPayload,
	Point,
	Size,
	TearoffClient,
	TearoffFeatures,
} from '../../services/tearoffClient';
import type { LeaveWindowInfo, WindowExit } from '../dock/useDockDrag';

/** The size of the card the ghost draws, in logical pixels. */
export const GHOST_SIZE: Size = { width: 220, height: 56 };

/** What a panel drag out of the window asks of the editor. */
export interface TearDragHooks {
	/** Opens the panel's window at `at` (physical pixels), or where it was last, and records the panel as away. */
	tearOff(at: WindowPlacement | null): void;
	/** Opens the panel's window hidden and records the panel as away; the label, or null when it could not be opened. */
	openHidden(): Promise<string | null>;
	/** Puts the panel back from a window that was opened for a drag that did not happen. */
	discard(): void;
	/** Says something to a screen reader. */
	say(text: string): void;
}

export interface TearDragInput {
	client: TearoffClient;
	features: TearoffFeatures;
	info: LeaveWindowInfo;
	/** The panel's name. */
	title: string;
	/** The size a torn-off window opens at without a remembered one, in logical pixels (the panel's floating size). */
	windowSize: Size;
	/** The size of the window the panel was last torn off into, in physical pixels, if any. */
	remembered: WindowPlacement | null;
	hooks: TearDragHooks;
}

/** Where a window opens when the cursor is at `report.cursor` and the card was held at `grab`. */
export function placementFromDrop(
	report: DropReport,
	grab: Point,
	windowSize: Size,
	remembered: WindowPlacement | null,
): WindowPlacement | null {
	if (!report.cursor || report.cursorStale) return null;
	const scale = report.scaleFactor > 0 ? report.scaleFactor : 1;
	return {
		x: Math.round(report.cursor.x - grab.x * scale),
		y: Math.round(report.cursor.y - grab.y * scale),
		w: remembered?.w ?? Math.round(windowSize.width * scale),
		h: remembered?.h ?? Math.round(windowSize.height * scale),
	};
}

/** The grab point held inside the ghost card: where the press was, kept off the card's edges. */
export function ghostGrab(grab: Point): Point {
	const keep = (value: number, size: number) => Math.min(Math.max(value, 12), size - 12);
	return { x: keep(grab.x, GHOST_SIZE.width), y: keep(grab.y, GHOST_SIZE.height) };
}

/**
 * Starts the drag out of the window, or returns undefined (after finishing the page's drag and
 * saying why) when this desktop has no route. The returned exit is what `useDockDrag` runs.
 */
export function startTearDrag(input: TearDragInput): WindowExit | undefined {
	const { features, info, title, hooks } = input;
	const payload: PanelDragPayload = {
		kind: 'panel',
		panel: info.id,
		source: info.source,
		title,
		label: t('tearoff.ghost.tearOff'),
	};
	if (features.toplevelDrag) return startToplevel(input, payload);
	if (features.ghost && features.cursorFollow) return startGhost(input, payload);
	info.finish();
	hooks.say(t('tearoff.drag.unavailable'));
	return undefined;
}

/** The compositor drags the panel's own window. */
function startToplevel(input: TearDragInput, payload: PanelDragPayload): WindowExit {
	const { client, info, title, hooks } = input;
	let live = true;
	let label: string | null = null;
	let stop: (() => void) | null = null;
	const finishUp = () => {
		stop?.();
		stop = null;
	};
	const giveUp = (text: string) => {
		live = false;
		finishUp();
		info.finish();
		if (label !== null) hooks.discard();
		hooks.say(text);
	};
	void hooks.openHidden().then(async (opened) => {
		if (!live) {
			// Cancelled while the window was opening: close it again.
			if (opened !== null) hooks.discard();
			return;
		}
		if (opened === null) return giveUp(t('tearoff.drag.unavailable'));
		label = opened;
		stop = client.onToplevelEnded((ended) => {
			if (ended.window !== opened) return;
			live = false;
			finishUp();
			if (ended.outcome === 'cancelled' || ended.outcome === 'failed') {
				hooks.discard();
				hooks.say(t('tearoff.drag.cancelled', { title }));
			} else if (ended.outcome === 'dropped-elsewhere') {
				hooks.say(t('tearoff.drag.torn', { title }));
			}
			// Dropped on a window: the window that took it docks the panel (see `useDockBack`).
		});
		try {
			const report = await client.beginToplevelDrag(payload, opened, ghostGrab(info.grab));
			if (report.state !== 'started') return giveUp(t('tearoff.drag.unavailable'));
			// The compositor has the pointer now: the page will hear no release.
			info.finish();
		} catch {
			giveUp(t('tearoff.drag.unavailable'));
		}
	});
	return {
		// The pointer events stop when the compositor takes the drag; until then a release outside
		// the window is a drop nobody can place, so it is a cancel.
		drop: () => cancelToplevel(),
		cancel: () => cancelToplevel(),
	};

	function cancelToplevel() {
		if (!live) return;
		live = false;
		finishUp();
		void client.endToplevelDrag().catch(() => {});
		if (label !== null) hooks.discard();
	}
}

/** The ghost card follows the cursor, and a release opens the window there. */
function startGhost(input: TearDragInput, payload: PanelDragPayload): WindowExit {
	const { client, info, title, hooks, windowSize, remembered } = input;
	const grab = ghostGrab(info.grab);
	let state: 'starting' | 'following' | 'ended' = 'starting';
	const stopTimeout = client.onTimeout(() => {
		if (state === 'ended') return;
		state = 'ended';
		stopTimeout();
		info.finish();
		hooks.say(t('tearoff.drag.cancelled', { title }));
	});
	const started = client.begin(payload, grab, GHOST_SIZE).then(
		(result) => {
			if (state === 'ended') {
				// Ended while starting: the ghost must not be left on screen.
				if (result === 'following') void client.end('cancel').catch(() => {});
				return;
			}
			if (result === 'following') {
				state = 'following';
				return;
			}
			state = 'ended';
			stopTimeout();
			info.finish();
			hooks.say(t('tearoff.drag.unavailable'));
		},
		() => {
			state = 'ended';
			stopTimeout();
			info.finish();
			hooks.say(t('tearoff.drag.unavailable'));
		},
	);
	return {
		drop: () => {
			void started.then(async () => {
				if (state !== 'following') return;
				state = 'ended';
				stopTimeout();
				let report: DropReport;
				try {
					report = await client.end('drop');
				} catch {
					hooks.say(t('tearoff.drag.cancelled', { title }));
					return;
				}
				if (report.hit) {
					// Over another window of the app: nothing there takes a panel from this window.
					hooks.say(t('tearoff.drag.cancelled', { title }));
					return;
				}
				hooks.tearOff(placementFromDrop(report, grab, windowSize, remembered));
				hooks.say(t('tearoff.drag.torn', { title }));
			});
		},
		cancel: () => {
			if (state === 'ended') return;
			const was = state;
			state = 'ended';
			stopTimeout();
			if (was === 'following') void client.end('cancel').catch(() => {});
			// Still starting: the start finds the drag ended and cancels the ghost itself. The page says
			// that the drag was cancelled; coming back into the window is no cancel at all.
		},
	};
}
