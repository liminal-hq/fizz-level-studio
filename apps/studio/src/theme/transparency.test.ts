// Tests for the transparency values: the defaults, the glass values, the contrast floor and when a window is see-through
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, mix } from './accent';
import {
	alphaFloor,
	BACKDROP_UNDER_LIGHT,
	FALLBACK_FLOOR,
	glassValues,
	TRANSPARENCY_DEFAULTS,
	transparencyAtDefaults,
	windowAlpha,
	windowSeeThrough,
} from './transparency';

describe('the transparency defaults', () => {
	it('are the shared fixture the settings crate checks', () => {
		expect(TRANSPARENCY_DEFAULTS).toEqual({
			blur: 16,
			saturation: 120,
			panel_opacity: 88,
			docks: true,
			floating: true,
			menus: false,
			dialogs: false,
			title_bar: false,
			menu_opacity: 96,
			window_enabled: false,
			window_blur: 'low',
			solid_when_unfocused: true,
		});
		expect(transparencyAtDefaults(TRANSPARENCY_DEFAULTS)).toBe(true);
		expect(transparencyAtDefaults({ ...TRANSPARENCY_DEFAULTS, menus: true })).toBe(false);
	});
});

describe('glassValues', () => {
	it('writes the settings as CSS values', () => {
		expect(glassValues(TRANSPARENCY_DEFAULTS)).toEqual({
			blur: '16px',
			saturation: '120%',
			alpha: '0.88',
			menuAlpha: '0.96',
		});
	});

	it('holds a stray value to its range', () => {
		expect(glassValues({ blur: 90, saturation: 20, panel_opacity: 5, menu_opacity: 400 })).toEqual({
			blur: '40px',
			saturation: '100%',
			alpha: '0.4',
			menuAlpha: '1',
		});
	});
});

describe('the panel opacity mapping', () => {
	const at = (panel_opacity: number) => glassValues({ ...TRANSPARENCY_DEFAULTS, panel_opacity });

	it('is the opacity itself: 100 is solid and lower lets more through, at 40, 73 and 100', () => {
		expect([40, 73, 100].map((v) => Number(at(v).alpha))).toEqual([0.4, 0.73, 1]);
	});

	it('never writes a value that is not a number, so no rule is left invalid', () => {
		const stray = glassValues({
			blur: Number.NaN,
			saturation: Number.NaN,
			panel_opacity: undefined as unknown as number,
			menu_opacity: Number.NaN,
		});
		expect(stray).toEqual(glassValues(TRANSPARENCY_DEFAULTS));
	});

	it('gives a window that never gets more see-through as the opacity rises, and solid at 100', () => {
		for (const [text, surface] of [
			['#ffffff', '#14151e'],
			['#1c1b20', '#f2eff4'],
		] as const) {
			const alphas = [40, 55, 73, 88, 100].map((v) => windowAlpha(v, text, surface));
			expect(alphas).toEqual([...alphas].sort((a, b) => a - b));
			expect(alphas[alphas.length - 1]).toBe(1);
		}
	});
});

describe('alphaFloor', () => {
	it('finds the least opacity that keeps the text at 4.5:1 over the worst backdrop', () => {
		const floor = alphaFloor('#1c1b20', '#f2eff4')!;
		expect(floor).toBeGreaterThan(0);
		expect(floor).toBeLessThan(1);
		expect(contrast('#1c1b20', mix(BACKDROP_UNDER_LIGHT, '#f2eff4', floor))).toBeGreaterThanOrEqual(
			4.5,
		);
		expect(contrast('#1c1b20', mix(BACKDROP_UNDER_LIGHT, '#f2eff4', floor - 0.02))).toBeLessThan(
			4.5,
		);
	});

	it('is null for a colour it cannot read', () => {
		expect(alphaFloor('red', '#ffffff')).toBeNull();
	});
});

describe('windowAlpha', () => {
	it('keeps the panel opacity when it is above the floor and raises it when it is not', () => {
		const floor = alphaFloor('#ffffff', '#14151e')!;
		expect(windowAlpha(100, '#ffffff', '#14151e')).toBe(1);
		expect(windowAlpha(40, '#ffffff', '#14151e')).toBe(Math.max(0.4, floor));
		expect(windowAlpha(40, null, null)).toBe(FALLBACK_FLOOR);
	});
});

describe('windowSeeThrough', () => {
	const on = {
		enabled: true,
		glass: 'glass' as const,
		available: true,
		focused: true,
		solidWhenUnfocused: true,
	};

	it('lets the desktop through only when every guardrail allows it', () => {
		expect(windowSeeThrough(on)).toBe(true);
		expect(windowSeeThrough({ ...on, enabled: false })).toBe(false);
		expect(windowSeeThrough({ ...on, glass: 'solid' })).toBe(false);
		expect(windowSeeThrough({ ...on, available: null })).toBe(false);
		expect(windowSeeThrough({ ...on, available: false })).toBe(false);
		expect(windowSeeThrough({ ...on, focused: false })).toBe(false);
		expect(windowSeeThrough({ ...on, focused: false, solidWhenUnfocused: false })).toBe(true);
	});
});

// The real stylesheets from disk: Vitest swaps CSS for empty text when it is imported.
const SRC = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

describe('the glass tokens', () => {
	const tokens = read('theme/tokens.css');

	it('build the glass fill from the alpha and the filter from the blur and saturation', () => {
		expect(tokens).toMatch(/--fls-glass-tint-start\) calc\(var\(--fls-glass-alpha\) \* 100%\)/);
		expect(tokens).toContain(
			'--fls-glass-filter: blur(var(--fls-glass-blur)) saturate(var(--fls-glass-saturation));',
		);
		expect(tokens).not.toMatch(/--fls-glass-bg: linear-gradient\(145deg, rgb/);
	});

	it('force the inline values solid when transparency is reduced or colours are forced', () => {
		const forced = tokens.match(/--fls-glass-blur: 0px !important;/g) ?? [];
		expect(forced.length).toBe(3);
		expect(tokens.match(/--fls-glass-alpha: 1 !important;/g)?.length).toBe(3);
	});

	it('give each surface switch its rule', () => {
		for (const rule of [
			":root[data-fls-glass-docks='off']",
			":root[data-fls-glass-floating='off']",
			":root[data-fls-glass-menus='on']",
			":root[data-fls-glass-dialogs='on']",
			":root[data-fls-glass-title-bar='on']",
			":root[data-fls-window='see-through']",
		]) {
			expect(tokens).toContain(rule);
		}
	});
});

function moduleStylesheets(directory: string): Record<string, string> {
	const found: Record<string, string> = {};
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) Object.assign(found, moduleStylesheets(path));
		else if (entry.name.endsWith('.module.css'))
			found[path.slice(SRC.length + 1)] = readFileSync(path, 'utf8');
	}
	return found;
}

describe('the glass surfaces', () => {
	const SURFACES: Record<string, 'docks' | 'floating'> = {
		'panels/dock/DockZone.module.css': 'docks',
		'panels/dock/DockRail.module.css': 'docks',
		'panels/dock/PeekPanel.module.css': 'docks',
		'panels/float/FloatingPanel.module.css': 'floating',
		'tools/ToolPicker.module.css': 'floating',
		'commands/CommandPalette.module.css': 'floating',
	};

	it('each wear their own switch, with the WebKit prefix beside the filter', () => {
		for (const [file, surface] of Object.entries(SURFACES)) {
			const css = read(file);
			expect(css, file).toContain(`background: var(--fls-glass-${surface}-bg);`);
			expect(css, file).toContain(`-webkit-backdrop-filter: var(--fls-glass-${surface}-filter);`);
			expect(css, file).toContain(`\tbackdrop-filter: var(--fls-glass-${surface}-filter);`);
		}
	});

	it('leave no blur that ignores the settings', () => {
		for (const [file, css] of Object.entries(moduleStylesheets(SRC))) {
			expect(css, file).not.toMatch(/backdrop-filter:\s*blur\(/);
		}
	});
});
