// The Keyboard shortcuts dialog: the keys the studio answers to and what each does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Dialog } from '@liminal-hq/fizz-studio-chrome/Dialog/Dialog';
import { DialogActions, DialogButton } from '@liminal-hq/fizz-studio-chrome/Dialog/DialogActions';
import { NO_FACTS } from '../commands/commandBridge';
import { allCommands, shortcutOf } from '../commands/registry';
import { t, type MessageId } from '../i18n/messages';
import { toolCommandId } from '../commands/registry';
import { TOOL_IDS } from '../tools/tool';
import styles from './KeyboardShortcutsDialog.module.css';

export interface ShortcutRow {
	/** The keys, as written on the menu rows; alternatives are separated by a comma. */
	keys: string;
	action: MessageId;
}

/**
 * The rows of the table: what each says, and the commands whose keys it shows. The keys come from the
 * registry (`keys`, or `shortcut` for the few a screen handles itself), so a key changed there
 * changes here, and a row naming a command that has no keys fails the dialog's test.
 */
export const SHORTCUT_SOURCES: readonly { commands: readonly string[]; action: MessageId }[] = [
	{ commands: TOOL_IDS.map(toolCommandId), action: 'shortcuts.tools' },
	{ commands: ['edit.undo', 'edit.redo'], action: 'shortcuts.undoRedo' },
	{ commands: ['file.save'], action: 'shortcuts.save' },
	{ commands: ['file.new'], action: 'shortcuts.newLevel' },
	{ commands: ['file.open'], action: 'shortcuts.openLevel' },
	{ commands: ['file.close'], action: 'shortcuts.closeLevel' },
	{ commands: ['file.preferences'], action: 'shortcuts.preferences' },
	{ commands: ['file.quit'], action: 'shortcuts.quit' },
	{ commands: ['view.commandPalette'], action: 'shortcuts.commandPalette' },
	{ commands: ['view.levelFirst'], action: 'shortcuts.levelFirst' },
	{ commands: ['view.maximise.script'], action: 'shortcuts.maximise' },
	{ commands: ['view.resetLayout'], action: 'shortcuts.resetLayout' },
	{ commands: ['view.zoomIn'], action: 'shortcuts.zoomIn' },
	{ commands: ['view.zoomOut'], action: 'shortcuts.zoomOut' },
	{ commands: ['view.zoomFit'], action: 'shortcuts.zoomFit' },
	{ commands: ['help.help'], action: 'shortcuts.help' },
	{ commands: ['help.shortcuts'], action: 'shortcuts.shortcuts' },
];

/** The table's rows, with their keys read from the registry. */
export function shortcutRows(): ShortcutRow[] {
	const defs = allCommands(NO_FACTS);
	return SHORTCUT_SOURCES.map(({ commands, action }) => ({
		action,
		keys: commands
			.map((id) => {
				const def = defs.find((command) => command.id === id);
				return def ? shortcutOf(def) : undefined;
			})
			.filter((keys): keys is string => keys !== undefined)
			.join(', '),
	}));
}

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
						{shortcutRows().map((row) => (
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
