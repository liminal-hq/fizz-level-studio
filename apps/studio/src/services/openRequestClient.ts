// Asks the main window to open a level, with the same event a second launch uses
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { emitTo } from '@tauri-apps/api/event';
import { OPEN_REQUEST_EVENT, type OpenRequest } from './launchClient';

/** The first main window's label. */
export const MAIN_WINDOW = 'main-1';

/** Tells the main window to open `path`; a clean main window opens it, a dirty one lists it. */
export type RequestOpen = (path: string) => Promise<void>;

export const requestOpen: RequestOpen = (path) => {
	const payload: OpenRequest = { paths: [path] };
	return emitTo(MAIN_WINDOW, OPEN_REQUEST_EVENT, payload);
};
