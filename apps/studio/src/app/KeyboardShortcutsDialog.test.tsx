// Tests for the Keyboard shortcuts dialog: its keys are the registry's, so they cannot drift
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { SHORTCUT_SOURCES, shortcutRows } from './KeyboardShortcutsDialog';

describe('shortcutRows', () => {
	it('gives every row keys read from the registry', () => {
		const rows = shortcutRows();
		expect(rows).toHaveLength(SHORTCUT_SOURCES.length);
		for (const row of rows) expect(row.keys, row.action).not.toBe('');
	});

	it('shows the keys the commands list', () => {
		const keys = Object.fromEntries(shortcutRows().map((row) => [row.action, row.keys]));
		expect(keys['shortcuts.save']).toBe('Ctrl+S');
		expect(keys['shortcuts.commandPalette']).toBe('Ctrl+Shift+P');
		expect(keys['shortcuts.zoomIn']).toBe('Ctrl+=');
		expect(keys['shortcuts.zoomFit']).toBe('Ctrl+0');
		expect(keys['shortcuts.tools']).toBe('B, E, I, S, T, Q');
	});
});
