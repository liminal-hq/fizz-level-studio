// The content of a torn-off panel's window, with the way to dock it back
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { AppWindow } from '../app/AppWindow';
import { panelFromLabel } from '../app/windowKind';
import { t, type MessageId } from '../i18n/messages';
import { panelWindowClient, type PanelWindowClient } from '../services/panelWindowClient';
import styles from './PanelWindowScreen.module.css';

export interface PanelWindowScreenProps {
	/** The label Rust gave this window, such as `panel-script-1`. */
	windowLabel: string;
	client?: PanelWindowClient;
}

/** The panels that have a window screen so far, with their title and the line shown until built. */
const PANELS: Record<string, { title: MessageId; message: MessageId }> = {
	script: { title: 'window.panelScript.title', message: 'placeholder.panelScript' },
};

/**
 * A panel's own window. Until each panel's real window exists this is a placeholder: the frame, the
 * panel's title, one line, and Dock back, which closes the window and so puts the panel back.
 */
export function PanelWindowScreen({
	windowLabel,
	client = panelWindowClient,
}: PanelWindowScreenProps) {
	const panel = panelFromLabel(windowLabel);
	const known = panel === null ? undefined : PANELS[panel];
	if (panel === null || !known) return null;
	return (
		<AppWindow titleId={known.title}>
			<main className={styles.panel}>
				<p className={styles.message}>{t(known.message)}</p>
				<button type="button" className={styles.button} onClick={() => void client.dockBack(panel)}>
					{t('panel.dockBack')}
				</button>
			</main>
		</AppWindow>
	);
}
