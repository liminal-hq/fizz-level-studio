// A window's frame: the chrome, the visible surface, the title bar and the content below it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { WindowFrame } from '@liminal-hq/fizz-studio-chrome/WindowFrame';
import type { ReactNode } from 'react';
import styles from './App.module.css';
import { AppTitleBar, type AppTitleBarProps } from './AppTitleBar';
import { AppWindowChrome } from './AppWindowChrome';

export interface AppWindowProps extends AppTitleBarProps {
	children: ReactNode;
	/** A row of menus between the title bar and the content: the Main window's menu bar. */
	menuBar?: ReactNode;
	/** The commands row under the menu bar (or the title bar when there is none): the toolbar or the ribbon. */
	toolbar?: ReactNode;
}

export function AppWindow({ children, menuBar, toolbar, ...title }: AppWindowProps) {
	return (
		<AppWindowChrome>
			<WindowFrame className={styles.surface}>
				<AppTitleBar {...title} />
				{menuBar}
				{toolbar}
				{children}
			</WindowFrame>
		</AppWindowChrome>
	);
}
