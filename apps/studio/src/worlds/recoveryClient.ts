// The recovery copies a crashed session left behind, over the worlds plugin's guest-js
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	discardRecovery,
	listRecovery,
	restoreRecovery,
	type LevelSnapshot,
	type RecoveryEntry,
} from '@liminal-hq/fizz-studio-plugin-worlds';
import { normaliseSnapshot } from './tauriLevelClient';

export type { RecoveryEntry };

/** Recovered levels: list them, open one with its unsaved changes, or throw one away. */
export interface RecoveryClient {
	list(): Promise<RecoveryEntry[]>;
	/** Opens the level with the recovered text as unsaved changes; revisions are `bigint`. */
	restore(id: string): Promise<LevelSnapshot>;
	discard(id: string): Promise<void>;
}

/** The wire sends `saved_at_ms` as a JSON number; hands it on as a real `bigint`. */
export function normaliseEntry(entry: RecoveryEntry): RecoveryEntry {
	return { ...entry, saved_at_ms: BigInt(entry.saved_at_ms) };
}

/** The real client. */
export const recoveryClient: RecoveryClient = {
	list: async () => (await listRecovery()).map(normaliseEntry),
	restore: async (id) => normaliseSnapshot(await restoreRecovery(id)),
	discard: (id) => discardRecovery(id),
};
