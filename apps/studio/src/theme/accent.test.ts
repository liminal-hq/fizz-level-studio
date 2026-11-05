// Tests for deriving the accent family from the system accent
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ACCENT_PROPERTIES,
	DEFAULT_ACCENT,
	INK_DARK,
	INK_LIGHT,
	MIN_CONTRAST,
	PANEL_COLOUR,
	accentTextOn,
	applyAccent,
	contrast,
	deriveAccent,
	isHexColour,
	luminance,
	mix,
} from './accent';

/** The GNOME and Windows 11 accents the K board tabulates, plus awkward mid-tones and extremes. */
const ACCENTS = [
	'#3584e4',
	'#2190a4',
	'#3a944a',
	'#c88800',
	'#ed5b00',
	'#e62d42',
	'#d56199',
	'#9141ac',
	'#6f8396',
	'#0078d4',
	'#ff8c00',
	'#e81123',
	'#00e5ff',
	'#ffffff',
	'#000000',
	'#808080',
	'#ffff00',
	'#0000ff',
];

function hue(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
		number,
		number,
		number,
	];
	const max = Math.max(r, g, b);
	const d = max - Math.min(r, g, b);
	if (d === 0) return 0;
	const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return (h * 60 + 360) % 360;
}

describe('colour maths', () => {
	it('matches the WCAG reference ratios', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
		expect(luminance('#ffffff')).toBeCloseTo(1, 5);
	});

	it('mixes toward black and white', () => {
		expect(mix('#00e5ff', '#000000', 0)).toBe('#00e5ff');
		expect(mix('#00e5ff', '#000000', 1)).toBe('#000000');
		expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
	});

	it('accepts only #rrggbb', () => {
		expect(isHexColour('#00e5ff')).toBe(true);
		expect(isHexColour('#0ef')).toBe(false);
		expect(isHexColour(null)).toBe(false);
	});
});

describe('deriveAccent', () => {
	it('keeps the K board numbers for cyan: dark ink, accent-2 22 percent darker, edge half way to white', () => {
		const cyan = deriveAccent('#00e5ff');
		expect(cyan.ink).toBe(INK_DARK);
		expect(cyan.accent2).toBe(mix('#00e5ff', '#000000', 0.22));
		expect(cyan.accentEdge).toBe(mix('#00e5ff', '#ffffff', 0.5));
		expect(cyan.litTop).toBe('#00e5ff');
		expect(cyan.litBottom).toBe(cyan.accent2);
	});

	it('uses white where the board says dark ink fails and white passes', () => {
		const win = deriveAccent('#0078d4');
		expect(win.ink).toBe(INK_LIGHT);
	});

	it('darkens the fill when neither ink passes, rather than ignoring the accent', () => {
		const blue = deriveAccent('#3584e4');
		expect(blue.ink).toBe(INK_LIGHT);
		expect(luminance(blue.litTop)).toBeLessThan(luminance('#3584e4'));
		expect(hue(blue.litTop)).toBeCloseTo(hue('#3584e4'), -1);
		// The accent itself, used for rings and tints, stays the system's.
		expect(blue.accent).toBe('#3584e4');
	});

	it('always gives the label 4.5:1 against the worst stop of the lit key', () => {
		for (const accent of ACCENTS) {
			const d = deriveAccent(accent);
			for (const stop of [d.litTop, d.litBottom]) {
				expect(contrast(d.ink, stop), `${accent} on ${stop}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
			}
		}
	});

	it('always gives accent text 4.5:1 on each panel, keeping the hue', () => {
		for (const accent of ACCENTS) {
			const d = deriveAccent(accent);
			expect(contrast(d.textOnDark, PANEL_COLOUR.dark), accent).toBeGreaterThanOrEqual(
				MIN_CONTRAST,
			);
			expect(contrast(d.textOnLight, PANEL_COLOUR.light), accent).toBeGreaterThanOrEqual(
				MIN_CONTRAST,
			);
			const chromatic = hue(accent) !== 0 && accent !== '#ffffff' && accent !== '#808080';
			if (chromatic && luminance(accent) > 0.01) {
				expect(Math.abs(hue(d.textOnDark) - hue(accent)), accent).toBeLessThan(8);
			}
		}
	});

	it('lightens accent text on dark and darkens it on light', () => {
		expect(luminance(accentTextOn('#0078d4', 'dark'))).toBeGreaterThan(luminance('#0078d4'));
		expect(luminance(accentTextOn('#ffff00', 'light'))).toBeLessThan(luminance('#ffff00'));
		expect(accentTextOn('#00e5ff', 'dark')).toBe('#00e5ff');
	});

	it('falls back to cyan on dark and the teal on light for null or a bad value', () => {
		expect(deriveAccent(null, 'dark').accent).toBe(DEFAULT_ACCENT.dark);
		expect(deriveAccent(null, 'light').accent).toBe(DEFAULT_ACCENT.light);
		expect(deriveAccent('nonsense', 'dark').accent).toBe(DEFAULT_ACCENT.dark);
		expect(deriveAccent(null, 'light').ink).toBe(INK_LIGHT);
	});

	it('uses the same defaults as the token file', () => {
		const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
		expect(css).toContain(`--fls-accent: ${DEFAULT_ACCENT.light};`);
		expect(css).toContain(`--fls-accent: ${DEFAULT_ACCENT.dark};`);
		expect(css).toContain(`--fls-glass-bg-solid: ${PANEL_COLOUR.light};`);
	});
});

describe('applyAccent', () => {
	it('sets every property and clears them all again', () => {
		const root = document.createElement('div');
		applyAccent(deriveAccent('#3584e4'), root);
		for (const name of ACCENT_PROPERTIES)
			expect(root.style.getPropertyValue(name), name).not.toBe('');
		expect(root.style.getPropertyValue('--fls-accent')).toBe('#3584e4');
		applyAccent(null, root);
		for (const name of ACCENT_PROPERTIES) expect(root.style.getPropertyValue(name), name).toBe('');
	});
});
