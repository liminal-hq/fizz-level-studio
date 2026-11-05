// The palette: tiles, items and enemies in one list, the only place the brush is chosen
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useState, type KeyboardEvent } from 'react';
import { t, type MessageId } from '../i18n/messages';
import { BRUSH_GROUPS, brushWords, sameBrush, type Brush, type BrushGroup } from '../tools/brush';
import { brushSwatch } from '../tools/swatch';
import styles from './PalettePanel.module.css';

export interface PalettePanelProps {
	/** The tile words of the open level (`LevelView.palette`). */
	tiles: readonly string[];
	/** The language's documented words, from the backend; their notes show as tooltips. */
	words: readonly WordDoc[];
	brush: Brush;
	/** Chooses the brush; the caller also switches the tool to Paint. */
	onBrush: (brush: Brush) => void;
}

const TAB_LABELS = {
	tile: 'palette.tiles',
	item: 'palette.items',
	enemy: 'palette.enemies',
} as const satisfies Record<BrushGroup, MessageId>;

/** Left and right move between the tabs, as a tab list does. */
function nextGroup(group: BrushGroup, key: string): BrushGroup | null {
	const at = BRUSH_GROUPS.indexOf(group);
	if (key === 'ArrowRight') return BRUSH_GROUPS[(at + 1) % BRUSH_GROUPS.length] ?? null;
	if (key === 'ArrowLeft') {
		return BRUSH_GROUPS[(at + BRUSH_GROUPS.length - 1) % BRUSH_GROUPS.length] ?? null;
	}
	return null;
}

export function PalettePanel({ tiles, words: docs, brush, onBrush }: PalettePanelProps) {
	// The tab follows the brush when Pick or a stroke changes its group.
	const [shown, setShown] = useState<BrushGroup>(brush.group);
	const [lastGroup, setLastGroup] = useState<BrushGroup>(brush.group);
	if (lastGroup !== brush.group) {
		setLastGroup(brush.group);
		setShown(brush.group);
	}
	const words = brushWords(shown, tiles, docs);
	const noteOf = (word: string) =>
		docs.find((doc) => doc.word === word && doc.kind === (shown === 'tile' ? 'tile' : shown))
			?.note || undefined;

	const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const next = nextGroup(shown, event.key);
		if (!next) return;
		event.preventDefault();
		setShown(next);
		event.currentTarget.parentElement
			?.querySelector<HTMLElement>(`[data-group="${next}"]`)
			?.focus();
	};

	return (
		<div className={styles.panel}>
			<div className={styles.tabs} role="tablist" aria-label={t('palette.groups')}>
				{BRUSH_GROUPS.map((group) => (
					<button
						key={group}
						type="button"
						role="tab"
						data-group={group}
						className={styles.tab}
						aria-selected={shown === group}
						tabIndex={shown === group ? 0 : -1}
						onClick={() => setShown(group)}
						onKeyDown={onTabKeyDown}
					>
						{t(TAB_LABELS[group])}
					</button>
				))}
			</div>
			<ul className={styles.list} aria-label={t('palette.list', { group: t(TAB_LABELS[shown]) })}>
				{words.map((word) => {
					const entry: Brush = { group: shown, kind: word };
					return (
						<li key={word}>
							<button
								type="button"
								className={styles.entry}
								aria-pressed={sameBrush(brush, entry)}
								data-group={shown}
								title={noteOf(word)}
								onClick={() => onBrush(entry)}
							>
								<span className={styles.swatch} style={brushSwatch(entry)} aria-hidden="true">
									{word.charAt(0).toUpperCase()}
								</span>
								<span className={styles.name}>{word}</span>
							</button>
						</li>
					);
				})}
			</ul>
			{shown !== 'tile' && docs.length === 0 && (
				<p className={styles.note}>{t('palette.unavailable')}</p>
			)}
		</div>
	);
}
