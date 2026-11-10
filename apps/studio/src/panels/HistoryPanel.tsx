// Undo and redo buttons that name the step they would take, plus the keys that press them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useSurfaceMenu } from '../app/useSurfaceMenu';
import { t } from '../i18n/messages';
import styles from './HistoryPanel.module.css';

export interface HistoryPanelProps {
	canUndo: boolean;
	canRedo: boolean;
	/** `LevelSnapshot.undo_name`, such as `Paint grass`. */
	undoName: string | null;
	redoName: string | null;
	onUndo: () => void;
	onRedo: () => void;
}

export type HistoryAction = 'undo' | 'redo';

/** Ctrl+Z is undo; Ctrl+Shift+Z and Ctrl+Y are redo. Command stands in for Ctrl on a Mac. */
export function historyShortcut(
	event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): HistoryAction | null {
	if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
	const key = event.key.toLowerCase();
	if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
	if (key === 'y' && !event.shiftKey) return 'redo';
	return null;
}

export function HistoryPanel({
	canUndo,
	canRedo,
	undoName,
	redoName,
	onUndo,
	onRedo,
}: HistoryPanelProps) {
	const panelMenu = useSurfaceMenu<HTMLDivElement>(() => ({ kind: 'history' }));
	return (
		<div className={styles.panel} {...panelMenu}>
			<div className={styles.buttons}>
				<button
					type="button"
					className={styles.button}
					disabled={!canUndo}
					aria-keyshortcuts="Control+Z"
					onClick={onUndo}
				>
					{undoName ? t('history.undoNamed', { name: undoName }) : t('history.undo')}
				</button>
				<button
					type="button"
					className={styles.button}
					disabled={!canRedo}
					aria-keyshortcuts="Control+Shift+Z"
					onClick={onRedo}
				>
					{redoName ? t('history.redoNamed', { name: redoName }) : t('history.redo')}
				</button>
			</div>
		</div>
	);
}
