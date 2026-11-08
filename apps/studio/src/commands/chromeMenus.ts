// The right-click menus of the chrome: panel headers, rails and tabs, the script tab, the commands row, the workspace switcher, the zoom pill and History
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Every row is a registry command, so labels, keys, ticks and disabled reasons agree with the
// application menu and the palette. The tool picker and the Palette have no menu yet (the owner
// deferred them): their targets give no rows, so the host opens nothing there.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { t } from '../i18n/messages';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import { commandRow, historyItems, iconFor, menuSections } from './appMenuModel';
import type { BridgeSnapshot } from './commandBridge';
import type {
	BrushContextTarget,
	CommandsRowContextTarget,
	HistoryContextTarget,
	PanelContextTarget,
	ScriptTabContextTarget,
	ToolsContextTarget,
	WorkspaceContextTarget,
	ZoomContextTarget,
} from './contextTargets';
import { panelMenuItems } from './panelMenuModel';
import {
	allCommands,
	dockBackCommandId,
	maximiseCommandId,
	panelCommandId,
	panelDockCommandId,
	tearOffCommandId,
	viewOf,
	WORKSPACE_COMMANDS,
} from './registry';

export type ChromeContextTarget =
	| PanelContextTarget
	| ScriptTabContextTarget
	| CommandsRowContextTarget
	| WorkspaceContextTarget
	| ZoomContextTarget
	| ToolsContextTarget
	| HistoryContextTarget
	| BrushContextTarget;

/**
 * The rows of the commands with these ids, in this order. A command that is not visible has no
 * row. With `onlyDoable`, one that nothing in this window can run has none either (a panel's own
 * window cannot dock it left): there the menu offers only what the window can do.
 */
function rowsFor(snapshot: BridgeSnapshot, onlyDoable = false) {
	const defs = allCommands(snapshot.facts);
	return (...ids: string[]): MenuItem[] =>
		ids.flatMap((id) => {
			const def = defs.find((command) => command.id === id);
			if (!def) return [];
			if (onlyDoable && def.run === undefined && !(id in snapshot.handlers)) return [];
			return commandRow(viewOf(def, snapshot), { short: true });
		});
}

const spec = (panel: PanelId) => PANEL_SPECS.find((candidate) => candidate.id === panel);

/**
 * A panel's header, rail button or tab: exactly the panel's own menu (Dock left, right and bottom,
 * Float; Tear off or Dock back; Reset layout), then Maximise or Restore for a panel that fills the
 * workspace, and Hide. In a panel's own window, which cannot place or hide the panel, the menu is
 * just Dock back.
 */
function panelMenu(target: PanelContextTarget, snapshot: BridgeSnapshot): MenuItem[] {
	const { panel } = target;
	const rows = rowsFor(snapshot, true);
	const inOwnWindow = !(panelDockCommandId(panel, 'left') in snapshot.handlers);
	if (inOwnWindow) return rows(dockBackCommandId(panel));
	const title = t(spec(panel)?.title ?? 'panels.menu');
	const defs = allCommands(snapshot.facts);
	const hideDef = defs.find((command) => command.id === panelCommandId(panel));
	const hide: MenuItem[] = hideDef
		? [
				{
					type: 'action',
					id: hideDef.id,
					label: t('cmdPalette.hidePanel', { panel: title }),
					icon: iconFor(`panel.${panel}`),
					...(viewOf(hideDef, snapshot).enabled ? {} : { disabled: true }),
				},
			]
		: [];
	return menuSections(panelMenuItems(panel, snapshot), [
		...rows(maximiseCommandId(panel, false), maximiseCommandId(panel, true)),
		...hide,
	]);
}

/** The level script's tab: show or close the tab, and the Script panel's tear-off or dock-back. */
function scriptTabMenu(snapshot: BridgeSnapshot): MenuItem[] {
	const rows = rowsFor(snapshot, true);
	const away = snapshot.facts.away.script;
	return menuSections(
		rows('script.tab.level.activate', 'script.tab.level.close'),
		rows(away ? dockBackCommandId('script') : tearOffCommandId('script')),
	);
}

/** The rows of the menu for a piece of the chrome; none where it has no menu. */
export function chromeMenuItems(target: ChromeContextTarget, snapshot: BridgeSnapshot): MenuItem[] {
	const rows = rowsFor(snapshot);
	switch (target.kind) {
		case 'panel':
			return panelMenu(target, snapshot);
		case 'scriptTab':
			return scriptTabMenu(snapshot);
		case 'commandsRow':
			return menuSections(
				rows('view.toolbar.classic', 'view.toolbar.ribbon', 'view.toolbar.hidden'),
				rows('view.menuBar', 'view.ribbon.fold'),
			);
		case 'workspace':
			return menuSections(
				rows(...WORKSPACE_COMMANDS.map((entry) => entry.id)),
				rows('view.resetLayout'),
			);
		case 'zoom':
			return menuSections(rows('view.zoomIn', 'view.zoomOut', 'view.zoomFit'));
		case 'history':
			return historyItems(snapshot);
		// The tool picker and the Palette wait for a later change.
		case 'tools':
		case 'brush':
			return [];
	}
}
