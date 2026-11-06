// The row above the level: the leading controls (Save and Close level), the brush chip and the Stamp hint
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import { t, type MessageId } from '../i18n/messages';
import { brushSwatch } from './swatch';
import styles from './ToolPalette.module.css';
import type { ToolHandle } from './useTool';

export interface ToolPaletteProps {
	handle: Pick<ToolHandle, 'tool' | 'brush' | 'spacing' | 'clip'>;
	/** Controls for the start of the row (Save and Close level), set off from the brush by a thin divider. */
	lead?: ReactNode;
}

const GROUP_LABELS = {
	tile: 'brush.group.tile',
	item: 'brush.group.item',
	enemy: 'brush.group.enemy',
} as const satisfies Record<string, MessageId>;

/** The words for a spacing: “Every cell”, “Every 3 cells”. */
export function spacingText(spacing: number): string {
	return spacing <= 1 ? t('spacing.everyCell') : t('spacing.everyN', { n: spacing });
}

/** The tools themselves float over the map in the tool picker (`ToolPicker`). */
export function ToolPalette({ handle, lead }: ToolPaletteProps) {
	const { brush, spacing } = handle;
	const spaced = brush.group === 'item';
	return (
		<div className={styles.palette} role="group" aria-label={t('tools.bar')}>
			{lead ? (
				<>
					<div className={styles.lead}>{lead}</div>
					<span className={styles.divider} aria-hidden="true" />
				</>
			) : null}
			<span
				className={styles.chip}
				role="status"
				title={t(GROUP_LABELS[brush.group])}
				data-group={brush.group}
			>
				<span className={styles.swatch} style={brushSwatch(brush)} aria-hidden="true">
					{brush.kind.charAt(0).toUpperCase()}
				</span>
				{spaced
					? t('brush.chipSpaced', { kind: brush.kind, spacing: spacingText(spacing) })
					: t('brush.chip', { kind: brush.kind })}
			</span>
			{handle.tool === 'stamp' && !handle.clip && (
				<span className={styles.hint}>{t('tools.stampEmpty')}</span>
			)}
		</div>
	);
}
