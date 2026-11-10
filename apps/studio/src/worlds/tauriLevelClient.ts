// The real LevelClient: the worlds plugin's guest-js, with revisions normalised to bigint
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	applyEdit,
	closeLevel,
	endStep,
	languageWords,
	levelCellLine,
	levelGhosts,
	levelLayers,
	levelSnapshot,
	levelViewMasked,
	onLevelChanged,
	onLevelConflict,
	onLevelLayers,
	openLevel,
	redo,
	saveLevel,
	setLayerLocked,
	undo,
	type GhostProposal,
	type LevelConflict,
	type LevelEdit,
	type LevelSnapshot,
	type LevelView,
	type WordDoc,
} from '@liminal-hq/fizz-studio-plugin-worlds';
import type { LevelClient } from './levelClient';

export type { LevelConflict };

/**
 * What the main window needs beyond editing: opening, saving and closing a level, and hearing a
 * conflict. The real implementation is `TauriLevelClient`; tests supply a fake.
 */
export interface WorldsClient {
	open(path: string): Promise<LevelSnapshot>;
	save(id: string): Promise<LevelSnapshot>;
	close(id: string): Promise<void>;
	onConflict(listener: (conflict: LevelConflict) => void): () => void;
}

/**
 * The plugin types its revisions as `bigint`, but a JSON number is what arrives. Returns the
 * snapshot with both revisions as real `bigint`s.
 */
export function normaliseSnapshot(snapshot: LevelSnapshot): LevelSnapshot {
	return {
		...snapshot,
		revision: BigInt(snapshot.revision),
		saved_revision: BigInt(snapshot.saved_revision),
	};
}

/** A revision as the plugin's commands take it: a plain number. */
export function revisionToWire(revision: bigint): number {
	return Number(revision);
}

/** True when the level has changes the file does not: its revision is past the saved one. */
export function isDirty(snapshot: Pick<LevelSnapshot, 'revision' | 'saved_revision'>): boolean {
	return snapshot.revision !== snapshot.saved_revision;
}

/** Turns a plugin subscription that resolves later into an unsubscribe that works at once. */
function subscribe(start: () => Promise<() => void>): () => void {
	let stop: (() => void) | null = null;
	let cancelled = false;
	void start().then((unlisten) => {
		if (cancelled) unlisten();
		else stop = unlisten;
	});
	return () => {
		cancelled = true;
		stop?.();
	};
}

/** Hears `level://conflict` for every open level; returns the unsubscribe. */
export function levelConflicts(listener: (conflict: LevelConflict) => void): () => void {
	return subscribe(() => onLevelConflict(listener));
}

/** A `LevelClient` and `WorldsClient` over the worlds plugin. */
export class TauriLevelClient implements LevelClient, WorldsClient {
	/** The revision each level is known to be at, so the plugin's echo of our own answer is ignored. */
	private readonly applied = new Map<string, number>();
	/** The latest snapshot per level, because `endStep` answers with nothing. */
	private readonly latest = new Map<string, LevelSnapshot>();

	private take(raw: LevelSnapshot): LevelSnapshot {
		const snapshot = normaliseSnapshot(raw);
		const held = this.latest.get(snapshot.id);
		if (!held || snapshot.revision >= held.revision) this.latest.set(snapshot.id, snapshot);
		this.applied.set(
			snapshot.id,
			Math.max(this.applied.get(snapshot.id) ?? -1, revisionToWire(snapshot.revision)),
		);
		return snapshot;
	}

	async open(path: string): Promise<LevelSnapshot> {
		return this.take(await openLevel(path));
	}

	async save(id: string): Promise<LevelSnapshot> {
		return this.take(await saveLevel(id));
	}

	async close(id: string): Promise<void> {
		await closeLevel(id);
		this.latest.delete(id);
		this.applied.delete(id);
	}

	async applyEdit(
		id: string,
		edit: LevelEdit,
		basedOn: bigint,
		mergeKey?: string,
	): Promise<LevelSnapshot> {
		return this.take(await applyEdit(id, edit, revisionToWire(basedOn), mergeKey));
	}

	async endStep(id: string): Promise<LevelSnapshot> {
		await endStep(id);
		const held = this.latest.get(id);
		if (!held) throw { kind: 'not_open' };
		return held;
	}

	async undo(id: string, basedOn: bigint): Promise<LevelSnapshot> {
		return this.take(await undo(id, revisionToWire(basedOn)));
	}

	async redo(id: string, basedOn: bigint): Promise<LevelSnapshot> {
		return this.take(await redo(id, revisionToWire(basedOn)));
	}

	async read(id: string): Promise<LevelSnapshot> {
		return this.take(await levelSnapshot(id));
	}

	words(): Promise<WordDoc[]> {
		return languageWords();
	}

	cellLine(id: string, x: number, y: number): Promise<number | null> {
		return levelCellLine(id, x, y);
	}

	ghosts(id: string): Promise<GhostProposal[]> {
		return levelGhosts(id);
	}

	viewMasked(id: string, hidden: string[]): Promise<LevelView> {
		return levelViewMasked(id, hidden);
	}

	async layers(id: string): Promise<string[]> {
		return (await levelLayers(id)).locked;
	}

	async setLayerLocked(id: string, layer: string, locked: boolean): Promise<string[]> {
		return (await setLayerLocked(id, layer, locked)).locked;
	}

	onLayersChanged(listener: (id: string, locked: string[]) => void): () => void {
		return subscribe(() => onLevelLayers((layers) => listener(layers.id, layers.locked)));
	}

	onChanged(listener: (snapshot: LevelSnapshot) => void): () => void {
		return subscribe(() =>
			onLevelChanged((raw) => {
				const snapshot = normaliseSnapshot(raw);
				this.latest.set(snapshot.id, snapshot);
				listener(snapshot);
			}, this.applied),
		);
	}

	onConflict(listener: (conflict: LevelConflict) => void): () => void {
		return levelConflicts(listener);
	}
}
