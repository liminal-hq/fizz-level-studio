// The item spacing control: a keycap stepper that sets how far apart dragged items fall
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t } from '../i18n/messages';
import { MAX_SPACING } from './brush';
import { SPACING_KEYS } from './shortcuts';
import styles from './SpacingStepper.module.css';
import { spacingText } from './ToolPalette';

export interface SpacingStepperProps {
	spacing: number;
	onSpacing: (spacing: number) => void;
	/** False while the brush is not an item: the stepper then shows the setting but cannot change it. */
	active: boolean;
}

export function SpacingStepper({ spacing, onSpacing, active }: SpacingStepperProps) {
	return (
		<div className={styles.spacing} role="group" aria-label={t('spacing.group')}>
			<button
				type="button"
				className={styles.step}
				aria-label={t('spacing.less')}
				aria-keyshortcuts={SPACING_KEYS.less}
				disabled={!active || spacing <= 1}
				onClick={() => onSpacing(spacing - 1)}
			>
				{t('spacing.lessGlyph')}
			</button>
			<span className={styles.value}>{spacingText(spacing)}</span>
			<button
				type="button"
				className={styles.step}
				aria-label={t('spacing.more')}
				aria-keyshortcuts={SPACING_KEYS.more}
				disabled={!active || spacing >= MAX_SPACING}
				onClick={() => onSpacing(spacing + 1)}
			>
				{t('spacing.moreGlyph')}
			</button>
		</div>
	);
}
