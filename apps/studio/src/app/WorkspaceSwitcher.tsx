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
	shortcutOf,
	viewOf,
} from '../commands/registry';
import { t } from '../i18n/messages';
import { useSurfaceMenu } from './useSurfaceMenu';
import { SearchIcon } from '../icons/AppIcons';
import { Tooltip } from '../ui/Tooltip';
import styles from './WorkspaceSwitcher.module.css';

/**
 * Paint, Script and Review as a segmented group (`aria-pressed`, the active one lit). Each is the
 * `workspace.*` command, run through `runCommand`, so the menus, the palette and this group agree.
 * It draws nothing while no workspace command applies (no editor open).
 */
export function WorkspaceSwitcher() {
	const snapshot = useBridgeSnapshot();
	const switcherMenu = useSurfaceMenu<HTMLDivElement>(() => ({ kind: 'workspace' }));
	const choices = useMemo(() => {
		const defs = allCommands(snapshot.facts);
		return WORKSPACE_COMMANDS.flatMap((entry) => {
			const def = defs.find((command) => command.id === entry.id);
			if (!def) return [];
			const view = viewOf(def, snapshot);
			return view.visible
				? [
						{
							id: entry.id,
							label: commandLabel(def),
							keys: shortcutOf(def),
							pressed: view.checked === true,
						},
					]
				: [];
		});
	}, [snapshot]);
	if (choices.length === 0) return null;
	return (
		<div className={styles.group} role="group" aria-label={t('workspace.label')} {...switcherMenu}>
			{choices.map((choice) => (
				<Tooltip key={choice.id} label={choice.label} keys={choice.keys}>
					<button
						type="button"
						className={styles.option}
						data-keycap-exempt=""
						aria-pressed={choice.pressed}
						onClick={() => void runCommand(choice.id, snapshot)}
					>
						{choice.label}
					</button>
				</Tooltip>
			))}
		</div>
	);
}

/** "Search commands, Ctrl+Shift+P": opens the command palette, the same command as its menu row and its key. */
export function CommandSearchButton() {
	const snapshot = useBridgeSnapshot();
	return (
		<Tooltip label={t('workspace.search')} keys={COMMAND_PALETTE_SHORTCUT}>
			<button
				type="button"
				className={styles.search}
				data-keycap-exempt=""
				aria-keyshortcuts="Control+Shift+P"
				onClick={() => void runCommand('view.commandPalette', snapshot)}
			>
				<SearchIcon size={14} />
				<span className={styles.searchLabel}>{t('workspace.search')}</span>
				<kbd className={styles.keys}>{COMMAND_PALETTE_SHORTCUT}</kbd>
			</button>
		</Tooltip>
	);
}
