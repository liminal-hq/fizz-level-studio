// Stands in for a panel in the main window while the panel is open in a window of its own
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t } from '../i18n/messages';
import styles from './TornOffNotice.module.css';

export interface TornOffNoticeProps {
	/** The panel's name, such as “Script”. */
	title: string;
	onDockBack: () => void;
}

export function TornOffNotice({ title, onDockBack }: TornOffNoticeProps) {
	return (
		<section className={styles.notice}>
			<p className={styles.message}>{t('panel.tornOff', { title })}</p>
			<button type="button" className={styles.button} onClick={onDockBack}>
				{t('panel.dockBack')}
			</button>
		</section>
	);
}
