// Decides which colour scheme a window wears: the person's choice, or the system's
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ColourMode } from '@liminal-hq/fizz-studio-protocol/generated/ColourMode';

/** The system's preference, as the system-appearance plugin reports it. */
export type SystemScheme = 'light' | 'dark' | 'noPreference';

/**
 * The scheme to force on the page, or `null` to leave it to the browser's own
 * `prefers-color-scheme` (the tokens follow that when no `data-fls-theme` is set). A forced
 * `light` or `dark` choice wins; `system` follows what the plugin read from the desktop, because the
 * webview does not always see the desktop's setting itself.
 */
export function resolveColourScheme(
	mode: ColourMode,
	system: SystemScheme,
): 'light' | 'dark' | null {
	if (mode === 'light' || mode === 'dark') return mode;
	return system === 'noPreference' ? null : system;
}

/** Sets or clears `data-fls-theme` on the root element, which the tokens key their colours on. */
export function applyColourScheme(
	scheme: 'light' | 'dark' | null,
	root: HTMLElement = document.documentElement,
): void {
	if (scheme === null) delete root.dataset.flsTheme;
	else root.dataset.flsTheme = scheme;
}
