// The application menu's commands: each with its label, shortcut and when it can run
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import type { MessageId } from '../i18n/messages';
import { openWindow } from '../services/windowsClient';
import { t } from '../i18n/messages';
import { TOOL_KEYS } from '../tools/shortcuts';
import { TOOL_IDS, type ToolId } from '../tools/tool';
import type { Brush } from '../tools/brush';
import type { BridgeSnapshot, CommandFacts } from './commandBridge';

export type MenuName = 'file' | 'edit' | 'view' | 'window';

/** The headings the command palette lists commands under, in the order it lists them. */
export type PaletteGroup =
	| 'tools'
	| 'brushes'
	| 'panels'
	| 'file'
	| 'edit'
	| 'view'
	| 'window'
	| 'goto';

export const PALETTE_GROUPS: readonly PaletteGroup[] = [
	'tools',
	'brushes',
	'panels',
	'file',
	'edit',
	'view',
	'window',
	'goto',
];

export const PALETTE_GROUP_LABELS: Record<PaletteGroup, MessageId> = {
	tools: 'cmdPalette.group.tools',
	brushes: 'cmdPalette.group.brushes',
	panels: 'cmdPalette.group.panels',
	file: 'cmdPalette.group.file',
	edit: 'cmdPalette.group.edit',
	view: 'cmdPalette.group.view',
	window: 'cmdPalette.group.window',
	goto: 'cmdPalette.group.goto',
};

export interface CommandDef {
	id: string;
	/** The menu that lists the command; a palette-only command has none. */
	menu?: MenuName;
	/** The palette heading; a menu command's defaults to its menu's name. */
	group?: PaletteGroup;
	/** Starts a new section (a rule above it) within its menu. */
	section: number;
	label: MessageId;
	/** The `{token}` values of `label`, for a command named after something (a brush). */
	labelValues?: Record<string, string>;
	/** Set when the command asks the person for a value before it runs (the palette prompts for it). */
	argument?: 'line';
	/** The keys, as shown on the row; the keys themselves are handled by the screens. */
	shortcut?: string;
	/** When the command can run, given what the screens published. */
	enabled: (facts: CommandFacts) => boolean;
	/** A checked row, for the panels. */
	checked?: (facts: CommandFacts) => boolean;
	/** Set when the studio has no action for the command: it is always disabled, with this as the reason. */
	unavailable?: MessageId;
	/** The command's own action, when it needs nothing from a screen. Otherwise a screen publishes the handler. */
	run?: (argument?: string) => void;
}

/** The text of a command's label. */
export const commandLabel = (def: CommandDef) => t(def.label, def.labelValues);

/** The palette heading a command is listed under. */
export function paletteGroupOf(def: CommandDef): PaletteGroup {
	return def.group ?? def.menu ?? 'view';
}

/** The keys that open the command palette, as shown on its View row. */
export const COMMAND_PALETTE_KEYS = 'Ctrl+Shift+P';

const always = () => true;
const hasLevel = (facts: CommandFacts) => facts.hasLevel;

const panelCommand = (id: PanelId, title: MessageId): CommandDef => ({
	id: `view.panel.${id}`,
	menu: 'view',
	section: 0,
	group: 'panels',
	label: title,
	enabled: (facts) => facts.editorOpen,
	checked: (facts) => facts.panels[id],
});

/** The commands in menu order. Ids are unique; `panelCommandId` and the handlers use them. */
export const COMMANDS: readonly CommandDef[] = [
	{ id: 'file.new', menu: 'file', section: 0, label: 'main.newLevel', enabled: always },
	{ id: 'file.open', menu: 'file', section: 0, label: 'main.openLevel', enabled: always },
	{
		id: 'file.save',
		menu: 'file',
		section: 1,
		label: 'main.save',
		shortcut: 'Ctrl+S',
		enabled: hasLevel,
	},
	{ id: 'file.close', menu: 'file', section: 1, label: 'main.closeLevel', enabled: hasLevel },
	{
		id: 'file.quit',
		menu: 'file',
		section: 2,
		label: 'appMenu.quit',
		enabled: () => false,
		unavailable: 'appMenu.quitUnavailable',
	},
	{
		id: 'edit.undo',
		menu: 'edit',
		section: 0,
		label: 'history.undo',
		shortcut: 'Ctrl+Z',
		enabled: (facts) => facts.canUndo,
	},
	{
		id: 'edit.redo',
		menu: 'edit',
		section: 0,
		label: 'history.redo',
		shortcut: 'Ctrl+Shift+Z',
		enabled: (facts) => facts.canRedo,
	},
	...PANEL_SPECS.map((spec) => panelCommand(spec.id, spec.title)),
	{
		id: 'view.levelFirst',
		menu: 'view',
		section: 1,
		label: 'view.levelFirst',
		shortcut: 'Tab',
		enabled: (facts) => facts.editorOpen,
		checked: (facts) => facts.levelFirst,
	},
	{
		id: 'view.resetLayout',
		menu: 'view',
		group: 'panels',
		section: 1,
		label: 'panels.reset',
		shortcut: 'Ctrl+Shift+0',
		enabled: (facts) => facts.editorOpen,
	},
	{
		id: 'view.commandPalette',
		menu: 'view',
		section: 2,
		label: 'appMenu.commandPalette',
		shortcut: COMMAND_PALETTE_KEYS,
		enabled: always,
	},
	{
		id: 'window.preferences',
		menu: 'window',
		section: 0,
		label: 'appMenu.preferences',
		shortcut: 'Ctrl+,',
		enabled: always,
		run: () => void openWindow({ kind: 'preferences' }),
	},
	{
		id: 'window.about',
		menu: 'window',
		section: 0,
		label: 'appMenu.about',
		enabled: always,
		run: () => void openWindow({ kind: 'about' }),
	},
];

export const toolCommandId = (id: ToolId) => `tool.${id}`;
export const brushCommandId = (brush: Brush) => `brush.${brush.group}.${brush.kind}`;

const TOOL_LABELS: Record<ToolId, MessageId> = {
	paint: 'tools.paint',
	erase: 'tools.erase',
	pick: 'tools.pick',
	select: 'tools.select',
	stamp: 'tools.stamp',
};

/**
 * Commands only the palette lists. A screen publishes the handler under the same id, as for a menu
 * command. The tools choose the tool; Go to line asks for a number.
 *
 * Extension point: the dock commands (move a panel to the left, right or bottom dock, float it)
 * join this list with `group: 'panels'` and a handler from the screen that owns the dock, once the
 * dock exists in the editor; nothing else in the palette changes.
 */
export const PALETTE_COMMANDS: readonly CommandDef[] = [
	...TOOL_IDS.map(
		(id): CommandDef => ({
			id: toolCommandId(id),
			group: 'tools',
			section: 0,
			label: TOOL_LABELS[id],
			shortcut: TOOL_KEYS[id].toUpperCase(),
			enabled: (facts) => facts.editorOpen,
		}),
	),
	{
		id: 'goto.line',
		group: 'goto',
		section: 0,
		label: 'cmdPalette.gotoLine',
		argument: 'line',
		enabled: (facts) => facts.editorOpen && facts.lineCount > 0,
	},
];

/** One command per brush the open level offers. */
export function brushCommands(brushes: readonly Brush[]): CommandDef[] {
	return brushes.map((brush) => ({
		id: brushCommandId(brush),
		group: 'brushes',
		section: 0,
		label: 'cmdPalette.brush',
		labelValues: { name: brush.kind },
		enabled: (facts) => facts.editorOpen,
	}));
}

/** Every command now: the menu's, the palette's own and a brush for each the level offers. */
export function allCommands(facts: CommandFacts): CommandDef[] {
	return [...COMMANDS, ...PALETTE_COMMANDS, ...brushCommands(facts.brushes)];
}

export const panelCommandId = (id: PanelId) => `view.panel.${id}`;

/** A command as the menu shows it now. */
export interface CommandView {
	def: CommandDef;
	enabled: boolean;
	checked: boolean | undefined;
}

/** A command can run when its predicate holds and something can do it. */
export function viewOf(def: CommandDef, snapshot: BridgeSnapshot): CommandView {
	const doable = def.run !== undefined || def.id in snapshot.handlers;
	return {
		def,
		enabled: !def.unavailable && doable && def.enabled(snapshot.facts),
		checked: def.checked?.(snapshot.facts),
	};
}

/** Runs a command if it is enabled; returns whether it ran. `argument` is the value it asked for. */
export function runCommand(id: string, snapshot: BridgeSnapshot, argument?: string): boolean {
	const def = allCommands(snapshot.facts).find((command) => command.id === id);
	if (!def || !viewOf(def, snapshot).enabled) return false;
	(def.run ?? snapshot.handlers[id])?.(argument);
	return true;
}
