// The application menu's rows: the registry's commands arranged under File, Edit, View and Window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { t, type MessageId } from '../i18n/messages';
import type { BridgeSnapshot } from './commandBridge';
import { COMMANDS, commandLabel, viewOf, type CommandView, type MenuName } from './registry';

export const MENU_IDS: Record<MenuName, string> = {
	file: 'menu:file',
	edit: 'menu:edit',
	view: 'menu:view',
	window: 'menu:window',
};

const MENU_LABELS: Record<MenuName, MessageId> = {
	file: 'appMenu.file',
	edit: 'appMenu.edit',
	view: 'appMenu.view',
	window: 'appMenu.window',
};

/** Alt plus the letter opens that menu: Alt+F File, Alt+E Edit, Alt+V View and Alt+W Window. */
export const APP_MENU_MNEMONICS: Readonly<Record<string, string>> = {
	f: MENU_IDS.file,
	e: MENU_IDS.edit,
	v: MENU_IDS.view,
	w: MENU_IDS.window,
};

function row(view: CommandView): MenuItem {
	const { def } = view;
	const common = {
		id: def.id,
		label: commandLabel(def),
		...(def.shortcut ? { shortcut: def.shortcut } : {}),
		...(view.enabled ? {} : { disabled: true }),
		...(def.unavailable ? { title: t(def.unavailable) } : {}),
	};
	return view.checked === undefined
		? { type: 'action', ...common }
		: { type: 'checkbox', checked: view.checked, ...common };
}

/** The four menus as submenu items, with a rule between a menu's sections. */
export function appMenuItems(snapshot: BridgeSnapshot): MenuItem[] {
	return (Object.keys(MENU_IDS) as MenuName[]).map((menu): MenuItem => {
		const items: MenuItem[] = [];
		let section: number | null = null;
		for (const def of COMMANDS.filter((command) => command.menu === menu)) {
			if (section !== null && def.section !== section) {
				items.push({ type: 'separator', id: `${menu}-rule-${def.section}` });
			}
			section = def.section;
			items.push(row(viewOf(def, snapshot)));
		}
		return { type: 'submenu', id: MENU_IDS[menu], label: t(MENU_LABELS[menu]), items };
	});
}
