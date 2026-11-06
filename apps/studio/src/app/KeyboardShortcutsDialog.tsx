// The Keyboard shortcuts dialog: the keys the studio answers to and what each does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Dialog } from '@liminal-hq/fizz-studio-chrome/Dialog/Dialog';
import { DialogActions, DialogButton } from '@liminal-hq/fizz-studio-chrome/Dialog/DialogActions';
import {
	CLOSE_LEVEL_KEYS,
	COMMAND_PALETTE_KEYS,
	HELP_KEYS,
	MAXIMISE_KEYS,
	NEW_LEVEL_KEYS,
	OPEN_LEVEL_KEYS,
	QUIT_KEYS,
	SHORTCUTS_KEYS,
} from '../commands/registry';
import { t, type MessageId } from '../i18n/messages';
import { TOOL_KEYS } from '../tools/shortcuts';
import { TOOL_IDS } from '../tools/tool';
import styles from './KeyboardShortcutsDialog.module.css';

export interface ShortcutRow {
	/** The keys, as written on the menu rows; alternatives are separated by a comma. */
	keys: string;
	action: MessageId;
}

/** The keys the studio handles now, in the order of the table in the editor spec (section 3). */
export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
	{ keys: TOOL_IDS.map((id) => TOOL_KEYS[id].toUpperCase()).join(', '), action: 'shortcuts.tools' },
	{ keys: 'Ctrl+Z, Ctrl+Shift+Z', action: 'shortcuts.undoRedo' },
	{ keys: 'Ctrl+S', action: 'shortcuts.save' },
	{ keys: NEW_LEVEL_KEYS, action: 'shortcuts.newLevel' },
	{ keys: OPEN_LEVEL_KEYS, action: 'shortcuts.openLevel' },
	{ keys: CLOSE_LEVEL_KEYS, action: 'shortcuts.closeLevel' },
	{ keys: 'Ctrl+,', action: 'shortcuts.preferences' },
	{ keys: QUIT_KEYS, action: 'shortcuts.quit' },
	{ keys: COMMAND_PALETTE_KEYS, action: 'shortcuts.commandPalette' },
	{ keys: 'Tab', action: 'shortcuts.levelFirst' },
	{ keys: MAXIMISE_KEYS, action: 'shortcuts.maximise' },
	{ keys: 'Ctrl+Shift+0', action: 'shortcuts.resetLayout' },
	{ keys: HELP_KEYS, action: 'shortcuts.help' },
	{ keys: SHORTCUTS_KEYS, action: 'shortcuts.shortcuts' },
];

export interface KeyboardShortcutsDialogProps {
	open: boolean;
	/** The Close button, Esc and a backdrop click all land here. */
	onClose: () => void;
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
	return (
		<Dialog
			open={open}
			title={t('shortcuts.title')}
			description={t('shortcuts.description')}
			size="medium"
			onClose={() => onClose()}
			footer={
				<DialogActions>
					<DialogButton variant="primary" onClick={onClose}>
						{t('chrome.close')}
					</DialogButton>
				</DialogActions>
			}
		>
			<div className={styles.scroll}>
				<table className={styles.table} aria-label={t('shortcuts.table')}>
					<thead>
						<tr>
							<th scope="col">{t('shortcuts.keys')}</th>
							<th scope="col">{t('shortcuts.action')}</th>
						</tr>
					</thead>
					<tbody>
						{SHORTCUT_ROWS.map((row) => (
							<tr key={row.action}>
								<td className={styles.keys}>
									{row.keys.split(', ').map((keys, index) => (
										<span key={keys}>
											{index > 0 ? ' ' : ''}
											<kbd className={styles.key}>{keys}</kbd>
										</span>
									))}
								</td>
								<td>{t(row.action)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Dialog>
	);
}
