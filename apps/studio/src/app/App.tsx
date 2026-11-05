// The root of every window: the window frame, the title bar, and the window's content
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { WindowFrame } from '@liminal-hq/fizz-studio-chrome/WindowFrame';
import styles from './App.module.css';
import { AppTitleBar } from './AppTitleBar';
import { AppWindowChrome } from './AppWindowChrome';

interface AppProps {
	/** The label Rust gave this window, such as `main-1`. */
	windowLabel: string;
}

export function App({ windowLabel }: AppProps) {
	return (
		<AppWindowChrome>
			<WindowFrame>
				<AppTitleBar title="Fizz Level Studio" />
				<main className={styles.app}>
					<h1 className={styles.title}>Fizz Level Studio</h1>
					<p className={styles.label} data-testid="window-label">
						{windowLabel}
					</p>
				</main>
			</WindowFrame>
		</AppWindowChrome>
	);
}
