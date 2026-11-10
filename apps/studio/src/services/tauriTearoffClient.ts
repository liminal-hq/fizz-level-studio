// The real TearoffClient: the window-tearoff plugin through its guest-js API
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import * as tearoff from '@liminal-hq/plugin-window-tearoff';
import {
	NO_TEAROFF,
	type TearoffClient,
	type TearoffFeatures,
	type Unsubscribe,
} from './tearoffClient';

/** Turns a listener registration that resolves later into an unsubscribe that works at once. */
function subscribe(registration: Promise<() => void>): Unsubscribe {
	let unlisten: (() => void) | undefined;
	let stopped = false;
	void registration.then(
		(fn) => {
			if (stopped) fn();
			else unlisten = fn;
		},
		(error: unknown) => console.warn('could not listen for a tear-off event', error),
	);
	return () => {
		stopped = true;
		unlisten?.();
		unlisten = undefined;
	};
}

/**
 * A `TearoffClient` over the plugin. The status is read once and kept: the first call probes the
 * windowing system and can take up to a second. A plugin that fails to answer leaves every
 * feature off, which leaves the panel menu's Tear off and Dock back as the only route.
 */
export function createTauriTearoffClient(): TearoffClient {
	let features: Promise<TearoffFeatures> | null = null;
	return {
		features: () => {
			features ??= tearoff.getStatus().then(
				(status) => ({
					ghost: tearoff.hasFeature(status, 'ghost'),
					cursorFollow: tearoff.hasFeature(status, 'cursor_follow'),
					windowPosition: tearoff.hasFeature(status, 'window_position'),
					hitTest: tearoff.hasFeature(status, 'hit_test'),
					toplevelDrag: tearoff.hasFeature(status, 'toplevel_drag'),
				}),
				(error: unknown) => {
					console.warn('the tear-off plugin did not report its status', error);
					return NO_TEAROFF;
				},
			);
			return features;
		},
		begin: async (payload, grabOffset, size) =>
			(await tearoff.begin(payload, grabOffset, size)).state,
		update: (payload) => tearoff.update(payload),
		end: (outcome) => tearoff.end(outcome),
		hitTest: () => tearoff.hitTest(),
		setDropRegions: (regions) => tearoff.setDropRegions(regions),
		onTimeout: (listener) => subscribe(tearoff.onTimeout(listener)),
		onCursorStale: (listener) => subscribe(tearoff.onCursorStale(listener)),
		beginToplevelDrag: (payload, windowLabel, grabOffset) =>
			tearoff.beginToplevelDrag(payload, windowLabel, grabOffset),
		endToplevelDrag: () => tearoff.endToplevelDrag(),
		onToplevelStarted: (listener) => subscribe(tearoff.onToplevelDragStarted(listener)),
		onToplevelEnded: (listener) => subscribe(tearoff.onToplevelDragEnded(listener)),
		onPayloadDropped: (listener) => subscribe(tearoff.onPayloadDropped(listener)),
		onDragHover: (listener) => subscribe(tearoff.onDragHover(listener)),
		onDragLeave: (listener) => subscribe(tearoff.onDragLeave(listener)),
	};
}

/** The one client the windows share. */
export const tearoffClient: TearoffClient = createTauriTearoffClient();
