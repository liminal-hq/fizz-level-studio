// Tests that the app shell is never scrollable: the root styles that keep a reveal from moving it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(src, path), 'utf8');

/** Every declaration block whose selector list is exactly `selectors`, in file order. */
function blocks(css: string, selectors: string): string[] {
	const found: string[] = [];
	const pattern = /([^{}]+)\{([^{}]*)\}/g;
	for (let m = pattern.exec(css); m; m = pattern.exec(css)) {
		const list = m[1]!
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.split(',')
			.map((part) => part.trim())
			.join(',');
		if (list === selectors) found.push(m[2]!);
	}
	return found;
}

describe('the root styles', () => {
	const tokens = read('theme/tokens.css');

	it('fill the window and do not let the page scroll', () => {
		const all = blocks(tokens, 'html,body,#root').join('\n');
		expect(all).toMatch(/height:\s*100%/);
		expect(all).toMatch(/overflow:\s*hidden/);
	});

	it('make body and #root clip, which a script cannot scroll, as the last word', () => {
		const last = blocks(tokens, 'body,#root').at(-1) ?? '';
		expect(last).toMatch(/overflow:\s*clip/);
		expect(tokens.lastIndexOf('overflow: clip')).toBeGreaterThan(
			tokens.indexOf('html,\nbody,\n#root'),
		);
	});

	it('clip the editor area and the Preferences window, which the shell holds', () => {
		expect(blocks(read('app/EditorScreen.module.css'), '.body').join('')).toMatch(
			/overflow:\s*clip/,
		);
		expect(blocks(read('preferences/PreferencesScreen.module.css'), '.screen').join('')).toMatch(
			/overflow:\s*clip/,
		);
	});
});
