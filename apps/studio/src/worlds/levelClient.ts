// The webview's view of the level backend: the commands it sends and the snapshots it gets back
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelError } from '@liminal-hq/fizz-studio-protocol/generated/LevelError';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';

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
	/**
	 * The level's current snapshot, for a window that did not open it (a panel in a window of its
	 * own). Rejects with `{ kind: 'not_open' }` for a level that is not open.
	 */
	read(id: string): Promise<LevelSnapshot>;
	/** The language's documented words, from Rust, for the Palette and completion. */
	words(): Promise<WordDoc[]>;
	/** The changes Claude proposed for this level that nobody has answered yet. Read-only. */
	ghosts(id: string): Promise<GhostProposal[]>;
	/** The script line (from 1) of the last statement that changed a cell, or `null` if none did. */
	cellLine(id: string, x: number, y: number): Promise<number | null>;
	/**
	 * The level drawn without the statements of the `hidden` layers, as if they were not in the
	 * script. Read-only: nothing is saved and the level is untouched.
	 */
	viewMasked(id: string, hidden: string[]): Promise<LevelView>;
	/** The layers of the level that are locked, as layer ids. */
	layers(id: string): Promise<string[]>;
	/** Locks or unlocks a layer, and resolves to the locked layers as they are now. */
	setLayerLocked(id: string, layer: string, locked: boolean): Promise<string[]>;
	/** Listens for changes to a level's locked layers, from any window. */
	onLayersChanged(listener: (id: string, locked: string[]) => void): () => void;
	/** Listens for snapshots the backend pushes (another window, Claude, an outside edit). */
	onChanged(listener: (snapshot: LevelSnapshot) => void): () => void;
}

/** True for a value shaped like the backend's `LevelError`. */
export function isLevelError(value: unknown): value is LevelError {
	return (
		typeof value === 'object' &&
		value !== null &&
		'kind' in value &&
		['stale', 'not_open', 'invalid', 'io', 'locked', 'gone'].includes(
			(value as { kind: string }).kind,
		)
	);
}
