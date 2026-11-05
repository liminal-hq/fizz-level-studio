// Asks Rust to open a window: the one place the webview names the `open_window` command
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WindowId } from '@liminal-hq/fizz-studio-protocol/generated/WindowId';
import { invoke } from '@tauri-apps/api/core';

export type { WindowId };

/** Opens the window, or focuses it when it is already open. Reopening never makes a second. */
export function openWindow(id: WindowId): Promise<void> {
	return invoke('open_window', { id });
}
