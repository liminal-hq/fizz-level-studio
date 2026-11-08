// The application menu's commands: each with its label, shortcut and when it can run
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { IconId } from '../icons/AppIcons';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import type { MessageId } from '../i18n/messages';
import { quitClient } from '../services/quitClient';
import { openWindow } from '../services/windowsClient';
import { t } from '../i18n/messages';
import { TOOL_KEYS } from '../tools/shortcuts';
import { TOOL_IDS, type ToolId } from '../tools/tool';
import type { Brush } from '../tools/brush';
import type { BridgeSnapshot, CommandFacts } from './commandBridge';
import { canvasCommands } from './canvasCommands';
import { layerCommands } from './layerCommands';
import { scriptCommands } from './scriptCommands';
import { selectionCommands } from './selectionCommands';
import { formatChord, type KeyChord } from './keyChords';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';

export type MenuName = 'file' | 'edit' | 'view' | 'window' | 'help';

/** The headings the command palette lists commands under, in the order it lists them. */
export type PaletteGroup =
	| 'tools'
	| 'brushes'
	| 'panels'
	| 'file'
	| 'edit'
	| 'view'
	| 'window'
	| 'help'
	| 'goto';

export const PALETTE_GROUPS: readonly PaletteGroup[] = [
	'tools',
	'brushes',
	'panels',
	'file',
	'edit',
	'view',
	'window',
	'help',
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
	help: 'cmdPalette.group.help',
	goto: 'cmdPalette.group.goto',
};

/** Why a command is disabled: a catalogue message, or one with the values its `{tokens}` take. */
export type CommandReason = MessageId | { id: MessageId; values: Record<string, string | number> };

/** The text of a reason. */
export const reasonText = (reason: CommandReason): string =>
	typeof reason === 'string' ? t(reason) : t(reason.id, reason.values);

/** The catalogue message of a reason, whichever form it takes. */
export const reasonId = (reason: CommandReason): MessageId =>
	typeof reason === 'string' ? reason : reason.id;

export interface CommandDef {
	id: string;
	/** The menu that lists the command; a palette-only command has none. */
	menu?: MenuName;
	/** The palette heading; a menu command's defaults to its menu's name. */
	group?: PaletteGroup;
	label: MessageId;
	/** The `{token}` values of `label`, for a command named after something (a brush). */
	labelValues?: Record<string, string> | (() => Record<string, string>);
	/**
	 * False when the command does not apply here at all, so the menus and the palette leave it out
	 * (a Window row on the start screen, or Restore while nothing is maximised). A command that
	 * applies but cannot run now stays visible and is disabled through `enabled`. Defaults to true.
	 */
	visible?: (facts: CommandFacts) => boolean;
	/** Set when the command asks the person for a value before it runs (the palette prompts for it). */
	argument?: 'line';
	/** The icon on the command's menu row. Every menu command has one; a palette-only command (no `menu`) is exempt. */
	icon?: IconId;
	/**
	 * The keys the app-wide dispatcher (`commandForKey`) runs the command on. The first chord is the one
	 * the rows show. A command whose keys belong to a screen's own focus scope (the tool letters, Tab)
	 * lists none and gives `shortcut` instead.
	 */
	keys?: KeyChord[];
	/** The keys as shown on the row, for a command whose keys a screen handles itself. Prefer `keys`. */
	shortcut?: string;
	/** A shorter label for where the context already names the panel: "Dock left" in a panel's own menu, where the palette says "Dock Script left". */
	shortLabel?: MessageId;
	/** The command has a button on the classic toolbar, drawn with this icon. */
	toolbar?: { icon: IconId };
	/** What the command is: an `action` (the default), a `toggle` (checked or not) or one of a `radio` set (the checked one is the current choice). */
	kind?: 'action' | 'toggle' | 'radio';
	/** When the command can run, given what the screens published. */
	enabled: (facts: CommandFacts) => boolean;
	/** A checked row, for the panels. */
	checked?: (facts: CommandFacts) => boolean;
	/**
	 * Why the command is disabled now, worked out from the facts, shown as the row's tooltip and the
	 * palette's detail. Without it, a disabled command says to open a level first when none is open,
	 * and that it is not available right now otherwise.
	 */
	reason?: (facts: CommandFacts) => CommandReason | undefined;
	/** The command's own action, when it needs nothing from a screen; a handler a screen publishes under the same id runs instead. */
	run?: (argument?: string) => void;
}

/** The text of a command's label. */
export const commandLabel = (def: CommandDef) =>
	t(def.label, typeof def.labelValues === 'function' ? def.labelValues() : def.labelValues);

/** The keys a command's rows show: its first chord, else its `shortcut`. */
export function shortcutOf(def: CommandDef): string | undefined {
	return def.keys?.[0] ? formatChord(def.keys[0]) : def.shortcut;
}

/** The palette heading a command is listed under. */
export function paletteGroupOf(def: CommandDef): PaletteGroup {
	return def.group ?? def.menu ?? 'view';
}

/** The keys that open the command palette, as shown on the search button and its tooltip. */
export const COMMAND_PALETTE_SHORTCUT = 'Ctrl+Shift+P';
const COMMAND_PALETTE_CHORD: KeyChord = { key: 'p', mod: true, shift: true, capture: true };

/** The keys that maximise the focused panel or restore it, as shown on its rows and tooltips. */
export const MAXIMISE_KEYS = 'Ctrl+Shift+M';

const always = () => true;
/** Why a level command is disabled while none is open; the default reason says the same. */
const needsLevel = (facts: CommandFacts): MessageId | undefined =>
	facts.hasLevel ? undefined : 'cmdPalette.needsLevel';
/** Visible only with the editor on screen: the start screen has no panel to show, tear off or dock back. */
const hasEditor = (facts: CommandFacts) => facts.editorOpen;
const hasLevel = (facts: CommandFacts) => facts.hasLevel;

const panelCommand = (id: PanelId, title: MessageId): CommandDef => ({
	id: `view.panel.${id}`,
	toolbar: { icon: `panel.${id}` },
	menu: 'view',
	group: 'panels',
	icon: `panel.${id}`,
	label: title,
	visible: hasEditor,
	enabled: (facts) => facts.editorOpen,
	checked: (facts) => facts.panels[id],
});

/**
 * Maximise or Restore for an expandable panel. Each panel has one row at a time: Maximise until it
 * is maximised, then Restore.
 */
const maximiseCommand = (id: PanelId, title: MessageId, restore: boolean): CommandDef => ({
	id: `view.${restore ? 'restore' : 'maximise'}.${id}`,
	menu: 'view',
	group: 'panels',
	icon: restore ? 'restore' : 'maximise',
	label: restore ? 'view.restore' : 'view.maximise',
	labelValues: () => ({ panel: t(title) }),
	shortcut: MAXIMISE_KEYS,
	enabled: (facts) => facts.editorOpen && facts.panels[id],
	reason: (facts) => (restore || facts.panels[id] ? undefined : 'view.maximiseNeedsPanel'),
	visible: (facts) => facts.editorOpen && (facts.maximised === id) === restore,
});

export const panelDockCommandId = (id: PanelId, zone: ZoneId) => `panel.${id}.dock.${zone}`;
export const panelFloatCommandId = (id: PanelId) => `panel.${id}.float`;

const DOCK_LABELS: Record<ZoneId, { label: MessageId; short: MessageId }> = {
	left: { label: 'dock.dockLeft', short: 'dock.menu.left' },
	right: { label: 'dock.dockRight', short: 'dock.menu.right' },
	bottom: { label: 'dock.dockBottom', short: 'dock.menu.bottom' },
};

/** Where a panel is now: always one of these, so a place row can say it is already there. */
const placeIs = (facts: CommandFacts, id: PanelId, place: CommandFacts['placeOf'][PanelId]) =>
	facts.placeOf[id] === place;

/**
 * The commands that move a panel: dock it left, right or bottom, or float it. They are the rows of the
 * panel's own menu and the palette's. The row for where the panel already is is checked and disabled.
 */
const panelPlaceCommands = (id: PanelId, title: MessageId): CommandDef[] => {
	const value = () => ({ title: t(title) });
	const place = (
		commandId: string,
		at: CommandFacts['placeOf'][PanelId],
		icon: IconId,
		label: MessageId,
		shortLabel: MessageId,
	): CommandDef => ({
		id: commandId,
		icon,
		menu: 'window',
		group: 'panels',
		label,
		labelValues: value,
		shortLabel,
		kind: 'radio',
		visible: hasEditor,
		enabled: (facts) => facts.editorOpen && !placeIs(facts, id, at),
		checked: (facts) => placeIs(facts, id, at),
		reason: (facts) => (placeIs(facts, id, at) ? 'dock.menu.here' : undefined),
	});
	return [
		...ZONE_ORDER.map((zone) =>
			place(
				panelDockCommandId(id, zone),
				zone,
				`dock.${zone}`,
				DOCK_LABELS[zone].label,
				DOCK_LABELS[zone].short,
			),
		),
		place(panelFloatCommandId(id), 'float', 'float', 'dock.float', 'dock.menu.float'),
	];
};

const ZONE_ORDER: readonly ZoneId[] = ['left', 'right', 'bottom'];

/** The workspaces the app ships, by the command that switches to each. */
export const WORKSPACE_COMMANDS = [
	{ id: 'workspace.paint', name: 'Paint', label: 'workspace.paint' },
	{ id: 'workspace.script', name: 'Script', label: 'workspace.script' },
	{ id: 'workspace.review', name: 'Review', label: 'workspace.review' },
] as const satisfies readonly { id: string; name: string; label: MessageId }[];

const workspaceCommand = (entry: (typeof WORKSPACE_COMMANDS)[number]): CommandDef => ({
	id: entry.id,
	icon: 'workspace',
	menu: 'window',
	group: 'window',
	label: entry.label,
	kind: 'radio',
	visible: (facts) => facts.editorOpen && facts.workspace.names.includes(entry.name),
	enabled: (facts) => facts.editorOpen && facts.workspace.active !== entry.name,
	checked: (facts) => facts.workspace.active === entry.name,
	reason: (facts) => (facts.workspace.active === entry.name ? 'workspace.current' : undefined),
});

const zoomCommand = (
	id: 'in' | 'out' | 'fit',
	icon: IconId,
	label: MessageId,
	keys: KeyChord[],
	can: (zoom: NonNullable<CommandFacts['zoom']>) => boolean,
): CommandDef => ({
	id: `view.zoom${id === 'in' ? 'In' : id === 'out' ? 'Out' : 'Fit'}`,
	icon,
	menu: 'view',
	group: 'view',
	label,
	keys,
	// Hidden until the level canvas has published its zoom.
	visible: (facts) => facts.zoom !== null,
	enabled: (facts) => facts.zoom !== null && can(facts.zoom),
	reason: (facts) =>
		facts.zoom === null
			? undefined
			: id === 'in'
				? 'canvas.zoomMax'
				: id === 'out'
					? 'canvas.zoomMin'
					: undefined,
});

/**
 * The menu commands. Ids are unique; `panelCommandId` and the handlers use them. Their order is
 * the palette's order within a heading; the menus group them in `appMenuModel`.
 */
export const COMMANDS: readonly CommandDef[] = [
	{
		id: 'file.new',
		toolbar: { icon: 'new' },
		icon: 'new',
		menu: 'file',
		label: 'main.newLevel',
		keys: [{ key: 'n', mod: true }],
		enabled: always,
	},
	{
		id: 'file.open',
		toolbar: { icon: 'open' },
		icon: 'open',
		menu: 'file',
		label: 'main.openLevel',
		keys: [{ key: 'o', mod: true }],
		enabled: always,
	},
	{
		id: 'file.save',
		toolbar: { icon: 'save' },
		icon: 'save',
		menu: 'file',
		label: 'main.save',
		keys: [{ key: 's', mod: true }],
		enabled: hasLevel,
		reason: needsLevel,
	},
	{
		id: 'file.close',
		toolbar: { icon: 'close' },
		icon: 'close',
		menu: 'file',
		label: 'main.closeLevel',
		keys: [{ key: 'w', mod: true }],
		enabled: hasLevel,
		reason: needsLevel,
	},
	{
		id: 'file.preferences',
		icon: 'preferences',
		menu: 'file',
		label: 'appMenu.preferences',
		keys: [{ key: ',', mod: true }],
		enabled: always,
		run: () => void openWindow({ kind: 'preferences' }),
	},
	{
		id: 'file.quit',
		icon: 'quit',
		menu: 'file',
		label: 'appMenu.quit',
		keys: [{ key: 'q', mod: true }],
		enabled: always,
		run: () => void quitClient.request().catch(() => {}),
	},
	{
		id: 'edit.undo',
		toolbar: { icon: 'undo' },
		icon: 'undo',
		menu: 'edit',
		label: 'history.undo',
		shortcut: 'Ctrl+Z',
		enabled: (facts) => facts.canUndo,
		reason: (facts) => (facts.canUndo ? undefined : (needsLevel(facts) ?? 'history.nothingToUndo')),
	},
	{
		id: 'edit.redo',
		toolbar: { icon: 'redo' },
		icon: 'redo',
		menu: 'edit',
		label: 'history.redo',
		shortcut: 'Ctrl+Shift+Z',
		enabled: (facts) => facts.canRedo,
		reason: (facts) => (facts.canRedo ? undefined : (needsLevel(facts) ?? 'history.nothingToRedo')),
	},
	...PANEL_SPECS.map((spec) => panelCommand(spec.id, spec.title)),
	...PANEL_SPECS.filter((spec) => spec.expandable).flatMap((spec) => [
		maximiseCommand(spec.id, spec.title, false),
		maximiseCommand(spec.id, spec.title, true),
	]),
	...PANEL_SPECS.flatMap((spec) => panelPlaceCommands(spec.id, spec.title)),
	...WORKSPACE_COMMANDS.map(workspaceCommand),
	{
		id: 'window.floatFocused',
		icon: 'float',
		menu: 'window',
		group: 'window',
		label: 'appMenu.floatFocused',
		visible: hasEditor,
		enabled: (facts) => facts.editorOpen && facts.focusedPanel !== null,
		reason: () => 'appMenu.noFocusedPanel',
	},
	{
		id: 'window.tearOffFocused',
		icon: 'tearOff',
		menu: 'window',
		group: 'window',
		label: 'appMenu.tearOffFocused',
		visible: hasEditor,
		enabled: (facts) =>
			facts.editorOpen && facts.focusedPanel !== null && !facts.away[facts.focusedPanel],
		reason: () => 'appMenu.noFocusedPanel',
	},
	{
		id: 'window.dockAllBack',
		icon: 'dockBack',
		menu: 'window',
		group: 'window',
		label: 'appMenu.dockAllBack',
		visible: hasEditor,
		enabled: (facts) => facts.editorOpen && Object.values(facts.away).some(Boolean),
		reason: () => 'appMenu.noWindows',
	},
	zoomCommand(
		'in',
		'zoomIn',
		'canvas.zoomIn',
		[
			{ key: '=', mod: true },
			{ key: '+', mod: true, shift: 'any' },
		],
		(zoom) => zoom.canIn,
	),
	zoomCommand('out', 'zoomOut', 'canvas.zoomOut', [{ key: '-', mod: true }], (zoom) => zoom.canOut),
	zoomCommand('fit', 'zoomFit', 'canvas.zoomFit', [{ key: '0', mod: true }], () => true),
	{
		id: 'view.toolbar.classic',
		icon: 'toolbar',
		menu: 'view',
		group: 'view',
		label: 'toolbar.classic',
		kind: 'toggle',
		visible: always,
		enabled: always,
		checked: (facts) => facts.toolbar === 'classic',
	},
	{
		id: 'view.toolbar.ribbon',
		icon: 'ribbon',
		menu: 'view',
		group: 'view',
		label: 'toolbar.ribbon',
		kind: 'toggle',
		enabled: always,
		checked: (facts) => facts.toolbar === 'ribbon',
	},
	{
		id: 'view.menuBar',
		icon: 'menuBar',
		menu: 'view',
		group: 'view',
		label: 'appMenu.menuBar',
		kind: 'toggle',
		enabled: always,
		checked: (facts) => facts.menuBar,
	},
	{
		id: 'view.levelFirst',
		icon: 'levelFirst',
		menu: 'view',
		label: 'view.levelFirst',
		shortcut: 'Tab',
		visible: hasEditor,
		// Maximising wins over level-first: while a panel fills the workspace, Tab does nothing.
		enabled: (facts) => facts.editorOpen && facts.maximised === null,
		reason: (facts) => (facts.maximised === null ? undefined : 'view.levelFirstMaximised'),
		checked: (facts) => facts.levelFirst,
	},
	{
		id: 'view.resetLayout',
		icon: 'resetLayout',
		menu: 'view',
		group: 'panels',
		label: 'panels.reset',
		shortcut: 'Ctrl+Shift+0',
		visible: hasEditor,
		enabled: (facts) => facts.editorOpen,
	},
	{
		id: 'view.commandPalette',
		icon: 'commandPalette',
		menu: 'view',
		label: 'appMenu.commandPalette',
		keys: [COMMAND_PALETTE_CHORD],
		enabled: always,
	},
	{
		id: 'help.help',
		icon: 'help',
		menu: 'help',
		label: 'appMenu.helpTopic',
		keys: [{ key: 'F1' }],
		enabled: always,
		run: () => void openWindow({ kind: 'about' }),
	},
	{
		id: 'help.shortcuts',
		icon: 'shortcuts',
		menu: 'help',
		label: 'appMenu.shortcuts',
		keys: [{ key: '?', shift: 'any', unlessTyping: true }],
		enabled: always,
	},
	{
		id: 'help.about',
		icon: 'about',
		menu: 'help',
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
	inspect: 'tools.inspect',
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
			icon: `tool.${id}`,
			group: 'tools',
			label: TOOL_LABELS[id],
			shortcut: TOOL_KEYS[id].toUpperCase(),
			enabled: (facts) => facts.editorOpen,
		}),
	),
	{
		// Opens the context menu of whatever has the keyboard focus; the window's menu host publishes the handler.
		id: 'view.contextMenu',
		icon: 'contextMenu',
		group: 'view',
		label: 'appMenu.contextMenu',
		keys: [{ key: 'F10', shift: true }, { key: 'ContextMenu' }],
		enabled: always,
	},
	{
		id: 'view.toolbar.hidden',
		icon: 'toolbar',
		group: 'view',
		label: 'toolbar.hidden',
		visible: (facts) => facts.toolbar !== 'hidden',
		enabled: always,
	},
	{
		id: 'view.ribbon.fold',
		icon: 'ribbon',
		group: 'view',
		label: 'toolbar.foldRibbon',
		kind: 'toggle',
		visible: (facts) => facts.toolbar === 'ribbon',
		enabled: always,
		checked: (facts) => facts.ribbonFolded,
	},
	{
		id: 'panel.palette.show',
		icon: 'panel.palette',
		group: 'panels',
		label: 'toolbar.showPalette',
		enabled: (facts) => facts.editorOpen,
	},
	{
		id: 'panel.script.show',
		icon: 'panel.script',
		group: 'panels',
		label: 'toolbar.showScript',
		enabled: (facts) => facts.editorOpen,
	},
	{
		id: 'script.tab.level.activate',
		icon: 'panel.script',
		group: 'panels',
		label: 'scriptTabs.activate',
		enabled: (facts) => facts.editorOpen,
	},
	{
		id: 'script.tab.level.close',
		icon: 'close',
		group: 'panels',
		label: 'scriptTabs.closeCommand',
		enabled: (facts) => facts.editorOpen && facts.panels.script,
		reason: () => 'view.maximiseNeedsPanel',
	},
	{
		id: 'goto.line',
		group: 'goto',
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
		label: 'cmdPalette.brush',
		labelValues: { name: brush.kind },
		enabled: (facts) => facts.editorOpen,
	}));
}

export const tearOffCommandId = (id: PanelId) => `view.panel.${id}.tearOff`;
export const dockBackCommandId = (id: PanelId) => `view.panel.${id}.dockBack`;

/**
 * Tear off and Dock back, built for each panel (its name is the command's value): a panel in the
 * main window offers Tear off, and one in a window of its own offers Dock back. They run through
 * handlers the editor publishes under `tearOffCommandId` and `dockBackCommandId`. They are the Window
 * menu's rows as well as the palette's.
 */
export function panelWindowCommands(facts: CommandFacts): CommandDef[] {
	return PANEL_SPECS.map((spec): CommandDef => {
		const panel = t(spec.title);
		return facts.away[spec.id]
			? {
					id: dockBackCommandId(spec.id),
					icon: 'dockBack',
					menu: 'window',
					group: 'panels',
					label: 'cmdPalette.dockPanelBack',
					shortLabel: 'dock.menu.dockBack',
					labelValues: { panel },
					visible: hasEditor,
					enabled: (now) => now.editorOpen && now.away[spec.id],
				}
			: {
					id: tearOffCommandId(spec.id),
					icon: 'tearOff',
					menu: 'window',
					group: 'panels',
					label: 'cmdPalette.tearOffPanel',
					shortLabel: 'dock.menu.tearOff',
					labelValues: { panel },
					visible: hasEditor,
					enabled: (now) => now.editorOpen && !now.away[spec.id],
				};
	});
}

/**
 * The commands a feature registers beside the fixed lists: the Layers panel's Show all and
 * Unlock all, and the selection's Delete, Flip, Show in script and nudges. A feature adds its builder here and nothing else in the registry changes.
 */
export function extraCommands(facts: CommandFacts): CommandDef[] {
	return [
		...layerCommands(facts),
		...selectionCommands(),
		...canvasCommands(),
		...scriptCommands(),
	];
}

/**
 * Every command now: the menu's, the palette's own, a brush for each the level offers, a Tear
 * off or Dock back for each panel and the features' extras.
 */
export function allCommands(facts: CommandFacts): CommandDef[] {
	return [
		...COMMANDS,
		...PALETTE_COMMANDS,
		...brushCommands(facts.brushes),
		...panelWindowCommands(facts),
		...extraCommands(facts),
	];
}

export const maximiseCommandId = (id: PanelId, restore: boolean) =>
	`view.${restore ? 'restore' : 'maximise'}.${id}`;

export const panelCommandId = (id: PanelId) => `view.panel.${id}`;

/** A command as the menu and the palette show it now. */
export interface CommandView {
	def: CommandDef;
	/** False when the command does not apply here, so no menu or palette lists it. */
	visible: boolean;
	enabled: boolean;
	checked: boolean | undefined;
	/** Why a visible command cannot run now; absent while it can. */
	reason: string | undefined;
}

/** The default reason for a disabled command that gives none of its own. */
function defaultReason(facts: CommandFacts): MessageId {
	return !facts.hasLevel && !facts.editorOpen
		? 'cmdPalette.needsLevel'
		: 'cmdPalette.unavailableNow';
}

/** A command can run when its predicate holds and something can do it. */
export function viewOf(def: CommandDef, snapshot: BridgeSnapshot): CommandView {
	const { facts } = snapshot;
	const doable = def.run !== undefined || def.id in snapshot.handlers;
	const enabled = doable && def.enabled(facts);
	return {
		def,
		visible: def.visible?.(facts) ?? true,
		enabled,
		checked: def.checked?.(facts),
		reason: enabled ? undefined : reasonText(def.reason?.(facts) ?? defaultReason(facts)),
	};
}

/** Runs a command if it is enabled; returns whether it ran. `argument` is the value it asked for. */
export function runCommand(id: string, snapshot: BridgeSnapshot, argument?: string): boolean {
	const def = allCommands(snapshot.facts).find((command) => command.id === id);
	if (!def || !viewOf(def, snapshot).enabled) return false;
	(snapshot.handlers[id] ?? def.run)?.(argument);
	return true;
}
