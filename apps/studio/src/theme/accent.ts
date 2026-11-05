// Derives the studio's accent colours from the system accent: the lit key, its ink and the text colour
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** The two colours a lit key can carry its label in: near-black or white. */
export const INK_DARK = '#090c14';
export const INK_LIGHT = '#ffffff';

/** The fallback accents, which `tokens.css` also holds: cyan on dark, an accessible teal on light. */
export const DEFAULT_ACCENT = { dark: '#00e5ff', light: '#00778c' } as const;

/** The studio's own accents a person can choose instead of the system's. Studio cyan is the default above. */
export const PRESET_ACCENTS = {
	afterglowOrange: '#ffaa40',
	afterglowPurple: '#a78bfa',
} as const;

/** The flat panel colours accent text is checked against (the lightest tone of each glass panel). */
export const PANEL_COLOUR = { dark: '#222330', light: '#f2eff4' } as const;

/** The contrast ratio WCAG asks for in small text. */
export const MIN_CONTRAST = 4.5;

/** How far the deeper stop is mixed toward black, and the edge toward white. */
const DEEPEN = 0.22;
const LIGHTEN = 0.5;
const STEP = 0.01;

export type Scheme = 'dark' | 'light';
type Rgb = readonly [number, number, number];

/** The values the root element carries, as `#rrggbb` strings. */
export interface DerivedAccent {
	/** The accent as the system gave it; rings, tints and glows come from it. */
	accent: string;
	/** The lit key's deeper bottom stop. */
	accent2: string;
	/** The lit key's lighter edge. */
	accentEdge: string;
	/** The label colour on the lit key: near-black or white, whichever reads better. */
	ink: string;
	/** The lit key's top and bottom fill; darker than the accent when the ink could not pass otherwise. */
	litTop: string;
	litBottom: string;
	/** Accent-coloured text on a dark glass panel and on a light one, each at 4.5:1 or better. */
	textOnDark: string;
	textOnLight: string;
}

/** Whether `value` is a `#rrggbb` colour, which is all the system-appearance plugin reports. */
export function isHexColour(value: unknown): value is string {
	return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function parse(hex: string): Rgb {
	return [
		parseInt(hex.slice(1, 3), 16),
		parseInt(hex.slice(3, 5), 16),
		parseInt(hex.slice(5, 7), 16),
	];
}

function format([r, g, b]: Rgb): string {
	const part = (v: number) =>
		Math.round(Math.min(255, Math.max(0, v)))
			.toString(16)
			.padStart(2, '0');
	return `#${part(r)}${part(g)}${part(b)}`;
}

/** `from` moved `amount` (0 to 1) of the way toward `to`, in sRGB. Toward black or white keeps the hue. */
export function mix(from: string, to: string, amount: number): string {
	const a = parse(from);
	const b = parse(to);
	return format([
		a[0] + (b[0] - a[0]) * amount,
		a[1] + (b[1] - a[1]) * amount,
		a[2] + (b[2] - a[2]) * amount,
	]);
}

/** The WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
	const [r, g, b] = parse(hex).map((v) => {
		const c = v / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
	const x = luminance(a);
	const y = luminance(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The lowest contrast `ink` has against either stop of a lit key. */
function worstContrast(ink: string, stops: readonly string[]): number {
	return Math.min(...stops.map((stop) => contrast(ink, stop)));
}

/**
 * The accent moved toward white (dark panels) or black (light panels) until it reads at 4.5:1 or
 * better against the panel colour. Mixing with white or black keeps the hue.
 */
export function accentTextOn(accent: string, scheme: Scheme): string {
	const panel = PANEL_COLOUR[scheme];
	const target = scheme === 'dark' ? '#ffffff' : '#000000';
	for (let amount = 0; amount <= 1; amount += STEP) {
		const candidate = mix(accent, target, amount);
		if (contrast(candidate, panel) >= MIN_CONTRAST) return candidate;
	}
	return target;
}

/**
 * Derives the accent family from a `#rrggbb` accent. The lit key runs from the accent to the accent
 * mixed 22 percent toward black. Its label is near-black or white, whichever has the higher contrast
 * against the key's worst stop (the darkest for near-black ink, the lightest for white). When even
 * the better one is under 4.5:1, the label becomes white and the fill is darkened toward black until
 * it passes, so the system accent still drives the key rather than being ignored. A null accent
 * takes the scheme's default.
 */
export function deriveAccent(accent: string | null, scheme: Scheme = 'dark'): DerivedAccent {
	const base =
		accent !== null && isHexColour(accent) ? accent.toLowerCase() : DEFAULT_ACCENT[scheme];
	const accent2 = mix(base, '#000000', DEEPEN);
	const accentEdge = mix(base, '#ffffff', LIGHTEN);

	let litTop = base;
	let litBottom = accent2;
	let ink = INK_DARK;
	const dark = worstContrast(INK_DARK, [litTop, litBottom]);
	const light = worstContrast(INK_LIGHT, [litTop, litBottom]);
	if (Math.max(dark, light) >= MIN_CONTRAST) {
		ink = dark >= light ? INK_DARK : INK_LIGHT;
	} else {
		ink = INK_LIGHT;
		for (let amount = STEP; amount <= 1; amount += STEP) {
			litTop = mix(base, '#000000', amount);
			litBottom = mix(litTop, '#000000', DEEPEN);
			if (worstContrast(INK_LIGHT, [litTop, litBottom]) >= MIN_CONTRAST) break;
		}
	}

	return {
		accent: base,
		accent2,
		accentEdge,
		ink,
		litTop,
		litBottom,
		textOnDark: accentTextOn(base, 'dark'),
		textOnLight: accentTextOn(base, 'light'),
	};
}

/** How a derived accent reads on a lit key, for a preview that explains the result. */
export interface KeyReport {
	/** The lowest contrast ratio the label has against either stop of the lit key. */
	ratio: number;
	/** The fill was darkened from the accent so the label stays readable. */
	darkened: boolean;
}

/** The contrast of the label on the lit key, and whether the fill had to be darkened to get it. */
export function reportKey(derived: DerivedAccent): KeyReport {
	return {
		ratio: worstContrast(derived.ink, [derived.litTop, derived.litBottom]),
		darkened: derived.litTop !== derived.accent,
	};
}

/** The custom properties on the root element, as `--fls-*` names. Clearing them restores the defaults. */
export const ACCENT_PROPERTIES = [
	'--fls-accent',
	'--fls-accent-2',
	'--fls-accent-edge',
	'--fls-accent-ink',
	'--fls-lit-key-top',
	'--fls-lit-key-bottom',
	'--fls-sys-text-dark',
	'--fls-sys-text-light',
] as const;

/** Sets the derived accent on the element, or clears it (`null`) so `tokens.css` applies. */
export function applyAccent(
	derived: DerivedAccent | null,
	root: HTMLElement = document.documentElement,
): void {
	if (derived === null) {
		for (const name of ACCENT_PROPERTIES) root.style.removeProperty(name);
		return;
	}
	root.style.setProperty('--fls-accent', derived.accent);
	root.style.setProperty('--fls-accent-2', derived.accent2);
	root.style.setProperty('--fls-accent-edge', derived.accentEdge);
	root.style.setProperty('--fls-accent-ink', derived.ink);
	root.style.setProperty('--fls-lit-key-top', derived.litTop);
	root.style.setProperty('--fls-lit-key-bottom', derived.litBottom);
	root.style.setProperty('--fls-sys-text-dark', derived.textOnDark);
	root.style.setProperty('--fls-sys-text-light', derived.textOnLight);
}
