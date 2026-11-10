// The words for a spacing between painted cells
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t } from '../i18n/messages';

/** The words for a spacing: “Every cell”, “Every 3 cells”. */
export function spacingText(spacing: number): string {
	return spacing <= 1 ? t('spacing.everyCell') : t('spacing.everyN', { n: spacing });
}
