// The start screen's offer to restore or discard levels whose unsaved changes survived a crash
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { formatLocale } from '../i18n/active';
import { t } from '../i18n/messages';
import type { RecoveryEntry } from '../worlds/recoveryClient';
import styles from './MainScreen.module.css';

export interface RecoverySectionProps {
	entries: RecoveryEntry[];
	/** True while another action is running; the buttons wait. */
	busy: boolean;
	onRestore: (entry: RecoveryEntry) => void;
	onDiscard: (entry: RecoveryEntry) => void;
	onDiscardAll: () => void;
}

/** A moment as the active locale writes a date and time. */
export function formatKept(ms: bigint): string {
	return new Intl.DateTimeFormat(formatLocale(), {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(Number(ms)));
}

/** Lists each recovery copy with Restore and Discard; renders nothing when there are none. */
export function RecoverySection({
	entries,
	busy,
	onRestore,
	onDiscard,
	onDiscardAll,
}: RecoverySectionProps) {
	if (entries.length === 0) return null;
	return (
		<section className={styles.recent} aria-labelledby="recovered-heading">
			<h2 id="recovered-heading" className={styles.heading}>
				{t('main.recovered')}
			</h2>
			<p className={styles.muted}>{t('main.recoveredHint')}</p>
			<ul className={styles.list}>
				{entries.map((entry) => (
					<li key={entry.id} className={styles.recovery}>
						<div className={styles.recoveryText}>
							<span>{entry.name}</span>
							<span className={styles.folder}>{entry.path}</span>
							<span className={styles.folder}>
								{t('main.recoveredKept', { time: formatKept(entry.saved_at_ms) })}
							</span>
						</div>
						<button
							type="button"
							className={styles.button}
							disabled={busy}
							aria-label={t('main.restoreNamed', { name: entry.name })}
							onClick={() => onRestore(entry)}
						>
							{t('main.restore')}
						</button>
						<button
							type="button"
							className={styles.button}
							disabled={busy}
							aria-label={t('main.discardNamed', { name: entry.name })}
							onClick={() => onDiscard(entry)}
						>
							{t('main.discard')}
						</button>
					</li>
				))}
			</ul>
			<button type="button" className={styles.button} disabled={busy} onClick={onDiscardAll}>
				{t('main.discardAll')}
			</button>
		</section>
	);
}
