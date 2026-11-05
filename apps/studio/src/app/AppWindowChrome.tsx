// The window's chrome context: the Tauri window controls the shared chrome drives
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { tauriWindowControls } from '@liminal-hq/fizz-studio-chrome/TitleBar/tauriWindowControls';
import { WindowChromeProvider } from '@liminal-hq/fizz-studio-chrome/WindowChromeProvider/WindowChromeProvider';
import type { ReactNode } from 'react';

/** Wraps a window's content with the chrome state: maximised, focused, and the window's controls. */
export function AppWindowChrome({ children }: { children: ReactNode }) {
	return <WindowChromeProvider controls={tauriWindowControls}>{children}</WindowChromeProvider>;
}
