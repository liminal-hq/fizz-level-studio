// The workspace switcher: Paint, Script and Review as a segmented group, and the command search button
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useMemo } from 'react';
import { useBridgeSnapshot } from '../commands/commandBridge';
import {
	COMMAND_PALETTE_SHORTCUT,
	WORKSPACE_COMMANDS,
	allCommands,
	commandLabel,
	runCommand,
	viewOf,
} from '../commands/registry';
import { t } from '../i18n/messages';
import { SearchIcon } from '../icons/AppIcons';
import styles from './WorkspaceSwitcher.module.css';

/**
 * Paint, Script and Review as a segmented group (`aria-pressed`, the active one lit). Each is the
 * `workspace.*` command, run through `runCommand`, so the menus, the palette and this group agree.
 * It draws nothing while no workspace command applies (no editor open).
 */
export function WorkspaceSwitcher() {
	const snapshot = useBridgeSnapshot();
	const choices = useMemo(() => {
		const defs = allCommands(snapshot.facts);
		return WORKSPACE_COMMANDS.flatMap((entry) => {
			const def = defs.find((command) => command.id === entry.id);
			if (!def) return [];
			const view = viewOf(def, snapshot);
			return view.visible
				? [{ id: entry.id, label: commandLabel(def), pressed: view.checked === true }]
				: [];
		});
	}, [snapshot]);
	if (choices.length === 0) return null;
	return (
		<div className={styles.group} role="group" aria-label={t('workspace.label')}>
			{choices.map((choice) => (
				<button
					key={choice.id}
					type="button"
					className={styles.option}
					aria-pressed={choice.pressed}
					onClick={() => void runCommand(choice.id, snapshot)}
				>
					{choice.label}
				</button>
			))}
		</div>
	);
}

/** "Search commands, Ctrl+Shift+P": opens the command palette, the same command as its menu row and its key. */
export function CommandSearchButton() {
	const snapshot = useBridgeSnapshot();
	return (
		<button
			type="button"
			className={styles.search}
			aria-keyshortcuts="Control+Shift+P"
			title={t('workspace.searchTip', { keys: COMMAND_PALETTE_SHORTCUT })}
			onClick={() => void runCommand('view.commandPalette', snapshot)}
		>
			<SearchIcon size={14} />
			<span className={styles.searchLabel}>{t('workspace.search')}</span>
			<kbd className={styles.keys}>{COMMAND_PALETTE_SHORTCUT}</kbd>
		</button>
	);
}
