// The tool buttons and the current-tile and current-item choosers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t, type MessageId } from '../i18n/messages';
import { ITEM_WORDS, TOOL_KEYS } from './shortcuts';
import styles from './ToolPalette.module.css';
import { TOOL_IDS, type ToolId } from './tool';
import type { ToolHandle } from './useTool';
import { WordChooser } from './WordChooser';

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
			<WordChooser
				label={t('tools.tile')}
				value={handle.tile}
				options={tiles}
				onChoose={(word) => {
					handle.setTile(word);
					handle.setTool('paint');
				}}
			/>
			<WordChooser
				label={t('tools.item')}
				value={handle.item}
				options={ITEM_WORDS}
				onChoose={(word) => {
					handle.setItem(word);
					handle.setTool('stamp');
				}}
			/>
		</div>
	);
}
