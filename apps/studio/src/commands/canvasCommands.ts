// The canvas commands: Pick this tile, Paint here, Erase here, Show on the canvas and Show the Inspector
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Pick, Paint and Erase act on the keyboard cursor (a right-click moves it first), so they work from
// the keyboard and the palette too, and they take no keys of their own: Space and Enter already
// apply the current tool at the cursor. The editor publishes the handlers and the `cursor`, `brush`
// and `locks` facts that say when each can run. A lock only dims the row with its reason; Rust is
// still the one that refuses a change to a locked layer.

import { formatLocale } from '../i18n/active';
import type { CommandFacts } from './commandBridge';
import type { CommandDef, CommandReason } from './registry';

export const CANVAS_PICK_HERE = 'canvas.pickHere';
export const CANVAS_PAINT_HERE = 'canvas.paintHere';
export const CANVAS_ERASE_HERE = 'canvas.eraseHere';
export const SELECTION_REVEAL = 'selection.reveal';
export const INSPECTOR_SHOW = 'panel.inspector.show';

/** The layer a studio paint or erase is written to: the end of the script. */
const EDITS_LAYER = 'edits';

/** The layer a placed item or enemy is written to. */
const THING_LAYERS = { item: 'treats', enemy: 'enemies' } as const;

/** The reason a change is refused while `layers` are locked: their names, from the `layers` fact. */
export function lockedReason(layers: readonly string[], facts: CommandFacts): CommandReason {
	const names = layers.map((id) => facts.layers.find((layer) => layer.id === id)?.name ?? id);
	const list = new Intl.ListFormat(formatLocale(), { style: 'long', type: 'conjunction' }).format(
		names,
	);
	return layers.length > 1
		? { id: 'level.lockedMany', values: { layers: list } }
		: { id: 'level.locked', values: { layers: list } };
}

/** The locked layers a paint of the current brush at the cursor would change. */
export function paintBlockedBy(facts: CommandFacts): string[] {
	const brush = facts.brush;
	if (!brush) return [];
	const layers =
		brush.group === 'tile'
			? [facts.cursor.layer, EDITS_LAYER]
			: [THING_LAYERS[brush.group === 'item' ? 'item' : 'enemy']];
	return unique(layers).filter((id) => facts.locks.includes(id));
}

/** The locked layers an erase at the cursor would change: the layer that wrote the cell, and the edits an erase adds. */
export function eraseBlockedBy(facts: CommandFacts): string[] {
	return unique([facts.cursor.layer, EDITS_LAYER]).filter((id) => facts.locks.includes(id));
}

function unique(ids: readonly (string | null)[]): string[] {
	return [...new Set(ids.filter((id): id is string => id !== null))];
}

/** The canvas commands. */
export function canvasCommands(facts?: CommandFacts): CommandDef[] {
	const here = (now: CommandFacts) => now.editorOpen && now.cursor.inside;
	const outside = (): CommandReason => 'canvas.cursorOutside';
	return [
		{
			id: CANVAS_PICK_HERE,
			group: 'tools',
			icon: 'tool.pick',
			label: 'canvas.pickHere',
			visible: (now) => now.editorOpen,
			enabled: here,
			reason: outside,
		},
		{
			id: CANVAS_PAINT_HERE,
			group: 'tools',
			icon: 'tool.paint',
			label: 'canvas.paintHere',
			labelValues: { brush: facts?.brush?.kind ?? '' },
			visible: (now) => now.editorOpen && now.brush !== null,
			enabled: (now) => here(now) && paintBlockedBy(now).length === 0,
			reason: (now) => {
				const blocked = paintBlockedBy(now);
				return blocked.length > 0 ? lockedReason(blocked, now) : outside();
			},
		},
		{
			id: CANVAS_ERASE_HERE,
			group: 'tools',
			icon: 'tool.erase',
			label: 'canvas.eraseHere',
			visible: (now) => now.editorOpen,
			enabled: (now) => here(now) && eraseBlockedBy(now).length === 0,
			reason: (now) => {
				const blocked = eraseBlockedBy(now);
				return blocked.length > 0 ? lockedReason(blocked, now) : outside();
			},
		},
		{
			id: SELECTION_REVEAL,
			group: 'edit',
			icon: 'selection.reveal',
			label: 'selection.reveal',
			visible: (now) => now.editorOpen,
			enabled: (now) => now.editorOpen && now.selection.kind !== null,
			reason: () => 'selection.needsThing',
		},
		{
			id: INSPECTOR_SHOW,
			group: 'panels',
			icon: 'panel.inspector',
			label: 'toolbar.showInspector',
			enabled: (now) => now.editorOpen,
		},
	];
}
