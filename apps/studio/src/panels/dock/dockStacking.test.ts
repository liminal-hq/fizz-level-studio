// Tests for the stacking contract of the editor area: dock hints lie under every floating panel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// jsdom does not lay out or paint, so the contract is read from the two stylesheets that set it. The
// running app's check (`tools/app-checks/run.ts`) measures the same thing in a real drag.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const panels = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(panels, path), 'utf8');

/** The `z-index` value written in the first rule for `selector`. */
function zIndex(css: string, selector: string): string {
	const match = new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css);
	const z = /z-index:\s*([^;]+);/.exec(match?.[1] ?? '');
	if (!z) throw new Error(`no z-index in ${selector}`);
	return z[1]!.trim();
}

describe('the editor area’s stacking', () => {
	const shell = read('dock/DockShell.module.css');
	const floating = read('float/FloatingPanel.module.css');

	// A floating panel's own `--fls-float-z` is any whole number from 0, set inline by the model.
	const floatAt = (z: number) => {
		const value = zIndex(floating, '.panel');
		const calc = /^calc\(var\(--fls-float-z\) \+ (\d+)\)$/.exec(value);
		if (calc) return z + Number(calc[1]);
		if (value === 'var(--fls-float-z)') return z;
		throw new Error(`unexpected z-index ${value}`);
	};

	it('puts the drop hints above the docks and below even the lowest floating panel', () => {
		const level = Number(zIndex(shell, '.level'));
		const slot = Number(zIndex(shell, '.slot'));
		const drop = Number(zIndex(shell, '.drop'));
		expect(level).toBeLessThan(slot);
		expect(slot).toBeLessThan(drop);
		// The panel with z 0 is the lowest it can be; the dragged one is raised above the others.
		expect(drop).toBeLessThan(floatAt(0));
	});

	it('keeps a floating panel above the hints however many are raised', () => {
		const drop = Number(zIndex(shell, '.drop'));
		for (const z of [0, 1, 7, 500, 4_000_000_000]) expect(floatAt(z)).toBeGreaterThan(drop);
	});

	it('never lets the hints take the pointer, so a floating panel stays under it', () => {
		const rule = /(?:^|\n)\.drop \{([^}]*)\}/.exec(shell)?.[1] ?? '';
		expect(rule).toMatch(/pointer-events:\s*none/);
	});
});
