// Stands in for a panel in the main window while the panel is open in a window of its own
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t, type MessageId } from '../i18n/messages';
import styles from './ScriptPanel.module.css';

export interface TornOffNoticeProps {
	/** What to say: the catalogue key of the line naming the panel that is away. */
	messageId: MessageId;
	onDockBack: () => void;
}

export function TornOffNotice({ messageId, onDockBack }: TornOffNoticeProps) {
	return (
		<section className={styles.panel}>
			<p className={styles.none}>{t(messageId)}</p>
			<button type="button" className={styles.tearOff} onClick={onDockBack}>
				{t('panel.dockBack')}
			</button>
		</section>
	);
}
