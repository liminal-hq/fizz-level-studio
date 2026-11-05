// The menu bar under the Main window's title bar: the application menu's menus laid out across it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { MenuBar } from '@liminal-hq/fizz-studio-chrome/MenuBar/MenuBar';
import { APP_MENU_MNEMONICS } from '../commands/appMenuModel';
import { t } from '../i18n/messages';
import { useAppMenu } from './useAppMenu';

/** The same menus, rows and commands as the title bar's application menu, laid across a bar; shown only when the menu bar setting is on. */
export function AppMenuBar() {
	const { items, onSelect } = useAppMenu();
	return (
		<MenuBar
			items={items}
			onSelect={onSelect}
			label={t('menuBar.label')}
			moreLabel={t('menuBar.more')}
			mnemonics={APP_MENU_MNEMONICS}
			transparent
		/>
	);
}
