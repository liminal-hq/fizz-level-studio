// The application menu in the title bar: File, Edit, View, Window and Help over the main window's commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { AppMenuButton } from '@liminal-hq/fizz-studio-chrome/TitleBar/AppMenuButton';
import appMark from '../assets/app-mark.svg';
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
 * flat app menu (New, Open, Save, Undo, the switches, Panels, Window, Preferences, Help, Quit) while
 * the menu bar is off. F10 or a lone Alt toggles it; with no menu names there are no letter keys.
 */
export function AppMenu({ menuBar = false }: AppMenuProps) {
	const { items, onSelect } = useAppMenu();
	return (
		<AppMenuButton
			label={t('app.name')}
			mark={<img className={styles.mark} src={appMark} alt="" />}
			items={items}
			onSelect={onSelect}
			interactive={!menuBar}
		/>
	);
}
