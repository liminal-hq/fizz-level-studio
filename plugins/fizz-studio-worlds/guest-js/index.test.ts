// Tests for the guest-js revision rule and the command names it sends
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LevelSnapshot } from './index';

const invoke = vi.fn();
type Handler = (event: { payload: unknown }) => void;
const handlers: Record<string, Handler[]> = {};

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock('@tauri-apps/api/event', () => ({
	listen: (name: string, handler: Handler) => {
		(handlers[name] ??= []).push(handler);
		return Promise.resolve(() => {});
	},
}));

const {
	applyEdit,
	closeLevel,
	createLevel,
	discardRecovery,
	levelCellLine,
	endStep,
	newerOnly,
	onLevelChanged,
	onLevelConflict,
	openLevel,
	openProject,
	languageWords,
	levelGhosts,
	levelSnapshot,
	listRecovery,
	redo,
	restoreRecovery,
	saveLevel,
	undo,
} = await import('./index');

function snapshot(id: string, revision: number): LevelSnapshot {
	return { id, revision: BigInt(revision) } as unknown as LevelSnapshot;
}

beforeEach(() => {
	invoke.mockReset();
	for (const name of Object.keys(handlers)) delete handlers[name];
});

describe('newerOnly', () => {
	it('ignores a snapshot at or below the revision already applied for that level', () => {
		const heard: number[] = [];
		const hear = newerOnly(new Map([['a', 3]]), (s) => heard.push(Number(s.revision)));
		for (const revision of [2, 3, 4, 4, 5, 1]) hear(snapshot('a', revision));
		expect(heard).toEqual([4, 5]);
	});

	it('keeps a revision for each level apart', () => {
		const heard: string[] = [];
		const hear = newerOnly(new Map(), (s) => heard.push(`${s.id}:${s.revision}`));
		hear(snapshot('a', 5));
		hear(snapshot('b', 1));
		hear(snapshot('a', 5));
		hear(snapshot('b', 2));
		expect(heard).toEqual(['a:5', 'b:1', 'b:2']);
	});

	it('hears a snapshot of a level it has not seen, whatever its revision', () => {
		const heard: number[] = [];
		newerOnly(new Map(), (s) => heard.push(Number(s.revision)))(snapshot('a', 0));
		expect(heard).toEqual([0]);
	});

	it('learns of a revision the caller applied itself', () => {
		const applied = new Map<string, number>();
		const heard: number[] = [];
		const hear = newerOnly(applied, (s) => heard.push(Number(s.revision)));
		applied.set('a', 7);
		hear(snapshot('a', 7));
		hear(snapshot('a', 8));
		expect(heard).toEqual([8]);
	});
});

describe('listeners', () => {
	it('onLevelChanged applies the rule to events', async () => {
		const heard: number[] = [];
		await onLevelChanged((s) => heard.push(Number(s.revision)), new Map([['a', 1]]));
		for (const handler of handlers['level://changed'] ?? []) {
			handler({ payload: snapshot('a', 1) });
			handler({ payload: snapshot('a', 2) });
		}
		expect(heard).toEqual([2]);
	});

	it('onLevelConflict passes the conflict through', async () => {
		const heard: unknown[] = [];
		await onLevelConflict((c) => heard.push(c));
		handlers['level://conflict'][0]({ payload: { id: 'a', marked: '<<<<<<<' } });
		expect(heard).toEqual([{ id: 'a', marked: '<<<<<<<' }]);
	});
});

describe('recovery', () => {
	it('sends the recovery commands under the plugin prefix', async () => {
		invoke.mockResolvedValue(null);
		await listRecovery();
		await restoreRecovery('level-1');
		await discardRecovery('level-1');
		const prefix = 'plugin:fizz-studio-worlds|';
		expect(invoke.mock.calls).toEqual([
			[`${prefix}recovery_list`, undefined],
			[`${prefix}recovery_restore`, { id: 'level-1' }],
			[`${prefix}recovery_discard`, { id: 'level-1' }],
		]);
	});
});

describe('language words and cell lines', () => {
	it('asks for the words and for the line of a cell', async () => {
		invoke.mockResolvedValue(null);
		await languageWords();
		await levelCellLine('level-1', 50, 10);
		const prefix = 'plugin:fizz-studio-worlds|';
		expect(invoke.mock.calls).toEqual([
			[`${prefix}language_words`, undefined],
			[`${prefix}level_cell_line`, { id: 'level-1', x: 50, y: 10 }],
		]);
	});
});

describe('commands', () => {
	it('sends each command under the plugin prefix with camelCase arguments', async () => {
		invoke.mockResolvedValue(null);
		const edit = { kind: 'clear', x: [[0, 1]], y: [[2, 3]] } as const;
		await openProject('/w');
		await openLevel('/w/a.fizz');
		await applyEdit('a', edit, 4, 'stroke');
		await applyEdit('a', edit, 5);
		await endStep('a');
		await undo('a', 6);
		await redo('a', 7);
		await saveLevel('a');
		await closeLevel('a');
		const prefix = 'plugin:fizz-studio-worlds|';
		expect(invoke.mock.calls).toEqual([
			[`${prefix}project_open`, { path: '/w' }],
			[`${prefix}level_open`, { path: '/w/a.fizz' }],
			[`${prefix}level_apply`, { id: 'a', edit, basedOn: 4, mergeKey: 'stroke' }],
			[`${prefix}level_apply`, { id: 'a', edit, basedOn: 5, mergeKey: null }],
			[`${prefix}level_end_step`, { id: 'a' }],
			[`${prefix}level_undo`, { id: 'a', basedOn: 6 }],
			[`${prefix}level_redo`, { id: 'a', basedOn: 7 }],
			[`${prefix}level_save`, { id: 'a' }],
			[`${prefix}level_close`, { id: 'a' }],
		]);
	});
});

describe('words and ghosts', () => {
	it('reads the language words and the ghosts under the plugin prefix', async () => {
		invoke.mockResolvedValue([]);
		await languageWords();
		await levelGhosts('a');
		await levelSnapshot('a');
		const prefix = 'plugin:fizz-studio-worlds|';
		expect(invoke.mock.calls).toEqual([
			[`${prefix}language_words`, undefined],
			[`${prefix}level_ghosts`, { id: 'a' }],
			[`${prefix}level_snapshot`, { id: 'a' }],
		]);
	});
});

describe('createLevel', () => {
	it('sends the request to level_create', async () => {
		invoke.mockResolvedValue(snapshot('a', 1));
		const request = {
			name: 'Hill',
			id: 'hill',
			width: 40,
			height: 24,
			ground: null,
			theme: null,
			target: 'fizz2' as const,
			folder: '/tmp',
		};
		await createLevel(request);
		expect(invoke).toHaveBeenCalledWith('plugin:fizz-studio-worlds|level_create', { request });
	});
});
