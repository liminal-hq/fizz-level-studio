// The tool buttons, the brush chip and the item spacing control
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t, type MessageId } from '../i18n/messages';
import { MAX_SPACING } from './brush';
import { SPACING_KEYS, TOOL_KEYS } from './shortcuts';
import { brushSwatch } from './swatch';
import styles from './ToolPalette.module.css';
import { TOOL_IDS, type ToolId } from './tool';
import type { ToolHandle } from './useTool';

export interface ToolPaletteProps {
	handle: Pick<ToolHandle, 'tool' | 'setTool' | 'brush' | 'spacing' | 'setSpacing' | 'clip'>;
}

const TOOL_LABELS: Record<ToolId, MessageId> = {
	paint: 'tools.paint',
	erase: 'tools.erase',
	pick: 'tools.pick',
	select: 'tools.select',
	stamp: 'tools.stamp',
};

const GROUP_LABELS = {
	tile: 'brush.group.tile',
	item: 'brush.group.item',
	enemy: 'brush.group.enemy',
} as const satisfies Record<string, MessageId>;

/** The words for a spacing: “Every cell”, “Every 3 cells”. */
export function spacingText(spacing: number): string {
	return spacing <= 1 ? t('spacing.everyCell') : t('spacing.everyN', { n: spacing });
}

export function ToolPalette({ handle }: ToolPaletteProps) {
	const { brush, spacing } = handle;
	const spaced = brush.group === 'item';
	return (
		<div className={styles.palette} role="group" aria-label={t('tools.group')}>
			<div className={styles.tools}>
				{TOOL_IDS.map((id) => (
					<button
						key={id}
						type="button"
						className={styles.tool}
						aria-pressed={handle.tool === id}
						aria-keyshortcuts={TOOL_KEYS[id].toUpperCase()}
						onClick={() => handle.setTool(id)}
					>
						{t(TOOL_LABELS[id])}
						<kbd className={styles.key} aria-hidden="true">
							{TOOL_KEYS[id].toUpperCase()}
						</kbd>
					</button>
				))}
			</div>
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
			{spaced && (
				<div className={styles.spacing} role="group" aria-label={t('spacing.group')}>
					<span>{t('spacing.label')}</span>
					<button
						type="button"
						className={styles.step}
						aria-label={t('spacing.less')}
						aria-keyshortcuts={SPACING_KEYS.less}
						disabled={spacing <= 1}
						onClick={() => handle.setSpacing(spacing - 1)}
					>
						{t('spacing.lessGlyph')}
					</button>
					<span className={styles.spacingValue}>{spacingText(spacing)}</span>
					<button
						type="button"
						className={styles.step}
						aria-label={t('spacing.more')}
						aria-keyshortcuts={SPACING_KEYS.more}
						disabled={spacing >= MAX_SPACING}
						onClick={() => handle.setSpacing(spacing + 1)}
					>
						{t('spacing.moreGlyph')}
					</button>
				</div>
			)}
			{handle.tool === 'stamp' && !handle.clip && (
				<span className={styles.hint}>{t('tools.stampEmpty')}</span>
			)}
		</div>
	);
}
