// Tests for the context menu dispatcher: the menu's name for each target, and the key that opens it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { isContextMenuKey } from '../app/useContextMenu';
import { NO_FACTS } from './commandBridge';
import { buildContextMenu, capitalised, contextMenuLabel } from './contextMenuModel';
import type { ContextTarget } from './contextTargets';
import { allCommands } from './registry';

const thing = (kind: 'item' | 'cell', name: string) => ({
	kind,
	name,
	x: 1,
	y: 2,
	layer: kind === 'cell' ? ('tiles' as const) : ('objects' as const),
	index: 0,
	line: null,
});

describe('contextMenuLabel', () => {
	it('names the menu after what it is on', () => {
		const label = (target: ContextTarget) => contextMenuLabel(target);
		const cell = { x: 1, y: 2 };
		expect(
			label({ kind: 'canvas', cell, thing: thing('cell', 'grass'), inRect: false, line: null }),
		).toBe('Cell menu');
		expect(
			label({ kind: 'canvas', cell, thing: thing('item', 'gloop'), inRect: false, line: null }),
		).toBe('Gloop menu');
		expect(label({ kind: 'objectRow', thing: thing('item', 'cookie') })).toBe('Cookie menu');
		expect(label({ kind: 'layerRow', layer: 'treats' })).toBe('Treats layer menu');
		expect(label({ kind: 'panel', panel: 'script', where: 'header' })).toBe('Script menu');
		expect(label({ kind: 'scriptEditor', region: 'text', hasSelection: false })).toBe(
			'Script menu',
		);
		expect(label({ kind: 'scriptTab' })).toBe('Script tab menu');
		expect(
			label({ kind: 'textField', field: { hasSelection: false, hasText: false, readOnly: false } }),
		).toBe('Text menu');
	});

	it('capitalises the first letter only', () => {
		expect(capitalised('gloop')).toBe('Gloop');
		expect(capitalised('')).toBe('');
	});
});

describe('buildContextMenu', () => {
	it('returns rows for every target kind without throwing (the builders fill in later)', () => {
		const snapshot = { facts: NO_FACTS, handlers: {} };
		const targets: ContextTarget[] = [
			{ kind: 'layerRow', layer: 'treats' },
			{ kind: 'scriptTab' },
			{ kind: 'zoom' },
			{ kind: 'history' },
			{ kind: 'workspace' },
			{ kind: 'tools' },
		];
		for (const target of targets)
			expect(Array.isArray(buildContextMenu(target, snapshot))).toBe(true);
	});
});

describe('the keys that open the menu', () => {
	const key = (init: Partial<Parameters<typeof isContextMenuKey>[0]>) =>
		isContextMenuKey({ key: '', shiftKey: false, ctrlKey: false, altKey: false, ...init });
	it('is the Menu key and Shift+F10, and no other F10', () => {
		expect(key({ key: 'ContextMenu' })).toBe(true);
		expect(key({ key: 'F10', shiftKey: true })).toBe(true);
		expect(key({ key: 'F10' })).toBe(false);
		expect(key({ key: 'F10', shiftKey: true, ctrlKey: true })).toBe(false);
	});

	it('is a registry command with those keys, so the shortcuts card lists it', () => {
		const def = allCommands(NO_FACTS).find((command) => command.id === 'view.contextMenu');
		expect(def?.keys).toEqual([{ key: 'F10', shift: true }, { key: 'ContextMenu' }]);
	});
});
