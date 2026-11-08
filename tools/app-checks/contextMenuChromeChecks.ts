// The running-app checks for the chrome context menus
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Called from run.ts with the shared `check`, once a level is open. In the debug app the webview's own
// menu is not blocked by the plugin, so a `defaultPrevented` `contextmenu` proves the studio's host did it.

import type { Bridge } from './driver';

export type Check = (name: string, ok: boolean, detail?: string) => void;

export async function contextMenuChromeChecks(_bridge: Bridge, _check: Check): Promise<void> {}
