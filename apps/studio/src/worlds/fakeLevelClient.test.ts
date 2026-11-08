// Tests for the in-memory level client
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import { describe, expect, it, vi } from 'vitest';
import type { ThingRef } from '@liminal-hq/fizz-studio-protocol/generated/ThingRef';
import { levelSnapshot, levelView } from '../test/levelFixtures';
import { FakeLevelClient } from './fakeLevelClient';
import { isLevelError } from './levelClient';

const paint = (x: number, tile = 'grass'): LevelEdit => ({
	kind: 'paint',
	tile,
	x: [[x, x + 1]],
	y: [[2, 2]],
});

describe('FakeLevelClient', () => {
	it('paints cells, bumps the revision and records the step name', async () => {
		const client = new FakeLevelClient(levelSnapshot());
		const next = await client.applyEdit('level-1', paint(3), 1n);
		expect(next.revision).toBe(2n);
		const grass = next.view.palette.indexOf('grass');
		expect(next.view.cells[2 * 12 + 3]).toBe(grass);
		expect(next.view.cells[2 * 12 + 4]).toBe(grass);
		expect(next.can_undo).toBe(true);
		expect(next.undo_name).toBe('Paint grass');
		expect(next.text).toContain('paint grass x=3..4 y=2');
	});

	it('clears cells and places items', async () => {
		const client = new FakeLevelClient(levelSnapshot());
		let s = await client.applyEdit('level-1', { kind: 'clear', x: [[0, 0]], y: [[0, 0]] }, 1n);
		expect(s.view.cells[0]).toBe(0);
		s = await client.applyEdit(
			'level-1',
			{ kind: 'place', item: 'cheezie', x: [[5, 5]], y: [[3, 3]] },
			s.revision,
		);
		// The fixture's script has two lines, so the clear is line 3 and the place line 4.
		expect(s.view.items).toEqual([{ kind: 'cheezie', x: 5, y: 3, generator: null, line: 4 }]);
	});

	it('refuses a stale revision and changes nothing', async () => {
		const client = new FakeLevelClient(levelSnapshot());
		await client.applyEdit('level-1', paint(0), 1n);
		const error = await client.applyEdit('level-1', paint(5), 1n).catch((e: unknown) => e);
		expect(isLevelError(error)).toBe(true);
		expect(error).toEqual({ kind: 'stale', based_on: 1n, current: 2n });
		expect(client.snapshot().revision).toBe(2n);
	});

	it('refuses an id that is not open', async () => {
		const client = new FakeLevelClient(levelSnapshot());
		await expect(client.endStep('nope')).rejects.toEqual({ kind: 'not_open', id: 'nope' });
	});

	it('folds edits sharing a merge key into one undo step until endStep', async () => {
		const client = new FakeLevelClient(levelSnapshot());
		let s = await client.applyEdit('level-1', paint(0), 1n, 'k');
		s = await client.applyEdit('level-1', paint(4), s.revision, 'k');
		await client.endStep('level-1');
		s = await client.undo('level-1', s.revision);
		expect(s.view.cells[2 * 12]).toBe(0);
		expect(s.view.cells[2 * 12 + 4]).toBe(0);
		expect(s.can_undo).toBe(false);
		expect(s.can_redo).toBe(true);
		expect(s.revision).toBe(4n);
	});

	it('redoes an undone step and names it', async () => {
		const client = new FakeLevelClient(levelSnapshot());
		let s = await client.applyEdit('level-1', paint(0), 1n);
		s = await client.undo('level-1', s.revision);
		expect(s.redo_name).toBe('Paint grass');
		s = await client.redo('level-1', s.revision);
		expect(s.view.cells[2 * 12]).toBe(s.view.palette.indexOf('grass'));
		expect(s.can_redo).toBe(false);
	});

	it('notifies listeners until they unsubscribe', () => {
		const client = new FakeLevelClient(levelSnapshot());
		const listener = vi.fn();
		const off = client.onChanged(listener);
		client.emit();
		off();
		client.emit();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('answers words and ghosts from what a test sets, and refuses an unknown level', async () => {
		const client = new FakeLevelClient(levelSnapshot());
		expect(await client.words()).toEqual([]);
		client.ghostProposals = [
			{ id: 'h1', title: 'T', why: null, lines: [], cells: [], layers: ['edits'] },
		];
		expect(await client.ghosts('level-1')).toHaveLength(1);
		await expect(client.ghosts('nope')).rejects.toMatchObject({ kind: 'not_open' });
	});
});

describe('FakeLevelClient thing edits', () => {
	const ref = (over: Partial<ThingRef>): ThingRef => ({
		kind: 'item',
		index: 0,
		line: 4,
		expect: '',
		x: 3,
		y: 1,
		...over,
	});
	const start = () =>
		new FakeLevelClient(
			levelSnapshot(
				{},
				levelView(12, 8, {
					items: [
						{ kind: 'soda', x: 3, y: 1, generator: null, line: 4 },
						{ kind: 'cookie', x: 6, y: 2, generator: 'pogo-cache', line: 5 },
					],
					spawns: [
						{ kind: 'gloop', x: 5, y: null, dir: null, ride: false, on_ground: true, line: 7 },
						{ kind: 'ent', x: 9, y: 3, dir: null, ride: true, on_ground: false, line: 8 },
					],
				}),
			),
		);

	it('moves an item, a spawn and the start in the view and names the step, without writing text', async () => {
		const client = start();
		let s = await client.applyEdit(
			'level-1',
			{ kind: 'move-thing', thing: ref({}), x: 4, y: 1 },
			1n,
		);
		expect(s.view.items[0]).toMatchObject({ x: 4, y: 1 });
		expect(s.undo_name).toBe('Move soda to 4, 1');
		expect(s.text).toBe(levelSnapshot().text);
		s = await client.applyEdit(
			'level-1',
			{ kind: 'move-thing', thing: ref({ kind: 'spawn', index: 0, y: null }), x: 6, y: 3 },
			s.revision,
		);
		expect(s.view.spawns[0]).toMatchObject({ x: 6, y: 3, on_ground: false });
		s = await client.applyEdit(
			'level-1',
			{ kind: 'move-thing', thing: ref({ kind: 'start', index: 0 }), x: 2, y: 2 },
			s.revision,
		);
		expect(s.view.start).toMatchObject({ x: 2, y: 2 });
	});

	it('puts a spawn back on the ground, turns it, and refuses to turn a rider', async () => {
		const client = start();
		let s = await client.applyEdit(
			'level-1',
			{ kind: 'face-thing', thing: ref({ kind: 'spawn', index: 0 }), facing: 'right' },
			1n,
		);
		expect(s.view.spawns[0]!.dir).toBe(1);
		expect(s.undo_name).toBe('Turn gloop to face right');
		await expect(
			client.applyEdit(
				'level-1',
				{ kind: 'face-thing', thing: ref({ kind: 'spawn', index: 1 }), facing: 'left' },
				s.revision,
			),
		).rejects.toMatchObject({ kind: 'invalid' });
		s = await client.applyEdit(
			'level-1',
			{ kind: 'move-thing', thing: ref({ kind: 'spawn', index: 0 }), x: 5, y: null },
			s.revision,
		);
		expect(s.view.spawns[0]).toMatchObject({ y: null, on_ground: true });
	});

	it('deletes an item or a spawn, and refuses the start and a generated item', async () => {
		const client = start();
		const s = await client.applyEdit('level-1', { kind: 'delete-thing', thing: ref({}) }, 1n);
		expect(s.view.items.map((i) => i.kind)).toEqual(['cookie']);
		await expect(
			client.applyEdit(
				'level-1',
				{ kind: 'delete-thing', thing: ref({ kind: 'start', index: 0 }) },
				s.revision,
			),
		).rejects.toMatchObject({ kind: 'invalid' });
		await expect(
			client.applyEdit('level-1', { kind: 'delete-thing', thing: ref({ index: 0 }) }, s.revision),
		).rejects.toMatchObject({ kind: 'invalid' });
	});

	it('says gone for a thing that is not there, and merges a run under one key into one step', async () => {
		const client = start();
		await expect(
			client.applyEdit('level-1', { kind: 'delete-thing', thing: ref({ index: 9 }) }, 1n),
		).rejects.toMatchObject({ kind: 'gone', line: 4 });
		let s = await client.applyEdit(
			'level-1',
			{ kind: 'move-thing', thing: ref({}), x: 4, y: 1 },
			1n,
			'k',
		);
		s = await client.applyEdit(
			'level-1',
			{ kind: 'move-thing', thing: ref({}), x: 5, y: 1 },
			s.revision,
			'k',
		);
		expect(s.undo_name).toBe('Move soda to 5, 1');
		s = await client.undo('level-1', s.revision);
		expect(s.view.items[0]).toMatchObject({ x: 3 });
		expect(s.can_undo).toBe(false);
	});
});
