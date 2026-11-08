// The menu bar under the Main window's title bar: the application menu's menus laid out across it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { MenuBar } from '@liminal-hq/fizz-studio-chrome/MenuBar/MenuBar';
import { APP_MENU_MNEMONICS } from '../commands/appMenuModel';
import { t } from '../i18n/messages';
import { useSurfaceMenu } from './useSurfaceMenu';
import type { ReactNode } from 'react';
import styles from './AppMenuBar.module.css';
import { useAppMenu } from './useAppMenu';

/** The same menus, rows and commands as the title bar's application menu, laid across a bar; shown only when the menu bar setting is on. */
export interface AppMenuBarProps {
	/** Controls at the right end of the row: the command search and the workspace switcher. */
	end?: ReactNode;
}

export function AppMenuBar({ end }: AppMenuBarProps) {
	const { items, onSelect } = useAppMenu('bar');
	const rowMenu = useSurfaceMenu<HTMLDivElement>(() => ({ kind: 'commandsRow', row: 'menuBar' }));
	const bar = (
		<MenuBar
			items={items}
			onSelect={onSelect}
			label={t('menuBar.label')}
			moreLabel={t('menuBar.more')}
			mnemonics={APP_MENU_MNEMONICS}
			transparent
		/>
	);
	// The wrapper carries the row's menu; `bare` has no box of its own, so the bar lays out as before.
	if (!end)
		return (
			<div className={styles.bare} {...rowMenu}>
				{bar}
			</div>
		);
	return (
		<div className={styles.row}>
			<div className={styles.fill} {...rowMenu}>
				{bar}
			</div>
			<div className={styles.end}>{end}</div>
		</div>
	);
}
