// Tests for the command registry and the menu it builds: ids, labels, enabled states and sections
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { describe, expect, it, vi } from 'vitest';
import { APP_ICONS } from '../icons/AppIcons';
import { enMessages } from '../i18n/messages';
import { PANEL_SPECS } from '../panels/float/panelSpecs';

const openWindow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../services/windowsClient', () => ({ openWindow }));

import { appMenuItems, APP_MENU_MNEMONICS } from './appMenuModel';
import { createCommandBridge, NO_FACTS, type BridgeSnapshot } from './commandBridge';
import {
	COMMANDS,
	PALETTE_COMMANDS,
	PALETTE_GROUPS,
	allCommands,
	brushCommandId,
	brushCommands,
	commandLabel,
	dockBackCommandId,
	paletteGroupOf,
	runCommand,
	tearOffCommandId,
	toolCommandId,
	viewOf,
} from './registry';
import { paletteEntries } from './paletteModel';
import { TOOL_IDS } from '../tools/tool';

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

	it('lists Show the level only in the View menu with the Tab key, checked while it is on', () => {
		const handlers = { 'view.levelFirst': () => {} };
		const rows = rowsOf(
			appMenuItems(snapshot({ editorOpen: true, levelFirst: true }, handlers)),
			'menu:view',
		);
		const row = rows.find((item) => 'label' in item && item.label === 'Show the level only');
		expect(row).toMatchObject({ shortcut: 'Tab', checked: true });
		const off = rowsOf(appMenuItems(snapshot({ editorOpen: false }, handlers)), 'menu:view');
		expect(
			off.find((item) => 'label' in item && item.label === 'Show the level only'),
		).toHaveProperty('disabled', true);
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

	it('always enables Quit, with its shortcut', () => {
		const items = appMenuItems(snapshot({}, {}));
		const quit = rowsOf(items, 'menu:file').find((item) => item.id === 'file.quit');
		expect(quit).toMatchObject({ label: 'Quit', shortcut: 'Ctrl+Q' });
		expect(quit).not.toHaveProperty('disabled');
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

	it('puts every menu command in exactly one of the five menus', () => {
		const names = ['file', 'edit', 'view', 'window', 'help'];
		for (const command of COMMANDS) expect(names, command.id).toContain(command.menu);
		for (const command of allCommands(NO_FACTS).filter((def) => def.menu)) {
			expect(names, command.id).toContain(command.menu);
		}
		const rows = appMenuItems(snapshot({ editorOpen: true, hasLevel: true })).flatMap((menu) =>
			menu.type === 'submenu'
				? menu.items.filter((row) => row.type !== 'separator').map((row) => row.id)
				: [],
		);
		expect(new Set(rows).size).toBe(rows.length);
	});

	it('arranges File, Edit, View, Window and Help with rules between sections', () => {
		const items = appMenuItems(snapshot({ editorOpen: true }));
		expect(items.map((item) => (item.type === 'submenu' ? item.label : null))).toEqual([
			'File',
			'Edit',
			'View',
			'Window',
			'Help',
		]);
		expect(Object.values(APP_MENU_MNEMONICS)).toEqual(items.map((item) => item.id));
		expect(Object.keys(APP_MENU_MNEMONICS)).toEqual(['f', 'e', 'v', 'w', 'h']);
		const file = rowsOf(items, 'menu:file');
		expect(file.map((item) => (item.type === 'separator' ? '-' : item.id))).toEqual([
			'file.new',
			'file.open',
			'-',
			'file.save',
			'-',
			'file.preferences',
			'-',
			'file.close',
			'file.quit',
		]);
		expect(file.find((item) => item.id === 'file.preferences')).toMatchObject({
			label: 'Preferences…',
			shortcut: 'Ctrl+,',
		});
		expect(rowsOf(items, 'menu:help')).toMatchObject([
			{ id: 'help.about', label: 'About Fizz Level Studio' },
		]);
	});

	it('lists a Tear off row for each panel in the Window menu, and Dock back for one that is away', () => {
		const ids = (facts: Partial<BridgeSnapshot['facts']>) =>
			rowsOf(appMenuItems(snapshot(facts)), 'menu:window').map((row) => row.id);
		expect(ids({ editorOpen: true })).toEqual(PANEL_SPECS.map((spec) => tearOffCommandId(spec.id)));
		const away = ids({ editorOpen: true, away: { ...NO_FACTS.away, script: true } });
		expect(away).toContain(dockBackCommandId('script'));
		expect(away).not.toContain(tearOffCommandId('script'));
	});

	it('hides the Window rows on the start screen, and the Window menu with them', () => {
		const items = appMenuItems(snapshot());
		expect(items.map((item) => item.id)).toEqual([
			'menu:file',
			'menu:edit',
			'menu:view',
			'menu:help',
		]);
		// Edit and View keep their rows, disabled.
		expect(rowsOf(items, 'menu:edit').length).toBeGreaterThan(0);
		expect(rowsOf(items, 'menu:view').length).toBeGreaterThan(0);
		const withEditor = appMenuItems(snapshot({ editorOpen: true }));
		expect(withEditor.map((item) => item.id)).toContain('menu:window');
		// The palette does not offer them either.
		const entries = paletteEntries(snapshot());
		expect(entries.some((entry) => entry.id.endsWith('.tearOff'))).toBe(false);
	});

	it('runs Preferences and About by opening their windows, and others through handlers', () => {
		expect(runCommand('file.preferences', snapshot())).toBe(true);
		expect(openWindow).toHaveBeenCalledWith({ kind: 'preferences' });
		expect(runCommand('help.about', snapshot())).toBe(true);
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

describe('the palette additions', () => {
	const facts = {
		hasLevel: true,
		editorOpen: true,
		brushes: [
			{ group: 'tile', kind: 'block' },
			{ group: 'enemy', kind: 'gloop' },
		] as const,
		lineCount: 30,
	};

	it('adds Command palette… to the View menu with its keys', () => {
		const view = rowsOf(appMenuItems(snapshot()), 'menu:view');
		expect(view.find((item) => item.id === 'view.commandPalette')).toMatchObject({
			label: 'Command palette…',
			shortcut: 'Ctrl+Shift+P',
		});
	});

	it('leaves the menus alone: palette-only commands have no menu', () => {
		for (const command of PALETTE_COMMANDS) expect(command.menu).toBeUndefined();
		const rows = appMenuItems(snapshot(facts)).flatMap((menu) =>
			menu.type === 'submenu' ? menu.items.map((row) => row.id ?? '') : [],
		);
		expect(rows.some((id) => id.startsWith('tool.') || id.startsWith('brush.'))).toBe(false);
	});

	it('has a tool command per tool and takes every label from the catalogue', () => {
		for (const tool of TOOL_IDS) {
			expect(PALETTE_COMMANDS.some((command) => command.id === toolCommandId(tool))).toBe(true);
		}
		for (const command of allCommands(snapshot(facts).facts)) {
			expect(enMessages).toHaveProperty(command.label);
		}
	});

	it('has unique ids across the menu, the palette and the brushes', () => {
		const ids = allCommands(snapshot(facts).facts).map((command) => command.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('names a brush command after its word and runs it through its handler', () => {
		const [tile] = brushCommands(facts.brushes);
		expect(commandLabel(tile!)).toBe('Brush: block');
		const choose = vi.fn();
		const id = brushCommandId({ group: 'enemy', kind: 'gloop' });
		expect(id).toBe('brush.enemy.gloop');
		expect(runCommand(id, snapshot(facts, { [id]: choose }))).toBe(true);
		expect(choose).toHaveBeenCalledOnce();
		expect(runCommand(id, snapshot({ ...facts, editorOpen: false }, { [id]: choose }))).toBe(false);
	});

	it('passes the asked-for value to Go to line, and needs lines to go to', () => {
		const go = vi.fn();
		expect(runCommand('goto.line', snapshot(facts, { 'goto.line': go }), '7')).toBe(true);
		expect(go).toHaveBeenCalledWith('7');
		expect(runCommand('goto.line', snapshot({ ...facts, lineCount: 0 }, { 'goto.line': go }))).toBe(
			false,
		);
	});

	it('groups the entries in the palette order with panels under Panels', () => {
		const entries = paletteEntries(snapshot(facts));
		const groups = entries.map((entry) => entry.group);
		const order = groups.map((group) => PALETTE_GROUPS.indexOf(group));
		expect(order).toEqual([...order].sort((a, b) => a - b));
		const panel = entries.find((entry) => entry.id === 'view.panel.script')!;
		expect(panel.group).toBe('panels');
		expect(panel.label).toBe('Show Script');
		expect(
			paletteEntries(snapshot({ ...facts, panels: { ...NO_FACTS.panels, script: true } })).find(
				(entry) => entry.id === 'view.panel.script',
			)?.label,
		).toBe('Hide Script');
		expect(entries.find((entry) => entry.id === 'view.resetLayout')?.group).toBe('panels');
		expect(paletteGroupOf(COMMANDS.find((c) => c.id === 'file.save')!)).toBe('file');
	});

	it('lists every command, never the opener, and dims what cannot run with a reason', () => {
		const entries = paletteEntries(snapshot({ hasLevel: false, editorOpen: false }));
		expect(entries.some((entry) => entry.id === 'view.commandPalette')).toBe(false);
		const save = entries.find((entry) => entry.id === 'file.save')!;
		expect(save).toMatchObject({ enabled: false, reason: 'Open a level first' });
		const quit = entries.find((entry) => entry.id === 'file.quit')!;
		expect(quit).toMatchObject({ enabled: true, shortcut: 'Ctrl+Q' });
		expect(entries.find((entry) => entry.id === 'help.about')?.enabled).toBe(true);
	});
});

describe('Tear off and Dock back', () => {
	it('offers Tear off for each panel in the main window and Dock back for each away', () => {
		const here = allCommands(NO_FACTS);
		for (const spec of PANEL_SPECS) {
			expect(here.some((def) => def.id === tearOffCommandId(spec.id))).toBe(true);
			expect(here.some((def) => def.id === dockBackCommandId(spec.id))).toBe(false);
		}
		const away = allCommands({ ...NO_FACTS, away: { ...NO_FACTS.away, script: true } });
		expect(away.some((def) => def.id === dockBackCommandId('script'))).toBe(true);
		expect(away.some((def) => def.id === tearOffCommandId('script'))).toBe(false);
	});

	it('names the panel in the label and lists them under Panels', () => {
		const def = allCommands(NO_FACTS).find((d) => d.id === tearOffCommandId('objects'))!;
		expect(commandLabel(def)).toBe('Tear off Objects');
		expect(paletteGroupOf(def)).toBe('panels');
		const back = allCommands({ ...NO_FACTS, away: { ...NO_FACTS.away, history: true } }).find(
			(d) => d.id === dockBackCommandId('history'),
		)!;
		expect(commandLabel(back)).toBe('Dock History back');
	});

	it('runs through the editor’s handler and only while the editor is open', () => {
		const run = vi.fn();
		const id = tearOffCommandId('palette');
		expect(runCommand(id, snapshot({}, { [id]: run }))).toBe(false);
		expect(runCommand(id, snapshot({ editorOpen: true }, { [id]: run }))).toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
	});
});

describe('the menu icons', () => {
	const everything = (facts: Partial<BridgeSnapshot['facts']>) =>
		allCommands({
			...NO_FACTS,
			...facts,
			brushes: [{ group: 'tile', kind: 'block' }],
			away: { ...NO_FACTS.away, script: true },
		});

	// A palette-only command has no `menu`; every command that has one has a row, so an icon.
	it('gives every command with a menu row an icon the icon set draws', () => {
		for (const away of [false, true]) {
			const defs = everything({ away: { ...NO_FACTS.away, script: away } }).filter((d) => d.menu);
			expect(defs.length).toBeGreaterThan(20);
			for (const def of defs) {
				expect(def.icon, def.id).toBeDefined();
				expect(APP_ICONS, def.id).toHaveProperty(def.icon!);
			}
		}
		for (const def of COMMANDS) expect(def.icon, def.id).toBeDefined();
	});

	it('leaves the palette-only commands without one', () => {
		for (const def of PALETTE_COMMANDS) expect(def.menu).toBeUndefined();
	});

	it('puts an icon on every row and menu of the app menu', () => {
		const items = appMenuItems(snapshot({ editorOpen: true, hasLevel: true }));
		const without = (rows: MenuItem[]): string[] =>
			rows.flatMap((row) => {
				if (row.type === 'separator' || row.type === 'section') return [];
				const own = row.icon ? [] : [row.id];
				return row.type === 'submenu' ? [...own, ...without(row.items)] : own;
			});
		expect(without(items)).toEqual([]);
	});

	it('reuses the rail icons for the panel rows', () => {
		const view = rowsOf(appMenuItems(snapshot({ editorOpen: true })), 'menu:view');
		const row = view.find((item) => item.id === 'view.panel.script');
		expect(row).toMatchObject({ type: 'checkbox' });
		expect(row && 'icon' in row && row.icon).toBeTruthy();
	});
});
