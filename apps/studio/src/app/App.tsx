// The root of every window: it names the window it is running in
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import styles from './App.module.css';

interface AppProps {
	/** The label Rust gave this window, such as `main-1`. */
	windowLabel: string;
}

export function App({ windowLabel }: AppProps) {
	return (
		<main className={styles.app}>
			<h1 className={styles.title}>Fizz Level Studio</h1>
			<p className={styles.label} data-testid="window-label">
				{windowLabel}
			</p>
		</main>
	);
}
