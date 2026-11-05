// The application menu in the title bar: File, Edit, View, Window and Help over the main window's commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { AppMenuButton } from '@liminal-hq/fizz-studio-chrome/TitleBar/AppMenuButton';
import appMark from '../assets/app-mark.svg';
import { APP_MENU_MNEMONICS } from '../commands/appMenuModel';
import { t } from '../i18n/messages';
import styles from './AppMenu.module.css';
import { useAppMenu } from './useAppMenu';

interface AppMenuProps {
	/**
	 * The menu bar below the title bar is showing and carries the menus: the mark and name stay as
	 * plain text that opens nothing, and the keys (F10, Alt, Alt+F, E, V, W and H) are the bar's.
	 */
	menuBar?: boolean;
}

/**
 * The menu button for the Main window's title bar start slot: the app mark and name, opening the
 * menus, which are the studio's primary menu. F10 or a lone Alt toggles it, and Alt+F, E, V, W and H
 * open it with that menu out.
 */
export function AppMenu({ menuBar = false }: AppMenuProps) {
	const { items, onSelect } = useAppMenu();
	return (
		<AppMenuButton
			label={t('app.name')}
			mark={<img className={styles.mark} src={appMark} alt="" />}
			items={items}
			onSelect={onSelect}
			mnemonics={APP_MENU_MNEMONICS}
			interactive={!menuBar}
		/>
	);
}
