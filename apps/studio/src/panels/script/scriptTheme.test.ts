// Tests for the script editor's fills: they follow the panel transparency switches, not a fixed colour
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scriptTheme } from './scriptTheme';

const src = join(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(src, path), 'utf8');

/** The declarations of the rule for `selector` that sets an editor token (there can be several rules). */
function rule(css: string, selector: string): string {
	let from = 0;
	for (;;) {
		const start = css.indexOf(`${selector} {`, from);
		if (start < 0) throw new Error(`no editor rule for ${selector}`);
		const body = css.slice(start, css.indexOf('}', start));
		if (body.includes('--fls-editor')) return body;
		from = start + 1;
	}
}

let view: EditorView | null = null;
afterEach(() => {
	view?.destroy();
	view = null;
});

describe('the script editor theme', () => {
	it('fills the editor, its gutters and its panels from the editor tokens, not from a fixed token', () => {
		view = new EditorView({
			parent: document.body,
			state: EditorState.create({ doc: '', extensions: [scriptTheme] }),
		});
		const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
		expect(css).toContain('var(--fls-editor-bg, var(--fls-bg-content))');
		expect(css).toContain('var(--fls-editor-gutter-bg, var(--fls-bg-window))');
		// The active line, selection and search highlights are translucent washes, so they stay legible over glass.
		expect(css).toMatch(
			/\.cm-activeLine[^}]*color-mix\(in srgb, var\(--fls-accent\) 8%, transparent\)/,
		);
	});
});

describe('the editor tokens', () => {
	const tokens = read('theme/tokens.css');

	it('are clear over glass and solid when the dock or floating switch is off', () => {
		const root = rule(tokens, ':root');
		expect(root).toContain('--fls-editor-docks-bg: transparent');
		expect(root).toContain('--fls-editor-floating-bg: transparent');
		expect(rule(tokens, ":root[data-fls-glass-docks='off']")).toContain(
			'--fls-editor-docks-bg: var(--fls-bg-content)',
		);
		expect(rule(tokens, ":root[data-fls-glass-floating='off']")).toContain(
			'--fls-editor-floating-bg: var(--fls-bg-content)',
		);
	});

	it('are solid by default, for a torn-off window, and picked by the glass hosts', () => {
		expect(rule(tokens, ':root')).toContain('--fls-editor-bg: var(--fls-bg-content)');
		expect(rule(read('panels/dock/DockZone.module.css'), '.zone')).toContain(
			'--fls-editor-bg: var(--fls-editor-docks-bg)',
		);
		expect(rule(read('panels/dock/PeekPanel.module.css'), '.peek')).toContain(
			'--fls-editor-bg: var(--fls-editor-docks-bg)',
		);
		expect(rule(read('panels/float/FloatingPanel.module.css'), '.panel')).toContain(
			'--fls-editor-bg: var(--fls-editor-floating-bg)',
		);
	});
});
