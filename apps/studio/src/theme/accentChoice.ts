// Turns the saved accent choice and glass setting into what the page draws
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { AccentChoice } from '@liminal-hq/fizz-studio-protocol/generated/AccentChoice';
import type { GlassMode } from '@liminal-hq/fizz-studio-protocol/generated/GlassMode';
import { isHexColour, PRESET_ACCENTS } from './accent';

/**
 * The `#rrggbb` accent a choice stands for, or `null` for the studio's own cyan, which is the
 * default `tokens.css` holds for each scheme. `system` is the system's accent (`null` when it has
 * none); a custom colour that is not a valid hex also falls back to the cyan.
 */
export function resolveAccentHex(choice: AccentChoice, systemAccent: string | null): string | null {
	switch (choice.kind) {
		case 'system':
			return isHexColour(systemAccent) ? systemAccent : null;
		case 'studio':
			return null;
		case 'afterglow-orange':
			return PRESET_ACCENTS.afterglowOrange;
		case 'afterglow-purple':
			return PRESET_ACCENTS.afterglowPurple;
		case 'custom':
			return isHexColour(choice.hex) ? choice.hex : null;
	}
}

/**
 * Whether panels draw as glass or solid. `system` follows the system's reduced-transparency hint;
 * `on` and `off` are the person's word and win over it.
 */
export function resolveGlass(mode: GlassMode, systemReduced: boolean): 'glass' | 'solid' {
	if (mode === 'on') return 'glass';
	if (mode === 'off') return 'solid';
	return systemReduced ? 'solid' : 'glass';
}
