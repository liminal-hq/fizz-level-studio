// An in-memory RecoveryClient for tests
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { RecoveryClient, RecoveryEntry } from './recoveryClient';

/** Holds entries and the snapshot each restores to; `failRestore` and `failDiscard` make calls throw. */
export class FakeRecoveryClient implements RecoveryClient {
	entries: RecoveryEntry[];
	restored: string[] = [];
	discarded: string[] = [];
	failRestore = new Set<string>();
	failDiscard = new Set<string>();
	listCalls = 0;
	private readonly snapshots: Map<string, LevelSnapshot>;

	constructor(entries: RecoveryEntry[] = [], snapshots: Record<string, LevelSnapshot> = {}) {
		this.entries = [...entries];
		this.snapshots = new Map(Object.entries(snapshots));
	}

	async list(): Promise<RecoveryEntry[]> {
		this.listCalls += 1;
		return [...this.entries];
	}

	async restore(id: string): Promise<LevelSnapshot> {
		if (this.failRestore.has(id)) throw { kind: 'io', message: 'gone' };
		const snapshot = this.snapshots.get(id);
		if (!snapshot) throw { kind: 'not_found' };
		this.restored.push(id);
		this.entries = this.entries.filter((entry) => entry.id !== id);
		return snapshot;
	}

	async discard(id: string): Promise<void> {
		if (this.failDiscard.has(id)) throw { kind: 'io', message: 'locked' };
		this.discarded.push(id);
		this.entries = this.entries.filter((entry) => entry.id !== id);
	}
}
