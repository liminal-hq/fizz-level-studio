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

import {
	appMenuItems,
	APP_MENU_MNEMONICS,
	commandIdOfRow,
	HISTORY_MORE_ID,
	HISTORY_EMPTY_ID,
	HISTORY_REDO_ID,
	HISTORY_UNDO_ID,
	menuSections,
} from './appMenuModel';
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
		}
	});

	it('takes every reason from the catalogue', () => {
		const states = [
			NO_FACTS,
			{ ...NO_FACTS, hasLevel: true, editorOpen: true },
			{ ...NO_FACTS, hasLevel: true, editorOpen: true, maximised: 'script' as const },
		];
		for (const command of COMMANDS) {
			for (const facts of states) {
				const reason = command.reason?.(facts);
				if (reason) expect(enMessages, command.id).toHaveProperty(reason);
			}
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
		expect(row).not.toHaveProperty('disabled');
	});

	it('hides the editor rows on the start screen instead of disabling them', () => {
		const handlers = { 'view.levelFirst': () => {}, 'view.resetLayout': () => {} };
		const start = rowsOf(appMenuItems(snapshot({ editorOpen: false }, handlers)), 'menu:view');
		expect(start.map((item) => item.id)).toEqual(['view.commandPalette']);
	});

	it('disables a visible row with a reason worked out from the facts', () => {
		const handlers = { 'view.levelFirst': () => {}, 'edit.undo': () => {}, 'edit.redo': () => {} };
		const maximised = rowsOf(
			appMenuItems(snapshot({ editorOpen: true, maximised: 'script' }, handlers)),
			'menu:view',
		);
		expect(maximised.find((item) => item.id === 'view.levelFirst')).toMatchObject({
			disabled: true,
			title: 'Restore the maximised panel first',
		});
		const edit = (facts: Partial<BridgeSnapshot['facts']>) =>
			rowsOf(appMenuItems(snapshot(facts, handlers)), 'menu:edit');
		// No level: Undo says to open one; with a level and nothing to undo it says that instead.
		expect(edit({}).find((item) => item.id === 'edit.undo')).toMatchObject({
			disabled: true,
			title: 'Open a level first',
		});
		expect(
			edit({ hasLevel: true, editorOpen: true }).find((item) => item.id === 'edit.redo'),
		).toMatchObject({ disabled: true, title: 'Nothing to redo' });
		const enabled = edit({ hasLevel: true, editorOpen: true, canUndo: true }).find(
			(item) => item.id === 'edit.undo',
		);
		expect(enabled).not.toHaveProperty('disabled');
		expect(enabled).not.toHaveProperty('title');
	});

	it('tells visible from enabled on a command view', () => {
		const maximise = allCommands(NO_FACTS).find((def) => def.id === 'view.maximise.script')!;
		const here = snapshot({ editorOpen: true }, { 'view.maximise.script': () => {} });
		expect(viewOf(maximise, here)).toMatchObject({
			visible: true,
			enabled: false,
			reason: 'Show the panel first',
		});
		const shown = snapshot(
			{ editorOpen: true, panels: { ...NO_FACTS.panels, script: true } },
			{ 'view.maximise.script': () => {} },
		);
		expect(viewOf(maximise, shown)).toMatchObject({ visible: true, enabled: true });
		expect(viewOf(maximise, shown).reason).toBeUndefined();
		// Off the editor, and while the panel is maximised (its Restore row shows instead), it is not visible.
		expect(viewOf(maximise, snapshot()).visible).toBe(false);
		expect(viewOf(maximise, snapshot({ editorOpen: true, maximised: 'script' })).visible).toBe(
			false,
		);
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

	it('arranges File, Edit, View, Window and Help in groups with one rule between them', () => {
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
		const shape = (menu: string) =>
			rowsOf(items, menu).map((item) => (item.type === 'separator' ? '-' : item.id));
		expect(shape('menu:file')).toEqual([
			'file.new',
			'file.open',
			'-',
			'file.save',
			'file.close',
			'-',
			'file.preferences',
			'-',
			'file.quit',
		]);
		expect(shape('menu:edit')).toEqual(['edit.undo', 'edit.redo', 'menu:history']);
		expect(shape('menu:view')).toEqual([
			...PANEL_SPECS.map((spec) => `view.panel.${spec.id}`),
			'-',
			...PANEL_SPECS.filter((spec) => spec.expandable).map((spec) => `view.maximise.${spec.id}`),
			'view.levelFirst',
			'view.resetLayout',
			'-',
			'view.commandPalette',
		]);
		expect(shape('menu:help')).toEqual(['help.help', 'help.shortcuts', '-', 'help.about']);
		expect(rowsOf(items, 'menu:file').find((item) => item.id === 'file.preferences')).toMatchObject(
			{
				label: 'Preferences…',
				shortcut: 'Ctrl+,',
			},
		);
	});

	it('puts an ellipsis on the rows that open a dialog or a window, and on no plain action', () => {
		const items = appMenuItems(snapshot({ editorOpen: true, hasLevel: true }));
		const labels = (menu: string) =>
			Object.fromEntries(
				rowsOf(items, menu).flatMap((item) =>
					'label' in item && item.type !== 'submenu' ? [[item.id, item.label]] : [],
				),
			);
		const file = labels('menu:file');
		expect(file['file.new']).toBe('New level…');
		expect(file['file.open']).toBe('Open level…');
		expect(file['file.preferences']).toBe('Preferences…');
		expect(file['file.save']).toBe('Save');
		expect(file['file.close']).toBe('Close level');
		expect(file['file.quit']).toBe('Quit');
		expect(labels('menu:view')['view.commandPalette']).toBe('Command palette…');
		expect(labels('menu:help')).toMatchObject({
			'help.help': 'Help',
			'help.shortcuts': 'Keyboard shortcuts…',
			'help.about': 'About Fizz Level Studio…',
		});
	});

	it('shows the new File and Help keys on their rows', () => {
		const items = appMenuItems(snapshot({ editorOpen: true, hasLevel: true }));
		const shortcut = (menu: string, id: string) => {
			const row = rowsOf(items, menu).find((item) => item.id === id);
			return row && 'shortcut' in row ? row.shortcut : undefined;
		};
		expect(shortcut('menu:file', 'file.new')).toBe('Ctrl+N');
		expect(shortcut('menu:file', 'file.open')).toBe('Ctrl+O');
		expect(shortcut('menu:file', 'file.close')).toBe('Ctrl+W');
		expect(shortcut('menu:help', 'help.help')).toBe('F1');
		expect(shortcut('menu:help', 'help.shortcuts')).toBe('?');
	});

	it('collapses an empty group and its rule, and a menu with no rows', () => {
		const a: MenuItem = { type: 'action', id: 'a', label: 'A' };
		const b: MenuItem = { type: 'action', id: 'b', label: 'B' };
		const kinds = (items: MenuItem[]) => items.map((item) => item.type);
		expect(kinds(menuSections([a], [], [b]))).toEqual(['action', 'separator', 'action']);
		expect(kinds(menuSections([], [a], [], []))).toEqual(['action']);
		expect(menuSections([], [])).toEqual([]);
		// The View menu's panel group is hidden on the start screen, so no rule is left at its top.
		const start = rowsOf(appMenuItems(snapshot()), 'menu:view');
		expect(start.map((item) => item.type)).toEqual(['action']);
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
		// Edit keeps Undo and Redo, disabled; View keeps the command palette.
		expect(rowsOf(items, 'menu:edit').length).toBeGreaterThan(0);
		expect(rowsOf(items, 'menu:view').map((row) => row.id)).toEqual(['view.commandPalette']);
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
		openWindow.mockClear();
		expect(runCommand('help.help', snapshot())).toBe(true);
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

describe('the palette and visibility', () => {
	it('does not offer a hidden command, and keeps the reason of a disabled one', () => {
		const start = paletteEntries(snapshot());
		expect(start.some((entry) => entry.id === 'view.panel.script')).toBe(false);
		expect(start.some((entry) => entry.id === 'view.resetLayout')).toBe(false);
		expect(start.some((entry) => entry.id.startsWith('view.maximise'))).toBe(false);
		expect(start.find((entry) => entry.id === 'edit.undo')).toMatchObject({
			enabled: false,
			reason: 'Open a level first',
		});
		const editor = paletteEntries(
			snapshot({ hasLevel: true, editorOpen: true, maximised: 'script' }),
		);
		expect(editor.some((entry) => entry.id === 'view.panel.script')).toBe(true);
		// While Script is maximised its Restore row is offered and its Maximise row is hidden.
		expect(editor.some((entry) => entry.id === 'view.restore.script')).toBe(true);
		expect(editor.some((entry) => entry.id === 'view.maximise.script')).toBe(false);
		expect(editor.find((entry) => entry.id === 'view.levelFirst')).toMatchObject({
			enabled: false,
			reason: 'Restore the maximised panel first',
		});
	});

	it('offers the new Help commands with their keys', () => {
		const entries = paletteEntries(snapshot());
		expect(entries.find((entry) => entry.id === 'help.help')).toMatchObject({
			group: 'help',
			shortcut: 'F1',
		});
		expect(entries.find((entry) => entry.id === 'help.shortcuts')).toMatchObject({
			group: 'help',
			shortcut: '?',
			// Nothing has published a handler for it yet, so it is listed and dimmed.
			enabled: false,
		});
	});
});

describe('the Undo history submenu', () => {
	const handlers = { 'edit.undo': () => {}, 'edit.redo': () => {} };
	const history = (
		facts: Partial<BridgeSnapshot['facts']>,
		given: BridgeSnapshot['handlers'] = handlers,
	) => {
		const edit = appMenuItems(snapshot({ hasLevel: true, editorOpen: true, ...facts }, given)).find(
			(item) => item.id === 'menu:edit',
		);
		const sub = edit?.type === 'submenu' ? edit.items.find((i) => i.id === 'menu:history') : null;
		return sub?.type === 'submenu' ? sub.items : [];
	};

	it('sits in the Edit menu after Undo and Redo', () => {
		const edit = rowsOf(appMenuItems(snapshot({ hasLevel: true, editorOpen: true })), 'menu:edit');
		expect(edit.map((item) => item.id)).toEqual(['edit.undo', 'edit.redo', 'menu:history']);
		expect(edit[2]).toMatchObject({ type: 'submenu', label: 'Undo history' });
	});

	it('says there is nothing in the history yet, above the palette footer', () => {
		const rows = history({});
		expect(rows.map((item) => (item.type === 'separator' ? '-' : item.id))).toEqual([
			HISTORY_EMPTY_ID,
			'-',
			HISTORY_MORE_ID,
		]);
		expect(rows[0]).toMatchObject({ label: 'Nothing in the history yet', disabled: true });
		expect(rows[2]).toMatchObject({ label: 'More in the command palette…' });
		expect(rows[2]).not.toHaveProperty('disabled');
	});

	it('lists the undo step with its author, enabled, and the undone step above it', () => {
		const undoOnly = history({ canUndo: true, undoName: 'Paint grass', author: 'claude' });
		expect(undoOnly[0]).toMatchObject({ id: HISTORY_UNDO_ID, label: 'Paint grass (Claude)' });
		expect(undoOnly[0]).not.toHaveProperty('disabled');
		const both = history({
			canUndo: true,
			canRedo: true,
			undoName: 'Erase a wall',
			redoName: 'Paint grass',
			// The last step was an undo, so the author belongs to the step that can be redone.
			author: 'person',
		});
		expect(both.map((item) => item.id)).toEqual([
			HISTORY_REDO_ID,
			HISTORY_UNDO_ID,
			expect.stringContaining('rule'),
			HISTORY_MORE_ID,
		]);
		expect(both[0]).toMatchObject({ label: 'Paint grass (You, undone)' });
		expect(both[1]).toMatchObject({ label: 'Erase a wall' });
		expect(both[0]).not.toHaveProperty('disabled');
		expect(both[1]).not.toHaveProperty('disabled');
	});

	it('names an unnamed step by its command and leaves out an author it does not know', () => {
		const rows = history({ canRedo: true, author: null });
		expect(rows[0]).toMatchObject({ id: HISTORY_REDO_ID, label: 'Redo (undone)' });
	});

	it('disables a step whose command cannot run, with the reason as its tooltip', () => {
		const rows = history({ canUndo: true, undoName: 'Paint grass' }, {});
		expect(rows[0]).toMatchObject({
			id: HISTORY_UNDO_ID,
			disabled: true,
			title: 'Not available right now',
		});
	});

	it('gives every row an icon, and runs the command a row stands for', () => {
		for (const row of history({ canUndo: true, canRedo: true })) {
			if (row.type !== 'separator' && row.type !== 'section') expect(row.icon, row.id).toBeTruthy();
		}
		expect(commandIdOfRow(HISTORY_UNDO_ID)).toBe('edit.undo');
		expect(commandIdOfRow(HISTORY_REDO_ID)).toBe('edit.redo');
		expect(commandIdOfRow(HISTORY_MORE_ID)).toBe('view.commandPalette');
		expect(commandIdOfRow('file.save')).toBe('file.save');
	});
});

describe('the zoom, workspace and window commands', () => {
	const find = (id: string, facts: Partial<BridgeSnapshot['facts']>, given = {}) => {
		const snap = snapshot({ editorOpen: true, hasLevel: true, ...facts }, given);
		const def = allCommands(snap.facts).find((command) => command.id === id)!;
		return viewOf(def, snap);
	};

	it('hides the zoom commands until the canvas has published its zoom', () => {
		expect(find('view.zoomIn', {}).visible).toBe(false);
		const zoom = { level: 16, canIn: false, canOut: true };
		expect(find('view.zoomIn', { zoom }, { 'view.zoomIn': () => {} })).toMatchObject({
			visible: true,
			enabled: false,
			reason: 'Already at the largest zoom',
		});
		expect(find('view.zoomOut', { zoom }, { 'view.zoomOut': () => {} }).enabled).toBe(true);
	});

	it('ticks the active workspace and offers the others', () => {
		const workspace = { active: 'Paint', names: ['Paint', 'Review', 'Script'] };
		const handlers = { 'workspace.paint': () => {}, 'workspace.script': () => {} };
		expect(find('workspace.paint', { workspace }, handlers)).toMatchObject({
			checked: true,
			enabled: false,
		});
		expect(find('workspace.script', { workspace }, handlers)).toMatchObject({
			checked: false,
			enabled: true,
		});
		expect(find('workspace.script', {}).visible).toBe(false);
	});

	it('acts on the focused panel, and only when there is one', () => {
		const handlers = { 'window.floatFocused': () => {}, 'window.tearOffFocused': () => {} };
		expect(find('window.floatFocused', {}, handlers).enabled).toBe(false);
		expect(find('window.floatFocused', { focusedPanel: 'history' }, handlers).enabled).toBe(true);
		const away = { ...NO_FACTS.away, history: true };
		expect(find('window.tearOffFocused', { focusedPanel: 'history', away }, handlers).enabled).toBe(
			false,
		);
	});

	it('docks every window back only while a panel is in one', () => {
		const handlers = { 'window.dockAllBack': () => {} };
		expect(find('window.dockAllBack', {}, handlers).enabled).toBe(false);
		const away = { ...NO_FACTS.away, script: true };
		expect(find('window.dockAllBack', { away }, handlers).enabled).toBe(true);
	});

	it('keeps the menu bar switch a toggle that follows the fact', () => {
		const handlers = { 'view.menuBar': () => {} };
		expect(find('view.menuBar', { menuBar: true }, handlers).checked).toBe(true);
		expect(find('view.menuBar', { menuBar: false }, handlers).checked).toBe(false);
	});
});
