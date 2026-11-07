// The classic toolbar's buttons: command ids arranged in groups, each drawn from the registry's command
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The model is a pure builder over the bridge's snapshot: it holds no behaviour, so choosing a button
// runs its command through `runCommand` like every other surface.

import type { RibbonItem, ToolbarModel } from '@liminal-hq/fizz-studio-ribbon/types';
import { createElement } from 'react';
import { APP_ICONS } from '../icons/AppIcons';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import type { BridgeSnapshot } from './commandBridge';
import {
	allCommands,
	commandLabel,
	panelCommandId,
	shortcutOf,
	viewOf,
	type CommandView,
} from './registry';

/** The toolbar's groups, left to right, by command id: the level's files, then the history. */
export const TOOLBAR_GROUPS: readonly (readonly string[])[] = [
	['file.new', 'file.open', 'file.save', 'file.close'],
	['edit.undo', 'edit.redo'],
];

/**
 * A command as a ribbon item: its label, its icon from the one icon set, its keys and, when it
 * cannot run, why (the tooltip). A command with a checked state is a toggle. Null while the command
 * is not visible or has no icon (the toolbar's own, else its menu row's).
 */
export function commandItem(
	view: CommandView,
	options: { large?: boolean; active?: boolean } = {},
): RibbonItem | null {
	const { def } = view;
	const iconId = def.toolbar?.icon ?? def.icon;
	if (!view.visible || !iconId) return null;
	const Icon = APP_ICONS[iconId];
	const active = options.active ?? view.checked;
	const keys = shortcutOf(def);
	return {
		id: def.id,
		label: commandLabel(def),
		icon: (px) => createElement(Icon, { size: px }),
		...(options.large ? { size: 'large' as const } : {}),
		...(active !== undefined ? { kind: 'toggle' as const, active } : {}),
		...(view.enabled ? {} : { disabled: true }),
		...(keys ? { key: keys } : {}),
		...(!view.enabled && view.reason ? { desc: view.reason } : {}),
	};
}

/** The items of these command ids, in order, leaving out any that are not visible. */
export function commandItems(
	snapshot: BridgeSnapshot,
	ids: readonly string[],
	options: { large?: boolean; active?: (id: string) => boolean | undefined } = {},
): RibbonItem[] {
	const defs = allCommands(snapshot.facts);
	return ids.flatMap((id) => {
		const def = defs.find((command) => command.id === id);
		const active = options.active?.(id);
		const item = def
			? commandItem(viewOf(def, snapshot), {
					...(options.large ? { large: true } : {}),
					...(active !== undefined ? { active } : {}),
				})
			: null;
		return item ? [item] : [];
	});
}

/** The toolbar's groups of buttons; a group with none visible is left out. */
export function buildToolbar(snapshot: BridgeSnapshot): ToolbarModel {
	return {
		groups: TOOLBAR_GROUPS.map((ids) => commandItems(snapshot, ids)).filter(
			(group) => group.length > 0,
		),
	};
}

/** One of the panel buttons at the right of the toolbar: a toggle for a panel. */
export interface PanelToggle {
	/** The command it runs. */
	command: string;
	panel: PanelId;
	label: string;
	pressed: boolean;
	enabled: boolean;
	reason: string | undefined;
}

/** The panel toggles, one for each panel the editor can show, from the `view.panel.*` commands. */
export function panelToggles(snapshot: BridgeSnapshot): PanelToggle[] {
	const defs = allCommands(snapshot.facts);
	return PANEL_SPECS.flatMap((spec) => {
		const def = defs.find((command) => command.id === panelCommandId(spec.id));
		if (!def) return [];
		const view = viewOf(def, snapshot);
		if (!view.visible) return [];
		return [
			{
				command: def.id,
				panel: spec.id,
				label: commandLabel(def),
				pressed: view.checked === true,
				enabled: view.enabled,
				reason: view.reason,
			},
		];
	});
}
