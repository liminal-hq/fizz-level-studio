// The right-click menu of a text field: Undo, Redo, Cut, Copy, Paste and Select all
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Owned by the chrome package. These are the field's own actions, not registry commands (D74 records
// the exception to D70), so the rows carry ids of their own that the host runs on the focused field.
// The contract commit holds only the signature.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import type { TextFieldContextTarget } from './contextTargets';

/** The rows of a text field's menu. */
export function textFieldMenuItems(_target: TextFieldContextTarget): MenuItem[] {
	return [];
}
