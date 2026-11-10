// Tests that every surface's stylesheet paints with the token its governing setting drives, and that the tokens follow the switches
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLASS_SURFACES_TABLE } from './glassSurfaces';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const tokens = read('src/theme/tokens.css');

describe('the glass surfaces table', () => {
	it.each(GLASS_SURFACES_TABLE.flatMap((rule) => rule.files.map((file) => [rule, file] as const)))(
		'$0.surface paints with its token in $1',
		(rule, file) => {
			expect(read(file)).toContain(rule.token);
		},
	);

	it('has the strips, docks, floating things, menus and dialogs follow their own switch in the tokens', () => {
		expect(tokens).toMatch(
			/\[data-fls-glass-docks='off'\][^}]*--fls-glass-docks-bg: var\(--fls-glass-bg-solid\)/,
		);
		expect(tokens).toMatch(
			/\[data-fls-glass-floating='off'\][^}]*--fls-glass-floating-bg: var\(--fls-glass-bg-solid\)/,
		);
		expect(tokens).toMatch(/\[data-fls-glass-menus='on'\][^}]*--fls-menu-alpha/);
		expect(tokens).toMatch(
			/\[data-fls-glass-dialogs='on'\][^}]*--fls-dialog-opacity: var\(--fls-glass-alpha\)/,
		);
		expect(tokens).toMatch(
			/\[data-fls-glass-title-bar='on'\][^}]*--fls-title-bar-opacity: var\(--fls-glass-alpha\)/,
		);
	});

	it('draws the chrome strips with the title bar mix, so they are solid while the switch is off', () => {
		expect(tokens).toMatch(/--fls-chrome-strip-bg: color-mix\([^;]*--fls-title-bar-opacity/);
		expect(tokens).toMatch(/--fls-ribbon-bg: var\(--fls-chrome-strip-bg\)/);
		expect(tokens).toMatch(/:root \{[^}]*--fls-title-bar-opacity: 1;/);
	});

	it('leaves no surface stylesheet with a fixed fill where a token belongs', () => {
		const bare = /background(-color)?:\s*var\(--fls-bg-(chrome|raised)\)/;
		expect(read('src/app/AppToolbar.module.css')).not.toMatch(bare);
		expect(read('src/app/AppMenuBar.module.css')).not.toMatch(bare);
		const popup = read('src/panels/script/scriptTheme.ts');
		expect(popup).not.toMatch(/'\.cm-tooltip': \{[^}]*--fls-bg-raised/);
	});
});
