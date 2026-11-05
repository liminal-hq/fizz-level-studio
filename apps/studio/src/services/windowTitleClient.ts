// Sets the window's native title: the one place the webview names the `set_window_title` command
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';

/**
 * Gives the calling window's native title (the taskbar, Alt+Tab and window lists) the text its
 * title bar shows. Rust sets only the window that asks.
 */
export function setWindowTitle(title: string): Promise<void> {
	return invoke('set_window_title', { title });
}
