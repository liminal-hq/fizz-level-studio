// The transparency settings' defaults and ranges, what they draw, and the least opacity that keeps text readable
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import defaults from '@liminal-hq/fizz-studio-protocol/fixtures/default-transparency';
import type { TransparencySettings } from '@liminal-hq/fizz-studio-protocol/generated/TransparencySettings';
import { contrast, isHexColour, luminance, MIN_CONTRAST, mix } from './accent';

/**
 * `TransparencySettings::default()` in Rust. The fixture is the one both sides read, and a Rust
 * test fails when it drifts from the crate's defaults.
 */
export const TRANSPARENCY_DEFAULTS: TransparencySettings = defaults as TransparencySettings;

/** The ends of each range, inclusive: the settings crate refuses anything outside them. */
export const GLASS_BLUR_MAX = 40;
export const GLASS_SATURATION_MIN = 100;
export const GLASS_SATURATION_MAX = 200;
export const PANEL_OPACITY_MIN = 40;
export const MENU_OPACITY_MIN = 60;
export const OPACITY_MAX = 100;

/** The surfaces that have their own glass switch, as the settings name them. */
export type GlassSurface = 'docks' | 'floating' | 'menus' | 'dialogs' | 'title_bar';

export const GLASS_SURFACES: readonly GlassSurface[] = [
	'docks',
	'floating',
	'menus',
	'dialogs',
	'title_bar',
];

/** True when `value` is the defaults, field by field. */
export function transparencyAtDefaults(value: TransparencySettings): boolean {
	return (Object.keys(TRANSPARENCY_DEFAULTS) as (keyof TransparencySettings)[]).every(
		(key) => value[key] === TRANSPARENCY_DEFAULTS[key],
	);
}

/** `value` held to `min` and `max`; `fallback` when it is not a number at all (so a stray value cannot make a rule invalid). */
const clamp = (value: number, min: number, max: number, fallback = min): number =>
	Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const hundredths = (percent: number): number => Math.round(clamp(percent, 0, 100)) / 100;

/** The custom property values the glass draws with, as CSS text. */
export interface GlassValues {
	/** `--fls-glass-blur`, such as `16px`. */
	blur: string;
	/** `--fls-glass-saturation`, such as `120%`. */
	saturation: string;
	/** `--fls-glass-alpha`, 0.4 to 1. */
	alpha: string;
	/** `--fls-menu-alpha`, 0.6 to 1. */
	menuAlpha: string;
}

/** What the settings draw with, each value held to its range so a stray one cannot break a rule. */
export function glassValues(
	t: Pick<TransparencySettings, 'blur' | 'saturation' | 'panel_opacity' | 'menu_opacity'>,
): GlassValues {
	return {
		blur: `${clamp(Math.round(t.blur), 0, GLASS_BLUR_MAX, TRANSPARENCY_DEFAULTS.blur)}px`,
		saturation: `${clamp(Math.round(t.saturation), GLASS_SATURATION_MIN, GLASS_SATURATION_MAX, TRANSPARENCY_DEFAULTS.saturation)}%`,
		alpha: String(
			hundredths(
				clamp(t.panel_opacity, PANEL_OPACITY_MIN, OPACITY_MAX, TRANSPARENCY_DEFAULTS.panel_opacity),
			),
		),
		menuAlpha: String(
			hundredths(
				clamp(t.menu_opacity, MENU_OPACITY_MIN, OPACITY_MAX, TRANSPARENCY_DEFAULTS.menu_opacity),
			),
		),
	};
}

/** The opacity the window's own background falls back to when its colours cannot be read (a plain browser, a test). */
export const FALLBACK_FLOOR = 0.7;

/**
 * The backdrop the floor is worked out against: the worst a wallpaper reasonably gets for the text
 * on it. Under a light window that is black; under a dark window a light grey (a pure white
 * wallpaper under a dark window cannot be saved by any opacity short of solid, which is what "Solid
 * when unfocused" and the blur are there for).
 */
export const BACKDROP_UNDER_LIGHT = '#000000';
export const BACKDROP_UNDER_DARK = '#a0a0a0';

/**
 * The least opacity (0 to 1, in hundredths) at which `text` keeps 4.5:1 against `surface` laid over
 * the worst backdrop. The compositor blends in sRGB, so the blend is too. `1` when the pair does not
 * reach it even solid, and `null` when a colour is not `#rrggbb`.
 */
export function alphaFloor(text: string, surface: string): number | null {
	if (!isHexColour(text) || !isHexColour(surface)) return null;
	const backdrop =
		luminance(text) > luminance(surface) ? BACKDROP_UNDER_DARK : BACKDROP_UNDER_LIGHT;
	// `mix` from the backdrop toward the surface by `alpha` is the surface laid over it at `alpha`.
	const reaches = (alpha: number): boolean =>
		contrast(text, mix(backdrop, surface, alpha)) >= MIN_CONTRAST;
	if (reaches(0)) return 0;
	if (!reaches(1)) return 1;
	let low = 0;
	let high = 1;
	for (let i = 0; i < 24; i += 1) {
		const mid = (low + high) / 2;
		if (reaches(mid)) high = mid;
		else low = mid;
	}
	return Math.min(1, Math.ceil(high * 100) / 100);
}

/**
 * The opacity the see-through window's background draws at: the panel opacity, raised to the floor
 * that keeps the text on it readable (`FALLBACK_FLOOR` when the colours cannot be read).
 */
export function windowAlpha(
	panelOpacity: number,
	text: string | null,
	surface: string | null,
): number {
	const wanted = hundredths(
		clamp(panelOpacity, PANEL_OPACITY_MIN, OPACITY_MAX, TRANSPARENCY_DEFAULTS.panel_opacity),
	);
	const floor = (text && surface ? alphaFloor(text, surface) : null) ?? FALLBACK_FLOOR;
	return Math.max(wanted, floor);
}

/**
 * Whether the window lets the desktop through now. The order is the guardrails': it must be
 * switched on, glass must be drawn at all (the master switch, and the system's reduced
 * transparency under `system`), the system must be able to (`available`, unknown counts as no), and
 * a window that is not in front draws solid unless the person allowed it.
 */
export function windowSeeThrough(input: {
	enabled: boolean;
	glass: 'glass' | 'solid';
	available: boolean | null;
	focused: boolean;
	solidWhenUnfocused: boolean;
}): boolean {
	if (!input.enabled || input.glass === 'solid') return false;
	if (input.available !== true) return false;
	return input.focused || !input.solidWhenUnfocused;
}
