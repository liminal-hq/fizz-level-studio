// The application menu's rows: the registry's commands arranged under File, Edit, View, Window and Help
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createElement } from 'react';
import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { APP_ICONS, type IconId } from '../icons/AppIcons';
import { t, type MessageId } from '../i18n/messages';
import type { BridgeSnapshot } from './commandBridge';
import { allCommands, commandLabel, viewOf, type CommandView, type MenuName } from './registry';

export const MENU_IDS: Record<MenuName, string> = {
	file: 'menu:file',
	edit: 'menu:edit',
	view: 'menu:view',
	window: 'menu:window',
	help: 'menu:help',
};

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

function row(view: CommandView): MenuItem {
	const { def } = view;
	const common = {
		id: def.id,
		label: commandLabel(def),
		...(def.icon ? { icon: iconFor(def.icon) } : {}),
		...(def.shortcut ? { shortcut: def.shortcut } : {}),
		...(view.enabled ? {} : { disabled: true }),
		...(def.unavailable ? { title: t(def.unavailable) } : {}),
	};
	return view.checked === undefined
		? { type: 'action', ...common }
		: { type: 'checkbox', checked: view.checked, ...common };
}

/** The five menus as submenu items, with a rule between a menu's sections. */
export function appMenuItems(snapshot: BridgeSnapshot): MenuItem[] {
	const menus: MenuItem[] = [];
	for (const menu of Object.keys(MENU_IDS) as MenuName[]) {
		const items: MenuItem[] = [];
		let section: number | null = null;
		for (const def of allCommands(snapshot.facts).filter(
			(command) => command.menu === menu && !command.hidden?.(snapshot.facts),
		)) {
			if (section !== null && def.section !== section) {
				items.push({ type: 'separator', id: `${menu}-rule-${def.section}` });
			}
			section = def.section;
			items.push(row(viewOf(def, snapshot)));
		}
		// A menu with no visible row (the Window menu on the start screen) is left out altogether.
		if (items.length === 0) continue;
		menus.push({
			type: 'submenu',
			id: MENU_IDS[menu],
			label: t(MENU_LABELS[menu]),
			icon: iconFor(MENU_ICONS[menu]),
			items,
		});
	}
	return menus;
}
