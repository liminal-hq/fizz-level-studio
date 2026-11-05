// The close gate contract: Rust asks a window's page whether it may close, and the page answers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** The event Rust sends to a window whose page decides whether it closes. */
export const CLOSE_REQUESTED_EVENT = 'window://close-requested';

/** The payload of `window://close-requested`. */
export interface CloseRequest {
	token: number;
}

/**
 * `close` when nothing is lost, `stay` to keep the window, `asking` while a question is shown
 * (Rust stops waiting for a first answer, and the page then answers `close` or `stay`).
 */
export type CloseAnswer = 'close' | 'stay' | 'asking';

export interface CloseGateClient {
	/** Hears this window asked to close; returns the unsubscribe, usable at once. */
	onRequested(listener: (token: number) => void): () => void;
	answer(token: number, answer: CloseAnswer): Promise<void>;
}

/** The real client, over the app's events and commands. */
export const closeGateClient: CloseGateClient = {
	onRequested: (listener) => {
		let stop: (() => void) | null = null;
		let cancelled = false;
		void listen<CloseRequest>(CLOSE_REQUESTED_EVENT, (e) => listener(e.payload.token)).then(
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
	answer: (token, answer) => invoke<void>('window_close_answer', { token, answer }),
};
