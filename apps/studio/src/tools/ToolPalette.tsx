// The tool buttons and the current-tile and current-item choosers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t, type MessageId } from '../i18n/messages';
import { ITEM_WORDS, TOOL_KEYS } from './shortcuts';
import styles from './ToolPalette.module.css';
import { TOOL_IDS, type ToolId } from './tool';
import type { ToolHandle } from './useTool';

export interface ToolPaletteProps {
	handle: Pick<ToolHandle, 'tool' | 'setTool' | 'tile' | 'setTile' | 'item' | 'setItem'>;
	/** The tile words of the open level (`LevelView.palette`). */
	palette: readonly string[];
}

const TOOL_LABELS: Record<ToolId, MessageId> = {
	paint: 'tools.paint',
	erase: 'tools.erase',
	pick: 'tools.pick',
	select: 'tools.select',
	stamp: 'tools.stamp',
};

export function ToolPalette({ handle, palette }: ToolPaletteProps) {
	const tiles = palette.includes(handle.tile) ? palette : [handle.tile, ...palette];
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
			<label className={styles.chooser}>
				<span>{t('tools.tile')}</span>
				<select value={handle.tile} onChange={(event) => handle.setTile(event.target.value)}>
					{tiles.map((word) => (
						<option key={word} value={word}>
							{word}
						</option>
					))}
				</select>
			</label>
			<label className={styles.chooser}>
				<span>{t('tools.item')}</span>
				<select value={handle.item} onChange={(event) => handle.setItem(event.target.value)}>
					{ITEM_WORDS.map((word) => (
						<option key={word} value={word}>
							{word}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
