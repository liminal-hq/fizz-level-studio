// Tests for naming the selected thing for an edit
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { levelView } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { thingRef } from './thingRef';

const text = [
	'script fizz1 0',
	'level crater',
	'start 2,1',
	'treats',
	'soda x=3 y=1',
	'enemies',
	'gloop x=5',
].join('\n');
const view = levelView(12, 8, {
	items: [{ kind: 'soda', x: 3, y: 1, generator: null, line: 5 }],
	spawns: [{ kind: 'gloop', x: 5, y: null, dir: null, ride: false, on_ground: true, line: 7 }],
	start: { x: 2, y: 1, line: 3 },
});
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

describe('thingRef', () => {
	it('names an item with its index, its line and that line’s text', () => {
		expect(thingRef(view, text, thing({}))).toEqual({
			kind: 'item',
			index: 0,
			line: 5,
			expect: 'soda x=3 y=1',
			x: 3,
			y: 1,
		});
	});

	it('names a ground enemy with no row', () => {
		expect(
			thingRef(view, text, thing({ kind: 'enemy', name: 'gloop', x: 5, y: 1, line: 7 })),
		).toEqual({ kind: 'spawn', index: 0, line: 7, expect: 'gloop x=5', x: 5, y: null });
	});

	it('names the start with index 0', () => {
		expect(thingRef(view, text, thing({ kind: 'start', name: 'start', line: 3 }))).toMatchObject({
			kind: 'start',
			index: 0,
			line: 3,
			expect: 'start 2,1',
		});
	});

	it('keeps a carriage return the line ends with', () => {
		const crlf = text.replace(/\n/g, '\r\n');
		expect(thingRef(view, crlf, thing({}))?.expect).toBe('soda x=3 y=1\r');
	});

	it('names nothing for a cell, a thing with no line, or an entry the view lost', () => {
		expect(thingRef(view, text, thing({ kind: 'cell', line: null }))).toBeNull();
		expect(thingRef(view, text, thing({ line: null }))).toBeNull();
		expect(thingRef(view, text, thing({ index: 4 }))).toBeNull();
		expect(thingRef(view, text, thing({ line: 99 }))).toBeNull();
		expect(thingRef({ ...view, start: null }, text, thing({ kind: 'start', line: 3 }))).toBeNull();
	});
});
