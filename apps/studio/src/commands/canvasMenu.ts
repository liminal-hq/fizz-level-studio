// The right-click menus of the level: a cell on the canvas, a row of Objects, a row of Layers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Every row is a registry command, so labels, keys, availability and the reasons a row is dimmed
// (a locked layer, a Fizz 2 level, the start) come from the same place as the menus and the palette.
// The surface has already applied the selection rule, so the selection commands act on the thing the
// menu names.

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { t } from '../i18n/messages';
import type { Thing } from '../tools/tool';
import { commandRow, menuSections } from './appMenuModel';
import {
	CANVAS_ERASE_HERE,
	CANVAS_PAINT_HERE,
	CANVAS_PICK_HERE,
	INSPECTOR_SHOW,
	SELECTION_REVEAL,
} from './canvasCommands';
import type { BridgeSnapshot } from './commandBridge';
import { capitalised } from './contextMenuModel';
import type {
	CanvasContextTarget,
	LayerRowContextTarget,
	ObjectRowContextTarget,
} from './contextTargets';
import { LAYERS_SHOW_ALL, LAYERS_UNLOCK_ALL, layerCommandId } from './layerCommands';
import { allCommands, toolCommandId, viewOf } from './registry';
import { SELECTION_DELETE, SELECTION_FLIP, SELECTION_SHOW_IN_SCRIPT } from './selectionCommands';

export type LevelContextTarget =
	| CanvasContextTarget
	| ObjectRowContextTarget
	| LayerRowContextTarget;

/** The rows of the commands `ids`, short labels where a command has one, and none for a command that does not apply here. */
function rows(snapshot: BridgeSnapshot, ids: readonly string[]): MenuItem[] {
	const defs = allCommands(snapshot.facts);
	return ids.flatMap((id) => {
		const def = defs.find((command) => command.id === id);
		return def ? commandRow(viewOf(def, snapshot), { short: true }) : [];
	});
}

/** The header row: the thing's (or tile's) name, where it is, and the script line it is written on, when that is known. */
export function headerRow(thing: Thing, line: number | null): MenuItem {
	const values = { name: capitalised(thing.name), x: thing.x, y: thing.y };
	const known = thing.kind === 'cell' ? line : thing.line;
	return {
		type: 'section',
		id: 'context-header',
		label:
			known === null
				? t('context.headerNoLine', values)
				: t('context.header', { ...values, line: known }),
	};
}

/** Marks the Delete row as destructive. */
const dangerous = (item: MenuItem): MenuItem =>
	item.id === SELECTION_DELETE && item.type === 'action' ? { ...item, danger: true } : item;

/**
 * The menu on a placed thing (an item, an enemy or the start): Inspect and Show in script, Flip, and
 * Delete. `onList` adds Show on the canvas, which the Objects list needs and the canvas does not.
 */
function thingRows(snapshot: BridgeSnapshot, onList: boolean): MenuItem[] {
	return menuSections(
		rows(snapshot, [
			INSPECTOR_SHOW,
			SELECTION_SHOW_IN_SCRIPT,
			...(onList ? [SELECTION_REVEAL] : []),
		]),
		rows(snapshot, [SELECTION_FLIP]),
		rows(snapshot, [SELECTION_DELETE]).map(dangerous),
	);
}

/** The menu on a tile or an empty cell (an exit or a door is a tile too): the tile commands at the cursor, Inspect and Show in script, and Zoom to fit. */
function cellRows(snapshot: BridgeSnapshot, inRect: boolean): MenuItem[] {
	return menuSections(
		// Select's rectangle is kept, so Stamp (which copies the outline) leads the menu.
		inRect ? rows(snapshot, [toolCommandId('stamp')]) : [],
		rows(snapshot, [CANVAS_PICK_HERE, CANVAS_PAINT_HERE, CANVAS_ERASE_HERE]),
		// With the rectangle kept the selection is not the cell, so these would name another thing.
		inRect ? [] : rows(snapshot, [INSPECTOR_SHOW, SELECTION_SHOW_IN_SCRIPT]),
		rows(snapshot, ['view.zoomFit']),
	);
}

/** The menu on a row of the Layers panel: Hide, Show only, Lock, its first line, and the two "all" commands. */
function layerRows(target: LayerRowContextTarget, snapshot: BridgeSnapshot): MenuItem[] {
	// A level with no layers (Fizz 2) has no rows to act on, so no menu.
	if (!snapshot.facts.layers.some((layer) => layer.id === target.layer)) return [];
	return menuSections(
		rows(snapshot, [layerCommandId('hide', target.layer), layerCommandId('only', target.layer)]),
		rows(snapshot, [layerCommandId('lock', target.layer)]),
		rows(snapshot, [layerCommandId('reveal', target.layer)]),
		rows(snapshot, [LAYERS_SHOW_ALL, LAYERS_UNLOCK_ALL]),
	);
}

/** The rows of the menu for a thing or cell on the canvas, a row of Objects, or a row of Layers; none for a level that has no such menu. */
export function canvasMenuItems(target: LevelContextTarget, snapshot: BridgeSnapshot): MenuItem[] {
	// A window with no editor (a panel torn off, which has no selection to act on yet) has no menu here.
	if (!snapshot.facts.editorOpen) return [];
	switch (target.kind) {
		case 'canvas':
			return [
				headerRow(target.thing, target.line),
				...(target.thing.kind === 'cell'
					? cellRows(snapshot, target.inRect)
					: thingRows(snapshot, false)),
			];
		case 'objectRow':
			return [headerRow(target.thing, null), ...thingRows(snapshot, true)];
		case 'layerRow':
			return layerRows(target, snapshot);
	}
}
