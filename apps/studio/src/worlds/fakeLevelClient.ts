// An in-memory LevelClient for tests and development: it applies paint, clear and place edits
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { LevelClient } from './levelClient';

interface HistoryEntry {
	/** The snapshot to return to, and the step's name, as the real history names it. */
	before: LevelSnapshot;
	name: string;
}

function rangeText(ranges: Array<[number, number]>): string {
	return ranges.map(([from, to]) => (from === to ? `${from}` : `${from}..${to}`)).join(',');
}

function editLine(edit: LevelEdit): string {
	const where = `x=${rangeText(edit.x)} y=${rangeText(edit.y)}`;
	if (edit.kind === 'paint') return `paint ${edit.tile} ${where}`;
	if (edit.kind === 'clear') return `clear ${where}`;
	return `place ${edit.item} ${where}`;
}

function editName(edit: LevelEdit): string {
	if (edit.kind === 'paint') return `Paint ${edit.tile}`;
	if (edit.kind === 'clear') return 'Clear';
	return `Place ${edit.item}`;
}

function cloneSnapshot(snapshot: LevelSnapshot): LevelSnapshot {
	return {
		...snapshot,
		view: {
			...snapshot.view,
			palette: [...snapshot.view.palette],
			cells: [...snapshot.view.cells],
			items: snapshot.view.items.map((item) => ({ ...item })),
		},
	};
}

/**
 * Holds one `LevelSnapshot` and applies edits to its `view.cells` and `items`, bumping `revision`
 * on every change. Undo and redo swap whole snapshots (with a fresh revision), and a command based
 * on any revision but the current one is refused with a `stale` `LevelError`.
 */
export class FakeLevelClient implements LevelClient {
	private current: LevelSnapshot;
	private undoStack: HistoryEntry[] = [];
	private redoStack: HistoryEntry[] = [];
	private openKey: string | null = null;
	private listeners = new Set<(snapshot: LevelSnapshot) => void>();

	/** Every call `applyEdit` has had, in order, for tests to inspect. */
	readonly applied: Array<{ edit: LevelEdit; basedOn: bigint; mergeKey?: string }> = [];

	constructor(initial: LevelSnapshot) {
		this.current = cloneSnapshot(initial);
	}

	/** The snapshot as it stands now. */
	snapshot(): LevelSnapshot {
		return cloneSnapshot(this.current);
	}

	/** Pushes a snapshot to every `onChanged` listener, as the backend does for outside changes. */
	emit(snapshot: LevelSnapshot = this.current): void {
		for (const listener of this.listeners) listener(cloneSnapshot(snapshot));
	}

	async applyEdit(
		id: string,
		edit: LevelEdit,
		basedOn: bigint,
		mergeKey?: string,
	): Promise<LevelSnapshot> {
		this.check(id, basedOn);
		this.applied.push({ edit, basedOn, mergeKey });
		const joins = mergeKey !== undefined && this.openKey === mergeKey && this.undoStack.length > 0;
		const before = this.current;
		const next = cloneSnapshot(before);
		this.apply(next, edit);
		next.revision = before.revision + 1n;
		next.text = `${before.text.replace(/\n?$/, '\n')}${editLine(edit)}\n`;
		next.author = 'person';
		next.can_redo = false;
		next.redo_name = null;
		if (!joins) this.undoStack.push({ before, name: editName(edit) });
		this.redoStack = [];
		this.openKey = mergeKey ?? null;
		return this.settle(next);
	}

	async endStep(id: string): Promise<LevelSnapshot> {
		this.check(id);
		this.openKey = null;
		return this.snapshot();
	}

	async undo(id: string, basedOn: bigint): Promise<LevelSnapshot> {
		this.check(id, basedOn);
		this.openKey = null;
		const entry = this.undoStack.pop();
		if (!entry) return this.snapshot();
		this.redoStack.push({ before: this.current, name: entry.name });
		const next = cloneSnapshot(entry.before);
		next.revision = this.current.revision + 1n;
		return this.settle(next);
	}

	async redo(id: string, basedOn: bigint): Promise<LevelSnapshot> {
		this.check(id, basedOn);
		this.openKey = null;
		const entry = this.redoStack.pop();
		if (!entry) return this.snapshot();
		this.undoStack.push({ before: this.current, name: entry.name });
		const next = cloneSnapshot(entry.before);
		next.revision = this.current.revision + 1n;
		return this.settle(next);
	}

	onChanged(listener: (snapshot: LevelSnapshot) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private check(id: string, basedOn?: bigint): void {
		if (id !== this.current.id) throw { kind: 'not_open', id };
		if (basedOn !== undefined && basedOn !== this.current.revision) {
			throw { kind: 'stale', based_on: basedOn, current: this.current.revision };
		}
	}

	private settle(next: LevelSnapshot): LevelSnapshot {
		const top = this.undoStack[this.undoStack.length - 1];
		const redoTop = this.redoStack[this.redoStack.length - 1];
		next.can_undo = top !== undefined;
		next.undo_name = top?.name ?? null;
		next.can_redo = redoTop !== undefined;
		next.redo_name = redoTop?.name ?? null;
		this.current = next;
		return this.snapshot();
	}

	private apply(snapshot: LevelSnapshot, edit: LevelEdit): void {
		const { view } = snapshot;
		const columns = edit.x.flatMap(([from, to]) => span(from, to));
		const rows = edit.y.flatMap(([from, to]) => span(from, to));
		const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < view.width && y < view.height;
		if (edit.kind === 'place') {
			for (const y of rows) {
				for (const x of columns) {
					if (inside(x, y)) view.items.push({ kind: edit.item, x, y });
				}
			}
			return;
		}
		const word = edit.kind === 'paint' ? edit.tile : 'empty';
		let index = view.palette.indexOf(word);
		if (index < 0) {
			view.palette.push(word);
			index = view.palette.length - 1;
		}
		for (const y of rows) {
			for (const x of columns) {
				if (inside(x, y)) view.cells[y * view.width + x] = index;
			}
		}
	}
}

function span(from: number, to: number): number[] {
	const out: number[] = [];
	for (let n = Math.min(from, to); n <= Math.max(from, to); n++) out.push(n);
	return out;
}
