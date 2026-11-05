// The webview's view of the level backend: the commands it sends and the snapshots it gets back
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelError } from '@liminal-hq/fizz-studio-protocol/generated/LevelError';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';

/**
 * What the editor needs from the backend for one open level. Every command takes the revision the
 * caller last saw and resolves to the new snapshot, or rejects with a `LevelError` (a stale
 * revision is `{ kind: 'stale' }` and changes nothing). The real client wraps the worlds plugin;
 * `FakeLevelClient` stands in for tests and development.
 */
export interface LevelClient {
	/**
	 * Appends one edit. Edits that share a `mergeKey` while a step is open fold into one undo step;
	 * `endStep` closes it.
	 */
	applyEdit(
		id: string,
		edit: LevelEdit,
		basedOn: bigint,
		mergeKey?: string,
	): Promise<LevelSnapshot>;
	/** Closes the open merge group so the next edit starts a new undo step. */
	endStep(id: string): Promise<LevelSnapshot>;
	undo(id: string, basedOn: bigint): Promise<LevelSnapshot>;
	redo(id: string, basedOn: bigint): Promise<LevelSnapshot>;
	/** Listens for snapshots the backend pushes (another window, Claude, an outside edit). */
	onChanged(listener: (snapshot: LevelSnapshot) => void): () => void;
}

/** True for a value shaped like the backend's `LevelError`. */
export function isLevelError(value: unknown): value is LevelError {
	return (
		typeof value === 'object' &&
		value !== null &&
		'kind' in value &&
		['stale', 'not_open', 'invalid', 'io'].includes((value as { kind: string }).kind)
	);
}
