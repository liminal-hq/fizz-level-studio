// Typed guest-side functions for the fizz-studio-worlds plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelError } from '@liminal-hq/fizz-studio-protocol/generated/LevelError';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { NewLevelRequest } from '@liminal-hq/fizz-studio-protocol/generated/NewLevelRequest';
import type { ProjectInfo } from '@liminal-hq/fizz-studio-protocol/generated/ProjectInfo';
import type { RecoveryEntry } from '@liminal-hq/fizz-studio-protocol/generated/RecoveryEntry';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';

const PREFIX = 'plugin:fizz-studio-worlds|';

/** Sent to every window after every change to an open level; the payload is a `LevelSnapshot`. */
export const LEVEL_CHANGED_EVENT = 'level://changed';

/** Sent to every window when an outside edit collides with unsaved changes; the payload is a `LevelConflict`. */
export const LEVEL_CONFLICT_EVENT = 'level://conflict';

/** A file changed outside the studio on the same lines as unsaved changes. The session is unchanged. */
export interface LevelConflict {
	/** The level whose file changed. */
	id: string;
	/** The text with conflict markers where both sides changed the same lines. */
	marked: string;
}

function cmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
	return invoke<T>(`${PREFIX}${name}`, args);
}

/** Opens a folder and lists its level files. */
export function openProject(path: string): Promise<ProjectInfo> {
	return cmd<ProjectInfo>('project_open', { path });
}

/** Opens a level file as a session this app is the writer of, and starts watching its folder. */
export function openLevel(path: string): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('level_open', { path });
}

/**
 * Makes a new level and opens it. A Fizz 1 level is the file `<folder>/<id>.fizz`; a Fizz 2 level
 * is a world project `<folder>/<id>/`. The target is fixed here. An existing file or folder rejects
 * with a `LevelError` of kind `invalid`, and nothing is written.
 */
export function createLevel(request: NewLevelRequest): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('level_create', { request });
}

/**
 * Appends an edit, provided `basedOn` is the revision of the snapshot the caller drew. A stale
 * revision rejects with a `LevelError` of kind `stale` carrying both revisions, and nothing changes.
 * Edits that follow each other with the same `mergeKey` undo as one step until `endStep`.
 */
export function applyEdit(
	id: string,
	edit: LevelEdit,
	basedOn: number,
	mergeKey?: string,
): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('level_apply', { id, edit, basedOn, mergeKey: mergeKey ?? null });
}

/** Ends the stroke in progress, so the next edit starts a new step. */
export function endStep(id: string): Promise<void> {
	return cmd<void>('level_end_step', { id });
}

/** Undoes the last step, provided `basedOn` is the revision the caller drew. */
export function undo(id: string, basedOn: number): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('level_undo', { id, basedOn });
}

/** Redoes the last undone step, provided `basedOn` is the revision the caller drew. */
export function redo(id: string, basedOn: number): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('level_redo', { id, basedOn });
}

/** Writes the level to its file atomically. */
export function saveLevel(id: string): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('level_save', { id });
}

/** Closes the level and stops watching its folder. Unsaved changes are dropped. */
export function closeLevel(id: string): Promise<void> {
	return cmd<void>('level_close', { id });
}

/** The recovery copies a session that did not close cleanly left behind, for levels not open now. */
export function listRecovery(): Promise<RecoveryEntry[]> {
	return cmd<RecoveryEntry[]>('recovery_list');
}

/**
 * Opens the level a recovery copy is of with the recovered text as unsaved changes (author
 * `recovered`). The copy is kept until the level is saved or closed.
 */
export function restoreRecovery(id: string): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('recovery_restore', { id });
}

/** Deletes a recovery copy. */
export function discardRecovery(id: string): Promise<void> {
	return cmd<void>('recovery_discard', { id });
}

/**
 * The words a level script can use, documented, from the language in Rust. The Palette lists the
 * tiles, items and enemies among them, and the Script panel's completion offers all of them.
 */
export function languageWords(): Promise<WordDoc[]> {
	return cmd<WordDoc[]>('language_words');
}

/**
 * The script line (counted from 1) of the last statement that changed the cell `x`, `y` of an open
 * level, or `null` when no statement did.
 */
export function levelCellLine(id: string, x: number, y: number): Promise<number | null> {
	return cmd<number | null>('level_cell_line', { id, x, y });
}

/**
 * The changes Claude proposed for an open level that the person has not yet accepted or rejected,
 * read from the level's `<level>.studio.json` sidecar and spread into cells. Read-only.
 */
export function levelGhosts(id: string): Promise<GhostProposal[]> {
	return cmd<GhostProposal[]>('level_ghosts', { id });
}

/**
 * The current snapshot of an open level, for a window that did not open it, such as a panel torn
 * off into a window of its own. Rejects with a `LevelError` of kind `not_open` for an unknown id.
 */
export function levelSnapshot(id: string): Promise<LevelSnapshot> {
	return cmd<LevelSnapshot>('level_snapshot', { id });
}

/**
 * Wraps `listener` so it hears only snapshots newer than what it has applied for that level.
 * Events can arrive out of order or twice (a window's own edit comes back as an event), and a
 * revision at or below the one already applied for the same level id is older news: it is ignored.
 * `applied` maps a level id to the revision the window already shows, normally from the
 * `openLevel` or `applyEdit` answer; the wrapper keeps it up to date as snapshots arrive, and the
 * caller may set an entry when it applies an answer itself.
 */
export function newerOnly(
	applied: Map<string, number>,
	listener: (snapshot: LevelSnapshot) => void,
): (snapshot: LevelSnapshot) => void {
	return (snapshot) => {
		const revision = Number(snapshot.revision);
		const latest = applied.get(snapshot.id);
		if (latest !== undefined && revision <= latest) {
			return;
		}
		applied.set(snapshot.id, revision);
		listener(snapshot);
	};
}

/** Hears every change to every open level, applying the revision rule of `newerOnly`. */
export function onLevelChanged(
	listener: (snapshot: LevelSnapshot) => void,
	applied: Map<string, number> = new Map(),
): Promise<UnlistenFn> {
	const hear = newerOnly(applied, listener);
	return listen<LevelSnapshot>(LEVEL_CHANGED_EVENT, (event) => hear(event.payload));
}

/** Hears when an outside edit cannot be merged with unsaved changes. */
export function onLevelConflict(listener: (conflict: LevelConflict) => void): Promise<UnlistenFn> {
	return listen<LevelConflict>(LEVEL_CONFLICT_EVENT, (event) => listener(event.payload));
}

export type {
	GhostProposal,
	LevelEdit,
	LevelError,
	LevelSnapshot,
	NewLevelRequest,
	ProjectInfo,
	RecoveryEntry,
	WordDoc,
};
