// The ribbon's layout: its tabs and groups, each a list of command ids and nothing else
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// An id that names no command now (Tear off while a panel is away) is
// skipped when the model is built, and a group or tab left with nothing is dropped, so the layout can
// name what is coming without drawing a dead button. What a command is, how it looks and when it can
// run come from the registry, as for every other surface.

import type { MessageId } from '../i18n/messages';
import { PANEL_SPECS } from '../panels/float/panelSpecs';
import { TOOL_IDS } from '../tools/tool';
import { panelCommandId, toolCommandId, WORKSPACE_COMMANDS } from './registry';

export interface RibbonLayoutGroup {
	id: string;
	label: MessageId;
	commands: readonly string[];
}

export interface RibbonLayoutTab {
	id: string;
	label: MessageId;
	/** Shown only while the app lists the tab as contextual (the Script tab, while the Script panel is active). */
	contextual?: boolean;
	groups: readonly RibbonLayoutGroup[];
}

/** The File button's menu: the file commands, then Preferences and Quit. */
export const RIBBON_FILE_COMMANDS: readonly string[] = [
	'file.new',
	'file.open',
	'file.save',
	'file.close',
	'file.preferences',
	'file.quit',
];

export const SCRIPT_TAB = 'script';

export const RIBBON_TABS: readonly RibbonLayoutTab[] = [
	{
		id: 'home',
		label: 'ribbon.tab.home',
		groups: [
			{
				id: 'file',
				label: 'ribbon.group.file',
				commands: ['file.new', 'file.open', 'file.save', 'file.close'],
			},
			{ id: 'history', label: 'ribbon.group.history', commands: ['edit.undo', 'edit.redo'] },
			{ id: 'tools', label: 'ribbon.group.tools', commands: TOOL_IDS.map(toolCommandId) },
			{ id: 'brush', label: 'ribbon.group.brush', commands: ['panel.palette.show'] },
		],
	},
	{
		id: 'level',
		label: 'ribbon.tab.level',
		groups: [
			{ id: 'layers', label: 'ribbon.group.layers', commands: ['view.panel.layers'] },
			{ id: 'checks', label: 'ribbon.group.checks', commands: ['panel.script.show'] },
		],
	},
	{
		id: 'view',
		label: 'ribbon.tab.view',
		groups: [
			{
				id: 'zoom',
				label: 'ribbon.group.zoom',
				commands: ['view.zoomOut', 'view.zoomIn', 'view.zoomFit'],
			},
			{
				id: 'panels',
				label: 'ribbon.group.panels',
				commands: PANEL_SPECS.map((spec) => panelCommandId(spec.id)),
			},
			{
				id: 'layout',
				label: 'ribbon.group.layout',
				commands: ['view.levelFirst', 'view.resetLayout'],
			},
			{
				id: 'chrome',
				label: 'ribbon.group.chrome',
				commands: ['view.menuBar', 'view.toolbar.classic', 'view.toolbar.ribbon'],
			},
			{
				id: 'workspaces',
				label: 'ribbon.group.workspaces',
				commands: WORKSPACE_COMMANDS.map((entry) => entry.id),
			},
		],
	},
	{
		id: SCRIPT_TAB,
		label: 'ribbon.tab.script',
		contextual: true,
		groups: [
			{ id: 'problems', label: 'ribbon.group.problems', commands: ['panel.script.show'] },
			{
				id: 'tabs',
				label: 'ribbon.group.tabs',
				commands: [
					'script.tab.level.close',
					'view.panel.script.tearOff',
					'view.panel.script.dockBack',
				],
			},
		],
	},
];
