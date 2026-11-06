// The application menu's rows: the registry's commands arranged under File, Edit, View, Window and Help
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createElement } from 'react';
import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { APP_ICONS, type IconId } from '../icons/AppIcons';
import { t, type MessageId } from '../i18n/messages';
import { PANEL_SPECS } from '../panels/float/panelSpecs';
import type { BridgeSnapshot } from './commandBridge';
import {
	allCommands,
	commandLabel,
	maximiseCommandId,
	panelCommandId,
	panelWindowCommands,
	viewOf,
	type CommandView,
	type MenuName,
} from './registry';

export const MENU_IDS: Record<MenuName, string> = {
	file: 'menu:file',
	edit: 'menu:edit',
	view: 'menu:view',
	window: 'menu:window',
	help: 'menu:help',
};

/** The Edit menu's Undo history submenu. */
export const HISTORY_MENU_ID = 'menu:history';

const MENU_LABELS: Record<MenuName, MessageId> = {
	file: 'appMenu.file',
	edit: 'appMenu.edit',
	view: 'appMenu.view',
	window: 'appMenu.window',
	help: 'appMenu.help',
};

const MENU_ICONS: Record<MenuName, IconId> = {
	file: 'menu.file',
	edit: 'menu.edit',
	view: 'menu.view',
	window: 'menu.window',
	help: 'menu.help',
};

const iconFor = (id: IconId) => createElement(APP_ICONS[id]);

/** Alt plus the letter opens that menu: Alt+F File, Alt+E Edit, Alt+V View, Alt+W Window and Alt+H Help. */
export const APP_MENU_MNEMONICS: Readonly<Record<string, string>> = {
	f: MENU_IDS.file,
	e: MENU_IDS.edit,
	v: MENU_IDS.view,
	w: MENU_IDS.window,
	h: MENU_IDS.help,
};

/** The row of a command: none while it is not visible; a disabled row carries its reason as the tooltip. */
export function commandRow(view: CommandView): MenuItem[] {
	if (!view.visible) return [];
	const { def } = view;
	const common = {
		id: def.id,
		label: commandLabel(def),
		...(def.icon ? { icon: iconFor(def.icon) } : {}),
		...(def.shortcut ? { shortcut: def.shortcut } : {}),
		...(view.enabled ? {} : { disabled: true }),
		...(!view.enabled && view.reason ? { title: view.reason } : {}),
	};
	return [
		view.checked === undefined
			? { type: 'action', ...common }
			: { type: 'checkbox', checked: view.checked, ...common },
	];
}

/**
 * Joins the groups that have rows with one rule between each pair, so a group that collapses
 * (every row hidden) never leaves a stray or doubled rule, and none sits at either end.
 */
export function menuSections(...groups: MenuItem[][]): MenuItem[] {
	const items: MenuItem[] = [];
	for (const group of groups) {
		if (group.length === 0) continue;
		if (items.length > 0) items.push({ type: 'separator', id: `rule-${items.length}` });
		items.push(...group);
	}
	return items;
}

export const HISTORY_UNDO_ID = 'history:undo';
export const HISTORY_REDO_ID = 'history:redo';
export const HISTORY_EMPTY_ID = 'history:empty';
export const HISTORY_MORE_ID = 'history:more';

/** What choosing a history row runs: the step is the one Undo or Redo takes, and the footer opens the palette. */
const HISTORY_ROW_COMMANDS: Readonly<Record<string, string>> = {
	[HISTORY_UNDO_ID]: 'edit.undo',
	[HISTORY_REDO_ID]: 'edit.redo',
	[HISTORY_MORE_ID]: 'view.commandPalette',
};

/** The command a chosen menu row runs: its own id, or the command a history row stands for. */
export const commandIdOfRow = (rowId: string) => HISTORY_ROW_COMMANDS[rowId] ?? rowId;

const AUTHOR_LABELS: Readonly<Record<string, MessageId>> = {
	person: 'appMenu.history.author.person',
	claude: 'appMenu.history.author.claude',
	outside: 'appMenu.history.author.outside',
	recovered: 'appMenu.history.author.recovered',
};

/**
 * The Undo history submenu. The app knows two steps by name, the one Undo would take back and the
 * one Redo would do again, so those are the rows, newest first (the undone step above the done
 * one). They are the only steps either command can act on, so they are the enabled ones; a row is
 * disabled, with its reason as the tooltip, only when its command cannot run. The last change's
 * author belongs to the undo step unless something has been undone since, and then to the redo
 * step. With neither step there is one disabled row saying so, and the footer opens the palette.
 */
export function historyItems(snapshot: BridgeSnapshot): MenuItem[] {
	const { facts } = snapshot;
	const defs = allCommands(facts);
	const authorId = facts.author ? AUTHOR_LABELS[facts.author] : undefined;
	const author = authorId ? t(authorId) : undefined;
	const stepRow = (kind: 'undo' | 'redo'): MenuItem[] => {
		const active = kind === 'undo' ? facts.canUndo : facts.canRedo;
		if (!active) return [];
		const def = defs.find((command) => command.id === `edit.${kind}`);
		if (!def) return [];
		const view = viewOf(def, snapshot);
		const name = kind === 'undo' ? facts.undoName : facts.redoName;
		const label = name ?? t(kind === 'undo' ? 'history.undo' : 'history.redo');
		// The last change's author is the undo step's until something is undone, then the redo step's.
		const own = author !== undefined && (kind === 'redo') === facts.canRedo ? author : undefined;
		let text: string;
		if (kind === 'undo') {
			text = own ? t('appMenu.history.entryBy', { label, author: own }) : label;
		} else {
			text = own
				? t('appMenu.history.undoneBy', { label, author: own })
				: t('appMenu.history.undone', { label });
		}
		return [
			{
				type: 'action',
				id: kind === 'undo' ? HISTORY_UNDO_ID : HISTORY_REDO_ID,
				label: text,
				icon: iconFor('history'),
				...(view.enabled ? {} : { disabled: true, ...(view.reason ? { title: view.reason } : {}) }),
			},
		];
	};
	const steps = [...stepRow('redo'), ...stepRow('undo')];
	const body: MenuItem[] = steps.length
		? steps
		: [
				{
					type: 'action',
					id: HISTORY_EMPTY_ID,
					label: t('appMenu.history.empty'),
					icon: iconFor('history'),
					disabled: true,
				},
			];
	const more: MenuItem = {
		type: 'action',
		id: HISTORY_MORE_ID,
		label: t('appMenu.history.more'),
		icon: iconFor('commandPalette'),
	};
	return menuSections(body, [more]);
}

/**
 * The five menus as submenu items, each written as groups with one rule between them. A menu with
 * no row to show is left out altogether.
 */
export function appMenuItems(snapshot: BridgeSnapshot): MenuItem[] {
	const defs = allCommands(snapshot.facts);
	/** The rows of these commands, in this order, leaving out the ones that are not visible. */
	const rows = (...ids: string[]): MenuItem[] =>
		ids.flatMap((id) => {
			const def = defs.find((command) => command.id === id);
			return def ? commandRow(viewOf(def, snapshot)) : [];
		});

	const panels = PANEL_SPECS.map((spec) => panelCommandId(spec.id));
	const maximising = PANEL_SPECS.filter((spec) => spec.expandable).flatMap((spec) => [
		maximiseCommandId(spec.id, false),
		maximiseCommandId(spec.id, true),
	]);
	const panelWindows = panelWindowCommands(snapshot.facts).map((def) => def.id);

	const menus: Record<MenuName, MenuItem[]> = {
		file: menuSections(
			rows('file.new', 'file.open'),
			rows('file.save', 'file.close'),
			rows('file.preferences'),
			rows('file.quit'),
		),
		edit: menuSections([
			...rows('edit.undo', 'edit.redo'),
			{
				type: 'submenu',
				id: HISTORY_MENU_ID,
				label: t('appMenu.history'),
				icon: iconFor('history'),
				items: historyItems(snapshot),
			},
		]),
		view: menuSections(
			rows(...panels),
			rows(...maximising, 'view.levelFirst', 'view.resetLayout'),
			rows('view.commandPalette'),
		),
		window: menuSections(rows(...panelWindows)),
		help: menuSections(rows('help.help', 'help.shortcuts'), rows('help.about')),
	};

	return (Object.keys(MENU_IDS) as MenuName[]).flatMap((menu) =>
		menus[menu].length === 0
			? []
			: [
					{
						type: 'submenu',
						id: MENU_IDS[menu],
						label: t(MENU_LABELS[menu]),
						icon: iconFor(MENU_ICONS[menu]),
						items: menus[menu],
					} satisfies MenuItem,
				],
	);
}
