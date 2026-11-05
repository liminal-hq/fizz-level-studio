// Tests for the command registry and the menu it builds: ids, labels, enabled states and sections
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { describe, expect, it, vi } from 'vitest';
import { enMessages } from '../i18n/messages';
import { PANEL_SPECS } from '../panels/float/panelSpecs';

const openWindow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../services/windowsClient', () => ({ openWindow }));

import { appMenuItems, APP_MENU_MNEMONICS } from './appMenuModel';
import { createCommandBridge, NO_FACTS, type BridgeSnapshot } from './commandBridge';
import { COMMANDS, runCommand, viewOf } from './registry';

const snapshot = (
	facts: Partial<BridgeSnapshot['facts']> = {},
	handlers: BridgeSnapshot['handlers'] = {},
): BridgeSnapshot => ({ facts: { ...NO_FACTS, ...facts }, handlers });

const rowsOf = (items: MenuItem[], menu: string): MenuItem[] => {
	const found = items.find((item) => item.id === menu);
	return found?.type === 'submenu' ? found.items : [];
};

describe('the registry', () => {
	it('has unique ids', () => {
		const ids = COMMANDS.map((command) => command.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('takes every label and reason from the catalogue', () => {
		for (const command of COMMANDS) {
			expect(enMessages, command.id).toHaveProperty(command.label);
			if (command.unavailable) expect(enMessages).toHaveProperty(command.unavailable);
		}
	});

	it('lists a panel row for every panel', () => {
		for (const spec of PANEL_SPECS) {
			expect(COMMANDS.some((command) => command.id === `view.panel.${spec.id}`)).toBe(true);
		}
	});

	it('enables the level commands only with a level open and a handler', () => {
		const handlers = { 'file.save': () => {}, 'file.close': () => {} };
		const save = COMMANDS.find((command) => command.id === 'file.save')!;
		expect(viewOf(save, snapshot({}, handlers)).enabled).toBe(false);
		expect(viewOf(save, snapshot({ hasLevel: true }, handlers)).enabled).toBe(true);
		expect(viewOf(save, snapshot({ hasLevel: true })).enabled).toBe(false);
	});

	it('enables Undo and Redo from the editor facts', () => {
		const handlers = { 'edit.undo': () => {}, 'edit.redo': () => {} };
		const items = appMenuItems(snapshot({ canUndo: true }, handlers));
		const [undo, redo] = rowsOf(items, 'menu:edit');
		expect(undo).toMatchObject({ label: 'Undo', shortcut: 'Ctrl+Z' });
		expect(undo).not.toHaveProperty('disabled');
		expect(redo).toMatchObject({ label: 'Redo', disabled: true });
	});

	it('never enables Quit, and says why', () => {
		const items = appMenuItems(snapshot({ hasLevel: true }, { 'file.quit': () => {} }));
		const quit = rowsOf(items, 'menu:file').find((item) => item.id === 'file.quit');
		expect(quit).toMatchObject({ disabled: true, title: expect.stringContaining('not available') });
		expect(runCommand('file.quit', snapshot({}, { 'file.quit': () => {} }))).toBe(false);
	});

	it('checks the panel rows from the panels shown', () => {
		const panels = { ...NO_FACTS.panels, script: true };
		const items = appMenuItems(snapshot({ editorOpen: true, panels }, {}));
		const view = rowsOf(items, 'menu:view');
		expect(view.find((item) => item.id === 'view.panel.script')).toMatchObject({ checked: true });
		expect(view.find((item) => item.id === 'view.panel.palette')).toMatchObject({
			checked: false,
		});
	});

	it('arranges File, Edit, View and Window with rules between sections', () => {
		const items = appMenuItems(snapshot());
		expect(items.map((item) => (item.type === 'submenu' ? item.label : null))).toEqual([
			'File',
			'Edit',
			'View',
			'Window',
		]);
		expect(Object.values(APP_MENU_MNEMONICS)).toEqual(items.map((item) => item.id));
		expect(rowsOf(items, 'menu:file').filter((item) => item.type === 'separator')).toHaveLength(2);
		const window = rowsOf(items, 'menu:window');
		expect(window).toMatchObject([
			{ label: 'Preferences…', shortcut: 'Ctrl+,' },
			{ label: 'About' },
		]);
	});

	it('runs Preferences and About by opening their windows, and others through handlers', () => {
		expect(runCommand('window.preferences', snapshot())).toBe(true);
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
		expect(runCommand('window.about', snapshot())).toBe(true);
		expect(openWindow).toHaveBeenCalledWith({ kind: 'about' });
		const save = vi.fn();
		expect(runCommand('file.save', snapshot({ hasLevel: true }, { 'file.save': save }))).toBe(true);
		expect(save).toHaveBeenCalledOnce();
		expect(runCommand('file.save', snapshot({}, { 'file.save': save }))).toBe(false);
	});
});

describe('the bridge', () => {
	it('tells listeners only when something changed', () => {
		const bridge = createCommandBridge();
		const listener = vi.fn();
		bridge.subscribe(listener);
		bridge.setFacts({ canUndo: false });
		expect(listener).not.toHaveBeenCalled();
		bridge.setFacts({ canUndo: true });
		expect(listener).toHaveBeenCalledOnce();
	});

	it('removes only the handlers it added', () => {
		const bridge = createCommandBridge();
		const remove = bridge.setHandlers({ a: () => {} });
		bridge.setHandlers({ b: () => {} });
		remove();
		expect(Object.keys(bridge.getSnapshot().handlers)).toEqual(['b']);
	});
});
