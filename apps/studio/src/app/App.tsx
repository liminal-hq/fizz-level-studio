// The root of every window: it picks the screen the window's label names
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useMemo } from 'react';
import type { MessageId } from '../i18n/messages';
import { t } from '../i18n/messages';
import styles from './App.module.css';
import { AppWindow } from './AppWindow';
import { MainScreen } from './MainScreen';
import { PanelWindowScreen } from '../panels/PanelWindowScreen';
import { NewLevelScreen } from './NewLevelScreen';
import { PreferencesScreen } from '../preferences/PreferencesScreen';
import { createPanelBridge } from '../panels/windows/panelBridge';
import { windowKindFromLabel } from './windowKind';

interface AppProps {
	/** The label Rust gave this window, such as `main-1`. */
	windowLabel: string;
}

/** A window whose screen is not built yet: the frame, its title, and one line. */
function PlaceholderScreen({ titleId, messageId }: { titleId: MessageId; messageId: MessageId }) {
	return (
		<AppWindow titleId={titleId}>
			<main className={styles.app}>
				<p className={styles.message}>{t(messageId)}</p>
			</main>
		</AppWindow>
	);
}

export function App({ windowLabel }: AppProps) {
	const kind = windowKindFromLabel(windowLabel);
	// A main window's end of the channel to its torn-off panels.
	const panelBridge = useMemo(
		() => (kind === 'main' ? createPanelBridge(windowLabel, false) : undefined),
		[kind, windowLabel],
	);
	switch (kind) {
		case 'main':
			return <MainScreen panelBridge={panelBridge} />;
		case 'about':
			return <PlaceholderScreen titleId="window.about.title" messageId="placeholder.about" />;
		case 'preferences':
			return <PreferencesScreen />;
		case 'new-world':
			return <NewLevelScreen />;
		case 'panel':
			return <PanelWindowScreen windowLabel={windowLabel} />;
		default:
			// The tear ghost has no screen yet, and an unknown label shows nothing.
			return null;
	}
}
