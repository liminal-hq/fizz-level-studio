// The launch and open-request contract: the paths the app was started with, and later ones
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** The event Rust sends when a second launch hands the running app more paths. */
export const OPEN_REQUEST_EVENT = 'app://open-request';

/** The payload of `app://open-request`. */
export interface OpenRequest {
	paths: string[];
}

/** What the main window needs to learn which files it was asked to open. */
export interface LaunchClient {
	getLaunchPaths(): Promise<string[]>;
	onOpenRequest(listener: (paths: string[]) => void): () => void;
}

/** The `.fizz` paths named on the command line. */
export function getLaunchPaths(): Promise<string[]> {
	return invoke<string[]>('app_launch_paths');
}

/** Hears paths handed over by a later launch; returns the unsubscribe, usable at once. */
export function onOpenRequest(listener: (paths: string[]) => void): () => void {
	let stop: (() => void) | null = null;
	let cancelled = false;
	void listen<OpenRequest>(OPEN_REQUEST_EVENT, (event) => listener(event.payload.paths)).then(
		(unlisten) => {
			if (cancelled) unlisten();
			else stop = unlisten;
		},
	);
	return () => {
		cancelled = true;
		stop?.();
	};
}

/** The real client. */
export const launchClient: LaunchClient = { getLaunchPaths, onOpenRequest };
