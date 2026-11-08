// Tests for what the selection commands may do with the selected thing
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { NO_SELECTION } from '../commands/commandBridge';
import { levelSections, levelSnapshot, levelView } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { selectionFacts } from './selectionFacts';

const view = levelView(12, 8, {
	items: [
		{ kind: 'soda', x: 3, y: 1, generator: null, line: 5 },
		{ kind: 'cookie', x: 6, y: 2, generator: 'pogo-cache', line: 8 },
	],
	spawns: [
		{ kind: 'gloop', x: 5, y: null, dir: null, ride: false, on_ground: true, line: 11 },
		{ kind: 'ent', x: 9, y: 3, dir: null, ride: true, on_ground: false, line: 13 },
	],
	start: { x: 2, y: 1, line: 3 },
});
const snapshot = levelSnapshot({}, view);
const thing = (over: Partial<Thing>): Thing => ({
	kind: 'item',
	name: 'soda',
	x: 3,
	y: 1,
	layer: 'objects',
	index: 0,
	line: 5,
	...over,
});

describe('selectionFacts', () => {
	it('allows nothing with no selection, and nothing for a cell', () => {
		expect(selectionFacts(snapshot, null)).toEqual(NO_SELECTION);
		expect(selectionFacts(snapshot, thing({ kind: 'cell', line: null }))).toEqual({
			...NO_SELECTION,
			kind: 'cell',
		});
	});

	it('lets a hand-written item be moved and deleted but not turned', () => {
		expect(selectionFacts(snapshot, thing({}))).toMatchObject({
			kind: 'item',
			editable: true,
			canDelete: true,
			canFlip: false,
			hasLine: true,
			reason: null,
		});
	});

	it('lets an enemy be turned, and a rider not', () => {
		expect(selectionFacts(snapshot, thing({ kind: 'enemy', index: 0, line: 11 }))).toMatchObject({
			canFlip: true,
			canDelete: true,
		});
		expect(selectionFacts(snapshot, thing({ kind: 'enemy', index: 1, line: 13 }))).toMatchObject({
			editable: true,
			canFlip: false,
			canDelete: true,
		});
	});

	it('lets the start be moved but not deleted or turned', () => {
		expect(selectionFacts(snapshot, thing({ kind: 'start', index: 0, line: 3 }))).toMatchObject({
			editable: true,
			canDelete: false,
			canFlip: false,
		});
	});

	it('shows a generated item with its reason and Show in script only', () => {
		expect(selectionFacts(snapshot, thing({ index: 1, line: 8 }))).toEqual({
			kind: 'item',
			editable: false,
			canFlip: false,
			canDelete: false,
			hasLine: true,
			reason: 'selection.generated',
			lockedLayer: null,
		});
	});

	it('shows a Fizz 2 level’s start read-only', () => {
		const fizz2 = levelSnapshot({ target: 'fizz2' }, view);
		expect(selectionFacts(fizz2, thing({ kind: 'start', index: 0, line: 3 }))).toMatchObject({
			editable: false,
			hasLine: true,
			reason: 'inspector.fizz2',
		});
	});

	it('allows nothing for an entry that is gone', () => {
		expect(selectionFacts(snapshot, thing({ index: 9 }))).toEqual(NO_SELECTION);
	});

	it('names the locked layer the thing is written in, and only when it is locked', () => {
		const layered = levelSnapshot(
			{},
			{
				...view,
				sections: levelSections(),
			},
		);
		// The soda is on line 5, which no layer owns in the fixture's sections; the cookie is on line 8 (Terrain).
		expect(selectionFacts(layered, thing({ index: 1, line: 8 }), ['terrain']).lockedLayer).toBe(
			'terrain',
		);
		expect(
			selectionFacts(layered, thing({ index: 1, line: 8 }), ['treats']).lockedLayer,
		).toBeNull();
		expect(selectionFacts(layered, thing({ index: 1, line: 8 })).lockedLayer).toBeNull();
		expect(selectionFacts(layered, thing({}), ['terrain']).lockedLayer).toBeNull();
	});
});
