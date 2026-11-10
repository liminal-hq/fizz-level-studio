// The right-click menu of a text field: Undo, Redo, Cut, Copy, Paste and Select all
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// These are the field's own actions, not registry commands (D74 records the exception to D70): they
// act on whichever box the menu was opened on, so they have no palette row and no place in the
// application menu. A release build blocks the webview's own text menu, so this is the only one
// there; every field in every window gets it. The rows carry ids of their own, which the host runs
// on the field (`app/textField.ts`).

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { t, type MessageId } from '../i18n/messages';
import type { IconId } from '../icons/AppIcons';
import { iconFor, menuSections } from './appMenuModel';
import type { TextFieldContextTarget } from './contextTargets';

export type TextFieldAction = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll';

/** The row id of an action, so the host can tell a text row from a command row. */
const ROW_PREFIX = 'text.';

/** The action a text-field row stands for, or null for an id that is not one. */
export function textFieldIdOf(rowId: string): TextFieldAction | null {
	const name = rowId.startsWith(ROW_PREFIX) ? rowId.slice(ROW_PREFIX.length) : '';
	return ROWS.some((row) => row.action === name) ? (name as TextFieldAction) : null;
}

interface RowSpec {
	action: TextFieldAction;
	label: MessageId;
	icon: IconId;
	/** Shown as the row's keys; the field's own keys, which run in the webview. */
	shortcut: string;
}

const ROWS: readonly RowSpec[] = [
	{ action: 'undo', label: 'context.text.undo', icon: 'undo', shortcut: 'Ctrl+Z' },
	{ action: 'redo', label: 'context.text.redo', icon: 'redo', shortcut: 'Ctrl+Shift+Z' },
	{ action: 'cut', label: 'context.text.cut', icon: 'cut', shortcut: 'Ctrl+X' },
	{ action: 'copy', label: 'context.text.copy', icon: 'copy', shortcut: 'Ctrl+C' },
	{ action: 'paste', label: 'context.text.paste', icon: 'paste', shortcut: 'Ctrl+V' },
	{ action: 'selectAll', label: 'context.text.selectAll', icon: 'selectAll', shortcut: 'Ctrl+A' },
];

/** Why a row is dimmed, or null while it is on offer. */
function whyNot(action: TextFieldAction, field: TextFieldContextTarget['field']): MessageId | null {
	switch (action) {
		case 'undo':
		case 'redo':
		case 'paste':
			return field.readOnly ? 'context.text.readOnly' : null;
		case 'cut':
			if (field.readOnly) return 'context.text.readOnly';
			return field.hasSelection ? null : 'context.text.noSelection';
		case 'copy':
			return field.hasSelection ? null : 'context.text.noSelection';
		case 'selectAll':
			return field.hasText ? null : 'context.text.empty';
	}
}

/** The rows of a text field's menu: Undo and Redo; Cut, Copy and Paste; Select all. */
export function textFieldMenuItems(target: TextFieldContextTarget): MenuItem[] {
	const row = (spec: RowSpec): MenuItem => {
		const reason = whyNot(spec.action, target.field);
		return {
			type: 'action',
			id: `${ROW_PREFIX}${spec.action}`,
			label: t(spec.label),
			icon: iconFor(spec.icon),
			shortcut: spec.shortcut,
			...(reason ? { disabled: true, title: t(reason) } : {}),
		};
	};
	const group = (...actions: TextFieldAction[]) =>
		actions.map((action) => row(ROWS.find((spec) => spec.action === action)!));
	return menuSections(group('undo', 'redo'), group('cut', 'copy', 'paste'), group('selectAll'));
}
