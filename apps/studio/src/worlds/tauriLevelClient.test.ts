// Tests for the real level client, with the worlds plugin's guest-js mocked
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { levelSnapshot } from '../test/levelFixtures';

const plugin = vi.hoisted(() => ({
	applyEdit: vi.fn(),
	closeLevel: vi.fn(),
	endStep: vi.fn(),
	languageWords: vi.fn(),
	levelGhosts: vi.fn(),
	onLevelChanged: vi.fn(),
	onLevelConflict: vi.fn(),
	openLevel: vi.fn(),
	redo: vi.fn(),
	saveLevel: vi.fn(),
	undo: vi.fn(),
}));
vi.mock('@liminal-hq/fizz-studio-plugin-worlds', () => plugin);

import {
	isDirty,
	levelConflicts,
	normaliseSnapshot,
	revisionToWire,
	TauriLevelClient,
} from './tauriLevelClient';

/** A snapshot as JSON delivers it: the revisions are numbers, whatever the types say. */
function wire(revision: number, saved: number, id = 'level-1') {
	return {
		...levelSnapshot({ id }),
		revision: revision as unknown as bigint,
		saved_revision: saved as unknown as bigint,
	};
}

beforeEach(() => {
	for (const fn of Object.values(plugin)) fn.mockReset();
});

describe('normaliseSnapshot', () => {
	it('turns numeric revisions into bigints', () => {
		const out = normaliseSnapshot(wire(7, 3));
		expect(out.revision).toBe(7n);
		expect(out.saved_revision).toBe(3n);
	});

	it('leaves bigints alone', () => {
		expect(normaliseSnapshot(levelSnapshot({ revision: 9n })).revision).toBe(9n);
	});
});

describe('revisionToWire and isDirty', () => {
	it('sends a number', () => {
		expect(revisionToWire(12n)).toBe(12);
	});

	it('is dirty only when the revision is past the saved one', () => {
		expect(isDirty({ revision: 2n, saved_revision: 2n })).toBe(false);
		expect(isDirty({ revision: 3n, saved_revision: 2n })).toBe(true);
	});
});

describe('TauriLevelClient', () => {
	it('opens with bigint revisions', async () => {
		plugin.openLevel.mockResolvedValue(wire(1, 1));
		const snapshot = await new TauriLevelClient().open('/a.fizz');
		expect(plugin.openLevel).toHaveBeenCalledWith('/a.fizz');
		expect(snapshot.revision).toBe(1n);
	});

	it('sends basedOn as a number and answers with bigints', async () => {
		plugin.applyEdit.mockResolvedValue(wire(5, 1));
		const edit = { kind: 'clear', x: [[1, 1]], y: [[1, 1]] } as never;
		const out = await new TauriLevelClient().applyEdit('level-1', edit, 4n, 'k');
		expect(plugin.applyEdit).toHaveBeenCalledWith('level-1', edit, 4, 'k');
		expect(out.revision).toBe(5n);
	});

	it('sends undo and redo revisions as numbers', async () => {
		plugin.undo.mockResolvedValue(wire(6, 1));
		plugin.redo.mockResolvedValue(wire(7, 1));
		const client = new TauriLevelClient();
		await client.undo('level-1', 5n);
		await client.redo('level-1', 6n);
		expect(plugin.undo).toHaveBeenCalledWith('level-1', 5);
		expect(plugin.redo).toHaveBeenCalledWith('level-1', 6);
	});

	it('answers endStep with the latest snapshot it holds', async () => {
		plugin.openLevel.mockResolvedValue(wire(1, 1));
		plugin.endStep.mockResolvedValue(undefined);
		const client = new TauriLevelClient();
		await client.open('/a.fizz');
		expect((await client.endStep('level-1')).revision).toBe(1n);
	});

	it('rejects endStep for a level it does not hold', async () => {
		plugin.endStep.mockResolvedValue(undefined);
		await expect(new TauriLevelClient().endStep('nope')).rejects.toEqual({ kind: 'not_open' });
	});

	it('normalises pushed snapshots and ignores the echo of its own answer', async () => {
		let push: (snapshot: ReturnType<typeof wire>) => void = () => {};
		plugin.onLevelChanged.mockImplementation(async (listener, applied) => {
			push = (snapshot) => {
				// Mirrors the plugin's own revision rule.
				if ((applied.get(snapshot.id) ?? -1) >= Number(snapshot.revision)) return;
				applied.set(snapshot.id, Number(snapshot.revision));
				listener(snapshot);
			};
			return () => {};
		});
		plugin.applyEdit.mockResolvedValue(wire(5, 1));
		const client = new TauriLevelClient();
		const heard = vi.fn();
		client.onChanged(heard);
		await Promise.resolve();
		await client.applyEdit('level-1', {} as never, 4n);
		push(wire(5, 1));
		expect(heard).not.toHaveBeenCalled();
		push(wire(6, 1));
		expect(heard).toHaveBeenCalledTimes(1);
		expect(heard.mock.calls[0]![0].revision).toBe(6n);
	});

	it('unsubscribes even when asked before the listener is ready', async () => {
		const unlisten = vi.fn();
		plugin.onLevelChanged.mockResolvedValue(unlisten);
		new TauriLevelClient().onChanged(() => {})();
		await Promise.resolve();
		await Promise.resolve();
		expect(unlisten).toHaveBeenCalled();
	});

	it('closes and saves through the plugin', async () => {
		plugin.saveLevel.mockResolvedValue(wire(2, 2));
		plugin.closeLevel.mockResolvedValue(undefined);
		const client = new TauriLevelClient();
		expect((await client.save('level-1')).saved_revision).toBe(2n);
		await client.close('level-1');
		expect(plugin.closeLevel).toHaveBeenCalledWith('level-1');
	});
});

describe('levelConflicts', () => {
	it('relays conflicts and stops on request', async () => {
		const unlisten = vi.fn();
		let deliver: (conflict: { id: string; marked: string }) => void = () => {};
		plugin.onLevelConflict.mockImplementation(async (listener) => {
			deliver = listener;
			return unlisten;
		});
		const heard = vi.fn();
		const stop = levelConflicts(heard);
		await Promise.resolve();
		deliver({ id: 'level-1', marked: '<<<<' });
		expect(heard).toHaveBeenCalledWith({ id: 'level-1', marked: '<<<<' });
		stop();
		expect(unlisten).toHaveBeenCalled();
	});
});

describe('words and ghosts', () => {
	it('reads both through the plugin', async () => {
		const doc = { word: 'paint', kind: 'statement', syntax: 's', example: 'e', note: 'n' };
		plugin.languageWords.mockResolvedValue([doc]);
		plugin.levelGhosts.mockResolvedValue([]);
		const client = new TauriLevelClient();
		await expect(client.words()).resolves.toEqual([doc]);
		await expect(client.ghosts('a')).resolves.toEqual([]);
		expect(plugin.levelGhosts).toHaveBeenCalledWith('a');
	});
});
