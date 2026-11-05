// The quit contract: ask the app to quit, hear when this window is asked if it is ready, and answer
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** The event Rust sends to the main window being asked whether it is ready to quit. */
export const QUIT_REQUESTED_EVENT = 'app://quit-requested';

/** The payload of `app://quit-requested`. */
export interface QuitRequest {
	round: number;
}

/**
 * A main window's answer: `proceed` when nothing unsaved is left in it, `cancel` when the person
 * chose Cancel (or a save failed), which stops the quit and leaves every window open.
 */
export type QuitAnswer = 'proceed' | 'cancel';

export interface QuitClient {
	/** Starts a quit of the whole app. */
	request(): Promise<void>;
	/** Hears this window being asked; returns the unsubscribe, usable at once. */
	onRequested(listener: (round: number) => void): () => void;
	answer(round: number, answer: QuitAnswer): Promise<void>;
}

/** The real client, over the app's commands. */
export const quitClient: QuitClient = {
	request: () => invoke<void>('app_quit'),
	onRequested(listener) {
		let stop: (() => void) | null = null;
		let cancelled = false;
		void listen<QuitRequest>(QUIT_REQUESTED_EVENT, (event) => listener(event.payload.round)).then(
			(unlisten) => {
				if (cancelled) unlisten();
				else stop = unlisten;
			},
		);
		return () => {
			cancelled = true;
			stop?.();
		};
	},
	answer: (round, answer) => invoke<void>('app_quit_answer', { round, answer }),
};
