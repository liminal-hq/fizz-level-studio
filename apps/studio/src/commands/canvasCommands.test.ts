// Tests for the canvas commands, the per-layer commands and the lock reasons on Delete and Flip
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { APP_ICONS } from '../icons/AppIcons';
import { enMessages } from '../i18n/messages';
import { NO_CURSOR, NO_FACTS, NO_SELECTION, type BridgeSnapshot } from './commandBridge';
import {
	CANVAS_ERASE_HERE,
	CANVAS_PAINT_HERE,
	CANVAS_PICK_HERE,
	INSPECTOR_SHOW,
	SELECTION_REVEAL,
	eraseBlockedBy,
	paintBlockedBy,
} from './canvasCommands';
import { isOnlyShown, layerCommandId } from './layerCommands';
import { allCommands, reasonId, runCommand, viewOf } from './registry';

const layers = [
	{ id: 'terrain', name: 'Terrain', firstLine: 6 },
	{ id: 'treats', name: 'Treats', firstLine: 15 },
	{ id: 'edits', name: 'Edits', firstLine: null },
];
const snapshot = (
	facts: Partial<BridgeSnapshot['facts']> = {},
	handlers: BridgeSnapshot['handlers'] = {},
): BridgeSnapshot => ({
	facts: {
		...NO_FACTS,
		editorOpen: true,
		hasLevel: true,
		layers,
		brush: { group: 'tile', kind: 'grass' },
		cursor: { inside: true, tile: 'empty', layer: null },
		...facts,
	},
	handlers,
});
const view = (id: string, s: BridgeSnapshot) =>
	viewOf(allCommands(s.facts).find((def) => def.id === id)!, s);
const handled = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, () => {}]));

describe('Pick, Paint and Erase here', () => {
	const ids = [CANVAS_PICK_HERE, CANVAS_PAINT_HERE, CANVAS_ERASE_HERE];

	it('run on the cursor while it is on the level', () => {
		const s = snapshot({}, handled(...ids));
		for (const id of ids) expect(view(id, s), id).toMatchObject({ visible: true, enabled: true });
	});

	it('say to move the cursor when it is off the level', () => {
		const s = snapshot({ cursor: NO_CURSOR }, handled(...ids));
		for (const id of ids) {
			expect(view(id, s), id).toMatchObject({
				enabled: false,
				reason: 'Move the cursor onto the level first.',
			});
		}
	});

	it('name the brush in Paint here, and are hidden without one', () => {
		const s = snapshot({ brush: { group: 'item', kind: 'cookie' } }, handled(CANVAS_PAINT_HERE));
		const def = allCommands(s.facts).find((candidate) => candidate.id === CANVAS_PAINT_HERE)!;
		expect(def.labelValues).toEqual({ brush: 'cookie' });
		expect(
			view(CANVAS_PAINT_HERE, snapshot({ brush: null }, handled(CANVAS_PAINT_HERE))).visible,
		).toBe(false);
	});

	it('dim Paint and Erase with the lock reason when the cell’s layer is locked', () => {
		const s = snapshot(
			{ cursor: { inside: true, tile: 'grass', layer: 'terrain' }, locks: ['terrain'] },
			handled(...ids),
		);
		expect(view(CANVAS_PAINT_HERE, s)).toMatchObject({
			enabled: false,
			reason: 'Terrain is locked. Unlock it in Layers to change it.',
		});
		expect(view(CANVAS_ERASE_HERE, s).enabled).toBe(false);
		expect(view(CANVAS_PICK_HERE, s).enabled).toBe(true);
	});

	it('names several locked layers together', () => {
		const s = snapshot(
			{ cursor: { inside: true, tile: 'grass', layer: 'terrain' }, locks: ['terrain', 'edits'] },
			handled(CANVAS_PAINT_HERE),
		);
		expect(view(CANVAS_PAINT_HERE, s).reason).toBe(
			'Terrain and Edits are locked. Unlock them in Layers to change them.',
		);
	});

	it('block a tile paint on Edits, an item paint on Treats, and leave an open cell free', () => {
		const tile = snapshot({ locks: ['edits'] }).facts;
		expect(paintBlockedBy(tile)).toEqual(['edits']);
		expect(paintBlockedBy({ ...tile, locks: ['treats'] })).toEqual([]);
		const item = { ...tile, brush: { group: 'item' as const, kind: 'cookie' }, locks: ['treats'] };
		expect(paintBlockedBy(item)).toEqual(['treats']);
		const enemy = {
			...tile,
			brush: { group: 'enemy' as const, kind: 'gloop' },
			locks: ['enemies'],
		};
		expect(paintBlockedBy(enemy)).toEqual(['enemies']);
		expect(eraseBlockedBy({ ...tile, locks: ['terrain'] })).toEqual([]);
		expect(
			eraseBlockedBy({
				...tile,
				cursor: { inside: true, tile: 'fill', layer: 'terrain' },
				locks: ['terrain'],
			}),
		).toEqual(['terrain']);
	});
});

describe('Show on the canvas and Show the Inspector', () => {
	it('needs a selection, and runs the handler', () => {
		const run = vi.fn();
		const none = snapshot({}, { [SELECTION_REVEAL]: run });
		expect(view(SELECTION_REVEAL, none)).toMatchObject({
			enabled: false,
			reason: expect.stringContaining('Select an item or enemy first'),
		});
		const some = snapshot(
			{ selection: { ...NO_SELECTION, kind: 'item' } },
			{ [SELECTION_REVEAL]: run },
		);
		expect(runCommand(SELECTION_REVEAL, some)).toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('shows the Inspector whenever the editor is open', () => {
		expect(view(INSPECTOR_SHOW, snapshot({}, handled(INSPECTOR_SHOW))).enabled).toBe(true);
		expect(
			view(INSPECTOR_SHOW, { facts: NO_FACTS, handlers: handled(INSPECTOR_SHOW) }).enabled,
		).toBe(false);
	});
});

describe('the commands of each layer', () => {
	const own = (id: string, s: BridgeSnapshot) => ({
		hide: view(layerCommandId('hide', id), s),
		only: view(layerCommandId('only', id), s),
		lock: view(layerCommandId('lock', id), s),
		reveal: view(layerCommandId('reveal', id), s),
	});
	const all = ['terrain', 'treats', 'edits'].flatMap((id) =>
		(['hide', 'only', 'lock', 'reveal'] as const).map((action) => layerCommandId(action, id)),
	);

	it('are built from the layers fact, four for each layer', () => {
		const ids = allCommands(snapshot().facts).map((def) => def.id);
		for (const id of all) expect(ids).toContain(id);
		expect(allCommands(NO_FACTS).some((def) => def.id.startsWith('layers.hide.'))).toBe(false);
	});

	it('say Hide or Show, and Lock or Unlock, from where the layer is now', () => {
		const label = (id: string, s: BridgeSnapshot) =>
			viewOf(allCommands(s.facts).find((def) => def.id === id)!, s).def.label;
		const open = snapshot({}, handled(...all));
		expect(label(layerCommandId('hide', 'treats'), open)).toBe('layers.hideOne');
		expect(label(layerCommandId('lock', 'treats'), open)).toBe('layers.lockOne');
		const changed = snapshot({ hiddenLayers: ['treats'], locks: ['treats'] }, handled(...all));
		expect(label(layerCommandId('hide', 'treats'), changed)).toBe('layers.showOne');
		expect(label(layerCommandId('lock', 'treats'), changed)).toBe('layers.unlockOne');
		expect(own('treats', changed).hide.def.icon).toBe('layers.show');
		expect(own('treats', changed).lock.def.icon).toBe('layers.unlock');
	});

	it('say whether a layer is already the only one shown', () => {
		const alone = snapshot({ hiddenLayers: ['terrain', 'edits'] }, handled(...all));
		expect(isOnlyShown(alone.facts, 'treats')).toBe(true);
		expect(own('treats', alone).only).toMatchObject({
			enabled: false,
			reason: 'This is the only layer shown.',
		});
		expect(own('terrain', alone).only.enabled).toBe(true);
	});

	it('need a line to show', () => {
		const s = snapshot({}, handled(...all));
		expect(own('treats', s).reveal.enabled).toBe(true);
		expect(own('edits', s).reveal).toMatchObject({
			enabled: false,
			reason: 'This layer has no line in the script.',
		});
	});

	it('run the handler the editor published', () => {
		const run = vi.fn();
		const s = snapshot({}, { [layerCommandId('lock', 'treats')]: run });
		expect(runCommand(layerCommandId('lock', 'treats'), s)).toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
	});
});

describe('Delete and Flip on a locked layer', () => {
	const thing = {
		...NO_SELECTION,
		kind: 'enemy' as const,
		editable: true,
		canFlip: true,
		canDelete: true,
		hasLine: true,
	};
	const handlers = handled('edit.delete', 'selection.flip');

	it('are dimmed with the lock’s reason', () => {
		const s = snapshot(
			{ selection: { ...thing, lockedLayer: 'treats' }, locks: ['treats'] },
			handlers,
		);
		for (const id of ['edit.delete', 'selection.flip']) {
			expect(view(id, s), id).toMatchObject({
				enabled: false,
				reason: 'Treats is locked. Unlock it in Layers to change it.',
			});
		}
	});

	it('run while the layer is open', () => {
		const s = snapshot({ selection: thing }, handlers);
		expect(view('edit.delete', s).enabled).toBe(true);
		expect(view('selection.flip', s).enabled).toBe(true);
	});

	it('keep the start’s own reason, and a generated item’s', () => {
		const start = snapshot(
			{
				selection: {
					...thing,
					kind: 'start',
					canDelete: false,
					canFlip: false,
					lockedLayer: 'treats',
				},
			},
			handlers,
		);
		expect(view('edit.delete', start).reason).toBe('A level needs a start.');
		const generated = snapshot(
			{
				selection: {
					...thing,
					kind: 'item',
					canDelete: false,
					canFlip: false,
					reason: 'selection.generated',
					lockedLayer: 'treats',
				},
			},
			handlers,
		);
		expect(view('edit.delete', generated).reason).toBe(
			'A generator line in the script made this item. Edit that line instead.',
		);
	});
});

describe('the new commands in the catalogue', () => {
	it('have a label, an icon and reasons the catalogue holds', () => {
		const s = snapshot({
			hiddenLayers: ['terrain'],
			locks: ['edits'],
			selection: { ...NO_SELECTION, kind: 'item', lockedLayer: 'treats' },
		});
		const ids = [
			CANVAS_PICK_HERE,
			CANVAS_PAINT_HERE,
			CANVAS_ERASE_HERE,
			SELECTION_REVEAL,
			INSPECTOR_SHOW,
			...['terrain', 'treats', 'edits'].flatMap((id) =>
				(['hide', 'only', 'lock', 'reveal'] as const).map((action) => layerCommandId(action, id)),
			),
		];
		const defs = allCommands(s.facts);
		const states = [s.facts, { ...s.facts, cursor: NO_CURSOR, locks: ['terrain', 'edits'] }];
		for (const id of ids) {
			const def = defs.find((candidate) => candidate.id === id)!;
			expect(def, id).toBeDefined();
			expect(enMessages, id).toHaveProperty(def.label);
			if (def.shortLabel) expect(enMessages, id).toHaveProperty(def.shortLabel);
			expect(def.icon, id).toBeDefined();
			expect(APP_ICONS, id).toHaveProperty(def.icon!);
			expect(def.group, id).toBeDefined();
			for (const facts of states) {
				const reason = def.reason?.(facts);
				if (reason) expect(enMessages, id).toHaveProperty(reasonId(reason));
			}
		}
	});
});
