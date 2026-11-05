// Guards the theme rules the owner set: sentence-case labels and colour literals only in tokens
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every stylesheet under `src`, read as plain text, keyed by its path. */
function stylesheets(dir: string, found: Record<string, string> = {}): Record<string, string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) stylesheets(path, found);
		else if (entry.name.endsWith('.css')) found[path] = readFileSync(path, 'utf8');
	}
	return found;
}

const sheets = stylesheets(join(import.meta.dirname, '..'));

describe('the stylesheets', () => {
	it('never set a title or label in capitals', () => {
		expect(Object.keys(sheets).length).toBeGreaterThan(5);
		for (const [name, css] of Object.entries(sheets)) {
			expect(css, name).not.toMatch(/text-transform:\s*uppercase/);
			expect(css, name).not.toMatch(/font-variant(-caps)?:\s*(all-)?small-caps/);
		}
	});

	it('keep colour literals in the token file', () => {
		const literal = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
		for (const [name, css] of Object.entries(sheets)) {
			if (name.endsWith('/theme/tokens.css') || name.endsWith('/canvas/LevelCanvas.module.css'))
				continue;
			expect(css.replace(/\/\*[\s\S]*?\*\//g, ''), name).not.toMatch(literal);
		}
	});
});
