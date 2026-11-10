// The ribbon's model: the layout's tabs and groups filled in from the registry's commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A pure builder over the bridge's snapshot. Choosing an item runs its command through `runCommand`,
// like every other surface.

import type { RibbonGroup, RibbonModel } from '@liminal-hq/fizz-studio-ribbon/types';
import { createElement } from 'react';
import { t } from '../i18n/messages';
import { brushSwatch } from '../tools/swatch';
import { TOOL_IDS } from '../tools/tool';
import type { BridgeSnapshot } from './commandBridge';
import { RIBBON_FILE_COMMANDS, RIBBON_TABS, SCRIPT_TAB } from './ribbonLayout';
import { allCommands, commandLabel, toolCommandId } from './registry';
import { commandItems } from './toolbarModel';

/** The ids of the contextual tabs to show now: the Script's, while the Script panel is the one in use. */
export function contextualTabs(snapshot: BridgeSnapshot): string[] {
	return snapshot.facts.focusedPanel === 'script' && snapshot.facts.panels.script
		? [SCRIPT_TAB]
		: [];
}

/** The ribbon for the commands now: tabs of groups of large buttons, and the File button's menu. */
export function buildRibbon(snapshot: BridgeSnapshot): RibbonModel {
	const { facts } = snapshot;
	const tools = new Set(TOOL_IDS.map(toolCommandId));
	const defs = allCommands(facts);
	return {
		file: {
			label: t('ribbon.file'),
			items: RIBBON_FILE_COMMANDS.flatMap((id) => {
				const def = defs.find((command) => command.id === id);
				return def ? [[id, commandLabel(def)] as [string, string]] : [];
			}),
		},
		tabs: RIBBON_TABS.map((tab) => ({
			id: tab.id,
			label: t(tab.label),
			...(tab.contextual ? { contextual: true } : {}),
			groups: tab.groups.map((group): RibbonGroup => {
				const items = commandItems(snapshot, group.commands, {
					large: true,
					// The tool in use is lit, though the tool commands are not checked rows in a menu.
					active: (id) =>
						tools.has(id) ? id === (facts.tool ? toolCommandId(facts.tool) : '') : undefined,
				}).map((item) =>
					// The brush button names the brush now and wears its colour.
					item.id === 'panel.palette.show' && facts.brush
						? {
								...item,
								label: t('brush.chip', { kind: facts.brush.kind }),
								icon: () =>
									createElement('span', {
										'aria-hidden': 'true',
										style: {
											...brushSwatch(facts.brush!),
											display: 'inline-block',
											width: 18,
											height: 18,
											borderRadius: facts.brush!.group === 'item' ? '50%' : 4,
											border: '1px solid var(--fls-border-subtle)',
										},
									}),
							}
						: item,
				);
				return { id: group.id, label: t(group.label), items };
			}),
		})),
	};
}
