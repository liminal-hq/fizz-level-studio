// The right-click menu of the script editor: Copy, Select all, Find, Fold all and Unfold all
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The rows are the `script.*` commands in `scriptCommands.ts`, which the Script panel publishes
// handlers for. The line numbers and the fold gutter get the same menu as the text; a hover
// tooltip, which has no caret to act on, gets Copy only. Copy is dimmed, with the reason, until
// some text is selected.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { t } from '../i18n/messages';
import { commandRow, menuSections } from './appMenuModel';
import type { BridgeSnapshot } from './commandBridge';
import type { ScriptEditorContextTarget } from './contextTargets';
import { allCommands, viewOf } from './registry';
import {
	SCRIPT_COPY,
	SCRIPT_FIND,
	SCRIPT_FOLD_ALL,
	SCRIPT_SELECT_ALL,
	SCRIPT_UNFOLD_ALL,
} from './scriptCommands';

/** The rows of the menu for the script editor, its gutter or a hover tooltip over it. */
export function scriptMenuItems(
	target: ScriptEditorContextTarget,
	snapshot: BridgeSnapshot,
): MenuItem[] {
	const defs = allCommands(snapshot.facts);
	const rows = (...ids: string[]): MenuItem[] =>
		ids.flatMap((id) => {
			const def = defs.find((command) => command.id === id);
			if (!def) return [];
			const row = commandRow(viewOf(def, snapshot));
			// Copy needs something selected, which only the editor knows: the target says.
			return id === SCRIPT_COPY && !target.hasSelection
				? row.map((item) =>
						item.type === 'action'
							? { ...item, disabled: true, title: t('script.copyNeedsSelection') }
							: item,
					)
				: row;
		});
	if (target.region === 'hover') return menuSections(rows(SCRIPT_COPY));
	return menuSections(
		rows(SCRIPT_COPY, SCRIPT_SELECT_ALL),
		rows(SCRIPT_FIND),
		rows(SCRIPT_FOLD_ALL, SCRIPT_UNFOLD_ALL),
	);
}
