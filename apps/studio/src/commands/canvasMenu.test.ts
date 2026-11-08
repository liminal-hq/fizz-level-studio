// Tests for the level's context menus: the rows and their order for a cell, a thing, an Objects row and a Layers row
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { levelSections } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { buildContextMenu } from './contextMenuModel';
import { canvasMenuItems, headerRow } from './canvasMenu';
import { NO_FACTS, NO_SELECTION, type BridgeSnapshot, type CommandFacts } from './commandBridge';
import type { CanvasContextTarget, ContextTarget } from './contextTargets';
import { layerFacts } from './levelFacts';
import { allCommands } from './registry';
import { levelView } from '../test/levelFixtures';

const layers = layerFacts(levelView(12, 8, { sections: levelSections() }));

/** A handler for every command, so only each command's own facts decide whether a row is enabled. */
function handlersFor(facts: CommandFacts) {
	return Object.fromEntries(allCommands(facts).map((def) => [def.id, () => {}]));
}

function snapshot(facts: Partial<CommandFacts> = {}): BridgeSnapshot {
	const merged: CommandFacts = {
		...NO_FACTS,
		editorOpen: true,
		hasLevel: true,
		layers,
		brush: { group: 'tile', kind: 'grass' },
		cursor: { inside: true, tile: 'grass', layer: 'terrain' },
		zoom: { level: 4, canIn: true, canOut: true },
		...facts,
	};
	return { facts: merged, handlers: handlersFor(merged) };
}

const thing = (over: Partial<Thing>): Thing => ({
	kind: 'item',
	name: 'cookie',
	x: 9,
	y: 11,
	layer: 'objects',
	index: 0,
	line: 15,
	...over,
});
const cellThing = thing({ kind: 'cell', name: 'grass', layer: 'tiles', line: null });
const canvas = (over: Partial<CanvasContextTarget> = {}): CanvasContextTarget => ({
	kind: 'canvas',
	cell: { x: 9, y: 11 },
	thing: cellThing,
	inRect: false,
	line: null,
	...over,
});
const selected = (over: Partial<CommandFacts['selection']>): CommandFacts['selection'] => ({
	...NO_SELECTION,
	kind: 'enemy',
	editable: true,
	canFlip: true,
	canDelete: true,
	hasLine: true,
	...over,
});

const label = (item: MenuItem) => ('label' in item ? item.label : '-');
const labels = (items: MenuItem[]) =>
	items.map((item) => (item.type === 'separator' ? '-' : label(item)));
const rowOf = (items: MenuItem[], id: string) => items.find((item) => item.id === id);

/** A separator never sits at either end or beside another. */
function expectCleanRules(items: MenuItem[]) {
	expect(items[0]?.type).not.toBe('separator');
	expect(items.at(-1)?.type).not.toBe('separator');
	items.forEach((item, i) => {
		if (item.type === 'separator') expect(items[i + 1]?.type).not.toBe('separator');
	});
}

describe('the header row', () => {
	it('names the thing, its place and its line', () => {
		expect(headerRow(thing({ name: 'gloop', kind: 'enemy', x: 9, y: 11, line: 15 }), null)).toEqual(
			{
				type: 'section',
				id: 'context-header',
				label: 'Gloop · x 9, y 11 · line 15',
			},
		);
	});

	it('names a tile with its line once the line is known, and without it before', () => {
		expect(label(headerRow(cellThing, null))).toBe('Grass · x 9, y 11');
		expect(label(headerRow(cellThing, 7))).toBe('Grass · x 9, y 11 · line 7');
	});
});

describe('the menu on a tile or an empty cell', () => {
	it('has the header, the tile commands, Inspect and Show in script, and Zoom to fit', () => {
		const items = buildContextMenu(
			canvas(),
			snapshot({ selection: { ...NO_SELECTION, kind: 'cell' } }),
		);
		expect(labels(items)).toEqual([
			'Grass · x 9, y 11',
			'Pick this tile',
			'Paint grass here',
			'Erase here',
			'-',
			'Show the Inspector',
			'Show in script',
			'-',
			'Fit level',
		]);
		expectCleanRules(items);
	});

	it('has no rule straight after the header, and every row has an icon', () => {
		const items = buildContextMenu(canvas(), snapshot());
		expect(items[1]?.type).not.toBe('separator');
		for (const item of items) {
			if (item.type !== 'separator' && item.type !== 'section')
				expect(item.icon, item.id).toBeTruthy();
		}
	});

	it('dims Show in script until the line is known, with its reason', () => {
		const items = buildContextMenu(
			canvas(),
			snapshot({ selection: { ...NO_SELECTION, kind: 'cell' } }),
		);
		expect(rowOf(items, 'selection.showInScript')).toMatchObject({
			disabled: true,
			title: 'Select a thing that sits on a script line first.',
		});
		const known = buildContextMenu(
			canvas({ line: 7 }),
			snapshot({ selection: { ...NO_SELECTION, kind: 'cell', hasLine: true } }),
		);
		expect(rowOf(known, 'selection.showInScript')).not.toHaveProperty('disabled');
	});

	it('keeps Select’s rectangle: Stamp leads, and the rows that name the selection are left out', () => {
		const items = buildContextMenu(canvas({ inRect: true }), snapshot());
		expect(labels(items)).toEqual([
			'Grass · x 9, y 11',
			'Stamp',
			'-',
			'Pick this tile',
			'Paint grass here',
			'Erase here',
			'-',
			'Fit level',
		]);
		expectCleanRules(items);
	});

	it('dims Paint and Erase with the lock reason when the cell’s layer is locked', () => {
		const items = buildContextMenu(canvas(), snapshot({ locks: ['terrain'] }));
		const reason = 'Terrain is locked. Unlock it in Layers to change it.';
		expect(rowOf(items, 'canvas.paintHere')).toMatchObject({ disabled: true, title: reason });
		expect(rowOf(items, 'canvas.eraseHere')).toMatchObject({ disabled: true, title: reason });
		expect(rowOf(items, 'canvas.pickHere')).not.toHaveProperty('disabled');
	});

	it('leaves the zoom row out until the canvas has published its zoom', () => {
		const items = buildContextMenu(canvas(), snapshot({ zoom: null }));
		expect(rowOf(items, 'view.zoomFit')).toBeUndefined();
		expectCleanRules(items);
	});
});

describe('the menu on an item, an enemy or the start', () => {
	const enemy = thing({ kind: 'enemy', name: 'gloop', line: 15 });
	const target = canvas({ thing: enemy });

	it('has Inspect and Show in script, Flip, and Delete as a danger row', () => {
		const items = buildContextMenu(target, snapshot({ selection: selected({}) }));
		expect(labels(items)).toEqual([
			'Gloop · x 9, y 11 · line 15',
			'Show the Inspector',
			'Show in script',
			'-',
			'Flip',
			'-',
			'Delete',
		]);
		expect(rowOf(items, 'edit.delete')).toMatchObject({ type: 'action', danger: true });
		expect(rowOf(items, 'selection.flip')).not.toHaveProperty('disabled');
		expectCleanRules(items);
	});

	it('says an item has no facing to flip', () => {
		const item = canvas({ thing: thing({}) });
		const items = buildContextMenu(
			item,
			snapshot({ selection: selected({ kind: 'item', canFlip: false }) }),
		);
		expect(rowOf(items, 'selection.flip')).toMatchObject({
			disabled: true,
			title: 'Only an enemy has a facing to turn.',
		});
	});

	it('dims Delete on the start with its own reason', () => {
		const start = canvas({ thing: thing({ kind: 'start', name: 'start', line: 3 }) });
		const items = buildContextMenu(
			start,
			snapshot({ selection: selected({ kind: 'start', canDelete: false, canFlip: false }) }),
		);
		expect(rowOf(items, 'edit.delete')).toMatchObject({
			disabled: true,
			title: 'A level needs a start.',
		});
		expect(label(items[0]!)).toBe('Start · x 9, y 11 · line 3');
	});

	it('dims Delete and Flip with the lock reason, naming the layer', () => {
		const items = buildContextMenu(
			target,
			snapshot({ locks: ['enemies'], selection: selected({ lockedLayer: 'enemies' }) }),
		);
		const reason = 'Enemies is locked. Unlock it in Layers to change it.';
		expect(rowOf(items, 'edit.delete')).toMatchObject({ disabled: true, title: reason });
		expect(rowOf(items, 'selection.flip')).toMatchObject({ disabled: true, title: reason });
		expect(rowOf(items, 'panel.inspector.show')).not.toHaveProperty('disabled');
	});

	it('gives the Fizz 2 reason on a level whose things are changed in the script', () => {
		const items = buildContextMenu(
			target,
			snapshot({
				selection: selected({
					editable: false,
					canFlip: false,
					canDelete: false,
					reason: 'inspector.fizz2',
				}),
			}),
		);
		const fizz2 = 'Things in a Fizz 2 level are changed in its script for now.';
		expect(rowOf(items, 'edit.delete')).toMatchObject({ disabled: true, title: fizz2 });
		expect(rowOf(items, 'selection.flip')).toMatchObject({ disabled: true, title: fizz2 });
	});
});

describe('the menu on an Objects row', () => {
	it('is the thing’s menu with Show on the canvas', () => {
		const row: ContextTarget = {
			kind: 'objectRow',
			thing: thing({ kind: 'enemy', name: 'gloop' }),
		};
		const items = buildContextMenu(row, snapshot({ selection: selected({}) }));
		expect(labels(items)).toEqual([
			'Gloop · x 9, y 11 · line 15',
			'Show the Inspector',
			'Show in script',
			'Show on the canvas',
			'-',
			'Flip',
			'-',
			'Delete',
		]);
		expectCleanRules(items);
	});
});

describe('the menu on a Layers row', () => {
	const row: ContextTarget = { kind: 'layerRow', layer: 'treats' };

	it('has Hide, Show only, Lock, its first line, and the two "all" commands', () => {
		const items = buildContextMenu(row, snapshot({ hiddenLayers: ['terrain'], locks: [] }));
		expect(labels(items)).toEqual([
			'Hide Treats',
			'Show only Treats',
			'-',
			'Lock Treats',
			'-',
			'Show its first line in the script',
			'-',
			'Show all',
			'Unlock all',
		]);
		expectCleanRules(items);
		for (const item of items) {
			if (item.type !== 'separator' && item.type !== 'section')
				expect(item.icon, item.id).toBeTruthy();
		}
	});

	it('says Show and Unlock for a layer that is hidden and locked', () => {
		const items = buildContextMenu(row, snapshot({ hiddenLayers: ['treats'], locks: ['treats'] }));
		expect(labels(items).slice(0, 4)).toEqual([
			'Show Treats',
			'Show only Treats',
			'-',
			'Unlock Treats',
		]);
	});

	it('dims Show only when the layer is the only one shown, and Show all when none is hidden', () => {
		const alone = buildContextMenu(
			row,
			snapshot({ hiddenLayers: ['terrain', 'blocks', 'markers', 'enemies'] }),
		);
		expect(rowOf(alone, 'layers.only.treats')).toMatchObject({
			disabled: true,
			title: 'This is the only layer shown.',
		});
		const none = buildContextMenu(row, snapshot());
		expect(rowOf(none, 'layers.showAll')).toMatchObject({
			disabled: true,
			title: 'No layer is hidden',
		});
		expect(rowOf(none, 'layers.unlockAll')).toMatchObject({
			disabled: true,
			title: 'No layer is locked',
		});
	});

	it('has no menu on a level with no layers (Fizz 2) or for a layer it does not have', () => {
		expect(buildContextMenu(row, snapshot({ layers: [] }))).toEqual([]);
		expect(buildContextMenu({ kind: 'layerRow', layer: 'nothing' }, snapshot())).toEqual([]);
	});
});

describe('a window with no editor', () => {
	it('has no level menu, since there is nothing to act on', () => {
		const bare: BridgeSnapshot = { facts: NO_FACTS, handlers: {} };
		expect(canvasMenuItems(canvas(), bare)).toEqual([]);
		expect(canvasMenuItems({ kind: 'objectRow', thing: thing({}) }, bare)).toEqual([]);
		expect(canvasMenuItems({ kind: 'layerRow', layer: 'treats' }, bare)).toEqual([]);
	});
});
