// Asks Rust whether Shift+right-click may reach the webview's own menu (a debug build only)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';

export interface NativeMenuClient {
	/** True in a debug build, where the prevent-default plugin leaves the native menu alone. Asked once; false when Rust cannot say. */
	allowed(): Promise<boolean>;
}

let answer: Promise<boolean> | null = null;

/** The Rust decision (`native_menu.rs`), kept after the first answer. A page with no Rust behind it (a test, a browser) gets false. */
export const nativeMenuClient: NativeMenuClient = {
	allowed() {
		answer ??= invoke<boolean>('app_native_menu_allowed').then(
			(allowed) => allowed === true,
			() => false,
		);
		return answer;
	},
};
