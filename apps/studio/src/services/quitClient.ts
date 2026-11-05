// The quit contract: ask the app to quit, hear when this window is asked if it is ready, and answer
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** The event Rust sends to the main window being asked whether it is ready to quit. */
export const QUIT_REQUESTED_EVENT = 'app://quit-requested';

/** The event Rust sends, once everyone has answered without Cancel, to carry out a decision. */
export const QUIT_COMMIT_EVENT = 'app://quit-commit';

/** The payload of `app://quit-requested`. */
export interface QuitRequest {
	round: number;
}

/**
 * A main window's decision when asked: `ready` when nothing is unsaved, `save` or `discard` when
 * the person chose that (it is only recorded, and done at commit), `cancel` to stop the quit with
 * nothing done anywhere.
 */
export type QuitAnswer = 'ready' | 'save' | 'discard' | 'cancel';

/** What a window is told to do at commit. */
export type QuitCommitDecision = 'save' | 'discard';

/** The payload of `app://quit-commit`. */
export interface QuitCommit {
	round: number;
	decision: QuitCommitDecision;
}

/** How carrying the decision out went; `failed` keeps the app open. */
export type QuitOutcome = 'done' | 'failed';

export interface QuitClient {
	/** Starts a quit of the whole app. */
	request(): Promise<void>;
	/** Hears this window being asked; returns the unsubscribe, usable at once. */
	onRequested(listener: (round: number) => void): () => void;
	/** Hears this window told to carry out its decision; returns the unsubscribe. */
	onCommit(listener: (round: number, decision: QuitCommitDecision) => void): () => void;
	answer(round: number, answer: QuitAnswer): Promise<void>;
	confirm(round: number, outcome: QuitOutcome): Promise<void>;
}

/** Subscribes to an event, returning an unsubscribe that is safe to call before it is ready. */
function subscribe<T>(event: string, handler: (payload: T) => void): () => void {
	let stop: (() => void) | null = null;
	let cancelled = false;
	void listen<T>(event, (e) => handler(e.payload)).then((unlisten) => {
		if (cancelled) unlisten();
		else stop = unlisten;
	});
	return () => {
		cancelled = true;
		stop?.();
	};
}

/** The real client, over the app's commands. */
export const quitClient: QuitClient = {
	request: () => invoke<void>('app_quit'),
	onRequested: (listener) =>
		subscribe<QuitRequest>(QUIT_REQUESTED_EVENT, (payload) => listener(payload.round)),
	onCommit: (listener) =>
		subscribe<QuitCommit>(QUIT_COMMIT_EVENT, (payload) =>
			listener(payload.round, payload.decision),
		),
	answer: (round, answer) => invoke<void>('app_quit_answer', { round, decision: answer }),
	confirm: (round, outcome) => invoke<void>('app_quit_confirm', { round, outcome }),
};
