// The application menu's commands: each with its label, shortcut and when it can run
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import type { MessageId } from '../i18n/messages';
import { openWindow } from '../services/windowsClient';
import type { BridgeSnapshot, CommandFacts } from './commandBridge';

export type MenuName = 'file' | 'edit' | 'view' | 'window';

export interface CommandDef {
	id: string;
	menu: MenuName;
	/** Starts a new section (a rule above it) within its menu. */
	section: number;
	label: MessageId;
	/** The keys, as shown on the row; the keys themselves are handled by the screens. */
	shortcut?: string;
	/** When the command can run, given what the screens published. */
	enabled: (facts: CommandFacts) => boolean;
	/** A checked row, for the panels. */
	checked?: (facts: CommandFacts) => boolean;
	/** Set when the studio has no action for the command: it is always disabled, with this as the reason. */
	unavailable?: MessageId;
	/** The command's own action, when it needs nothing from a screen. Otherwise a screen publishes the handler. */
	run?: () => void;
}

const always = () => true;
const hasLevel = (facts: CommandFacts) => facts.hasLevel;

const panelCommand = (id: PanelId, title: MessageId): CommandDef => ({
	id: `view.panel.${id}`,
	menu: 'view',
	section: 0,
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
		id: 'view.resetLayout',
		menu: 'view',
		section: 1,
		label: 'panels.reset',
		shortcut: 'Ctrl+Shift+0',
		enabled: (facts) => facts.editorOpen,
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

/** Runs a command if it is enabled; returns whether it ran. */
export function runCommand(id: string, snapshot: BridgeSnapshot): boolean {
	const def = COMMANDS.find((command) => command.id === id);
	if (!def || !viewOf(def, snapshot).enabled) return false;
	(def.run ?? snapshot.handlers[id])?.();
	return true;
}
