// A small live sample of the accent and glass choices: a lit key, a glass strip and the contrast result
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { t } from '../i18n/messages';
import { applyAccent, deriveAccent, reportKey, type Scheme } from '../theme/accent';
import styles from './AccentPreview.module.css';

export interface AccentPreviewProps {
	/** The `#rrggbb` accent, or null for the studio cyan. */
	accent: string | null;
	scheme: Scheme;
	/** Draw the strip solid, as the panels will. */
	solid: boolean;
}

const SOLID: CSSProperties = {
	['--fls-glass-blur' as string]: '0px',
	['--fls-glass-bg' as string]: 'var(--fls-glass-bg-solid)',
};

export function AccentPreview({ accent, scheme, solid }: AccentPreviewProps) {
	const box = useRef<HTMLDivElement>(null);
	const derived = deriveAccent(accent, scheme);
	const report = reportKey(derived);
	const ratio = report.ratio.toFixed(1);
	const reportId = useId();

	// The derived colours are set on this box alone, so the sample uses the real keycap and glass rules.
	useLayoutEffect(() => {
		if (box.current) applyAccent(derived, box.current);
	}, [derived.accent, derived.litTop, derived.ink]);

	return (
		<div
			ref={box}
			className={styles.preview}
			style={solid ? SOLID : undefined}
			role="group"
			aria-label={t('preferences.preview.label')}
			aria-describedby={reportId}
		>
			<div className={styles.samples}>
				<span className={styles.key} data-testid="preview-key">
					{t('preferences.preview.key')}
				</span>
				<div className={styles.strip} data-testid="preview-strip">
					<span className={styles.accentText}>{t('preferences.preview.strip')}</span>
				</div>
			</div>
			<p id={reportId} className={styles.report}>
				{t('preferences.preview.contrast', { ink: derived.ink, ratio })}
				{report.darkened ? ` ${t('preferences.preview.darkened')}` : ''}
			</p>
		</div>
	);
}
