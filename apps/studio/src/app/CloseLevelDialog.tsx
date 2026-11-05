// The question asked when a level with unsaved changes is closed: Save, Discard or Cancel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Dialog } from '@liminal-hq/fizz-studio-chrome/Dialog/Dialog';
import { DialogActions, DialogButton } from '@liminal-hq/fizz-studio-chrome/Dialog/DialogActions';
import { t } from '../i18n/messages';

export interface CloseLevelDialogProps {
	open: boolean;
	/** The level's name, for the question. */
	name: string;
	onSave: () => void;
	onDiscard: () => void;
	/** Cancel, Esc and a backdrop click all land here. */
	onCancel: () => void;
}

/**
 * A confirm dialog with three answers. `ConfirmDialog` offers two, so this composes the same
 * `Dialog` and buttons; focus starts on Save, the safe answer, and never on Discard.
 */
export function CloseLevelDialog({
	open,
	name,
	onSave,
	onDiscard,
	onCancel,
}: CloseLevelDialogProps) {
	return (
		<Dialog
			open={open}
			title={t('main.closeConfirmTitle', { name })}
			description={t('main.closeConfirmMessage')}
			size="small"
			onClose={() => onCancel()}
			footer={
				<DialogActions>
					<DialogButton variant="secondary" onClick={onCancel}>
						{t('main.cancel')}
					</DialogButton>
					<DialogButton variant="danger" onClick={onDiscard}>
						{t('main.discard')}
					</DialogButton>
					<DialogButton variant="primary" onClick={onSave}>
						{t('main.save')}
					</DialogButton>
				</DialogActions>
			}
		/>
	);
}
