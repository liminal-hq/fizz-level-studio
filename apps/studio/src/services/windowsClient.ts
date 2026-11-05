// Asks Rust to open a window: the one place the webview names the `open_window` command
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';

/** A window the app can open, as `windows.rs` names it. A window's label is built from this. */
export type WindowId =
	| { kind: 'main'; n: number }
	| { kind: 'panel'; panel: string; n: number }
	| { kind: 'new-world' }
	| { kind: 'preferences' }
	| { kind: 'about' }
	| { kind: 'tear-ghost' };

/** Opens the window, or focuses it when it is already open. Reopening never makes a second. */
export function openWindow(id: WindowId): Promise<void> {
	return invoke('open_window', { id });
}
