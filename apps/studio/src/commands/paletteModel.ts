// What the command palette lists: the registry's commands as entries with their label, group, keys and reason
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { t } from '../i18n/messages';
import type { BridgeSnapshot } from './commandBridge';
import type { Rankable } from './paletteMatch';
import {
	PALETTE_GROUPS,
	allCommands,
	commandLabel,
	paletteGroupOf,
	viewOf,
	type CommandDef,
	type PaletteGroup,
} from './registry';

/** The palette does not list the command that opens it. */
const OPENER = 'view.commandPalette';

export interface PaletteEntry extends Rankable {
	def: CommandDef;
	group: PaletteGroup;
	shortcut: string | undefined;
	enabled: boolean;
	/** Why a dimmed entry cannot run. */
	reason: string | undefined;
}

/** The label the palette shows: a panel's row says whether choosing it shows or hides the panel. */
function labelOf(def: CommandDef, checked: boolean | undefined): string {
	const name = commandLabel(def);
	if (checked === undefined) return name;
	return t(checked ? 'cmdPalette.hidePanel' : 'cmdPalette.showPanel', { panel: name });
}

/** Every command now, grouped in the palette's order and otherwise in registry order. */
export function paletteEntries(snapshot: BridgeSnapshot): PaletteEntry[] {
	const entries = allCommands(snapshot.facts)
		.filter((def) => def.id !== OPENER && !def.hidden?.(snapshot.facts))
		.map((def, order) => {
			const view = viewOf(def, snapshot);
			const group = paletteGroupOf(def);
			let reason: string | undefined;
			if (!view.enabled) {
				const { hasLevel, editorOpen } = snapshot.facts;
				reason = def.unavailable
					? t(def.unavailable)
					: t(!hasLevel && !editorOpen ? 'cmdPalette.needsLevel' : 'cmdPalette.unavailableNow');
			}
			return {
				order,
				entry: {
					id: def.id,
					label: labelOf(def, view.checked),
					def,
					group,
					shortcut: def.shortcut,
					enabled: view.enabled,
					reason,
				} satisfies PaletteEntry,
			};
		});
	entries.sort(
		(a, b) =>
			PALETTE_GROUPS.indexOf(a.entry.group) - PALETTE_GROUPS.indexOf(b.entry.group) ||
			a.order - b.order,
	);
	return entries.map(({ entry }) => entry);
}
