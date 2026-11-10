// Tests for the script editor's context menu and the commands behind it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expectEveryItemHasIcon } from '@liminal-hq/fizz-studio-chrome/ContextMenu/expectEveryItemHasIcon';
import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { NO_FACTS, type BridgeSnapshot } from './commandBridge';
import { allCommands, paletteGroupOf, runCommand } from './registry';
import { scriptCommands } from './scriptCommands';
import { scriptMenuItems } from './scriptMenu';

const handlers = () =>
	Object.fromEntries(
		['script.copy', 'script.selectAll', 'script.find', 'script.foldAll', 'script.unfoldAll'].map(
			(id) => [id, vi.fn()],
		),
	);
const snapshot = (given: BridgeSnapshot['handlers'] = handlers()): BridgeSnapshot => ({
	facts: { ...NO_FACTS, editorOpen: true, hasLevel: true },
	handlers: given,
});
const labels = (items: MenuItem[]) =>
	items.map((item) => (item.type === 'separator' ? '-' : 'label' in item ? item.label : ''));

describe('scriptMenuItems', () => {
	it('is Copy and Select all, Find, then Fold all and Unfold all', () => {
		const items = scriptMenuItems(
			{ kind: 'scriptEditor', region: 'text', hasSelection: true },
			snapshot(),
		);
		expect(labels(items)).toEqual([
			'Copy',
			'Select all',
			'-',
			'Find',
			'-',
			'Fold all',
			'Unfold all',
		]);
		expectEveryItemHasIcon(items);
	});

	it('gives the line numbers the same menu as the text', () => {
		const text = scriptMenuItems(
			{ kind: 'scriptEditor', region: 'text', hasSelection: false },
			snapshot(),
		);
		const gutter = scriptMenuItems(
			{ kind: 'scriptEditor', region: 'gutter', hasSelection: false },
			snapshot(),
		);
		expect(labels(gutter)).toEqual(labels(text));
	});

	it('gives a hover tooltip Copy alone', () => {
		const items = scriptMenuItems(
			{ kind: 'scriptEditor', region: 'hover', hasSelection: true },
			snapshot(),
		);
		expect(labels(items)).toEqual(['Copy']);
	});

	it('dims Copy, with the reason, until something is selected', () => {
		const items = scriptMenuItems(
			{ kind: 'scriptEditor', region: 'text', hasSelection: false },
			snapshot(),
		);
		expect(items[0]).toMatchObject({
			id: 'script.copy',
			disabled: true,
			title: 'Select some of the script first.',
		});
		expect(items[1]).not.toHaveProperty('disabled');
	});

	it('shows CodeMirror’s own keys', () => {
		const items = scriptMenuItems(
			{ kind: 'scriptEditor', region: 'text', hasSelection: true },
			snapshot(),
		);
		const keys = Object.fromEntries(
			items.flatMap((item) => ('shortcut' in item ? [[item.id, item.shortcut]] : [])),
		);
		expect(keys).toMatchObject({
			'script.copy': 'Ctrl+C',
			'script.selectAll': 'Ctrl+A',
			'script.find': 'Ctrl+F',
			'script.foldAll': 'Ctrl+Alt+[',
			'script.unfoldAll': 'Ctrl+Alt+]',
		});
	});

	it('dims every row while the Script panel has published nothing', () => {
		const items = scriptMenuItems(
			{ kind: 'scriptEditor', region: 'text', hasSelection: true },
			snapshot({}),
		);
		const rows = items.filter((item) => item.type === 'action');
		expect(rows.length).toBe(5);
		for (const item of rows) expect(item).toMatchObject({ disabled: true });
	});
});

describe('the script commands', () => {
	it('each have a label, an icon and a palette group, and show only with the editor open', () => {
		for (const def of scriptCommands()) {
			expect(def.label).toBeTruthy();
			expect(def.icon).toBeTruthy();
			expect(paletteGroupOf(def)).toBe('edit');
			expect(def.visible?.(NO_FACTS)).toBe(false);
			expect(def.visible?.({ ...NO_FACTS, editorOpen: true })).toBe(true);
		}
	});

	it('are in the registry, and run the handler the Script panel published', () => {
		const given = handlers();
		const now = snapshot(given);
		const ids = allCommands(now.facts).map((def) => def.id);
		for (const id of Object.keys(given)) expect(ids).toContain(id);
		expect(runCommand('script.foldAll', now)).toBe(true);
		expect(given['script.foldAll']).toHaveBeenCalledOnce();
	});
});
