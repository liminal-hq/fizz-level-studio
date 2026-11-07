// An in-memory LevelClient for tests and development: it applies paint, clear and place edits
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelError } from '@liminal-hq/fizz-studio-protocol/generated/LevelError';
import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
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
	if (edit.kind === 'row') {
		const by = edit.by > 1 ? ` by=${edit.by}` : '';
		return `row ${edit.item} x=${edit.x[0]}..${edit.x[1]} y=${edit.y}${by}`;
	}
	if (edit.kind === 'spawn') return `${edit.enemy} x=${edit.x} y=${edit.y}`;
	const where = `x=${rangeText(edit.x)} y=${rangeText(edit.y)}`;
	if (edit.kind === 'paint') return `paint ${edit.tile} ${where}`;
	if (edit.kind === 'clear') return `clear ${where}`;
	return `place ${edit.item} ${where}`;
}

function editName(edit: LevelEdit): string {
	if (edit.kind === 'row') {
		return `Place ${Math.floor((edit.x[1] - edit.x[0]) / Math.max(edit.by, 1)) + 1} ${edit.item}`;
	}
	if (edit.kind === 'spawn') return `Place ${edit.enemy}`;
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
			spawns: snapshot.view.spawns.map((spawn) => ({ ...spawn })),
			markers: snapshot.view.markers.map((marker) => ({ ...marker })),
			cell_sections: [...snapshot.view.cell_sections],
			sections: snapshot.view.sections.map((section) => ({
				...section,
				lines: section.lines.map((run) => [...run] as [number, number]),
			})),
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

	/** What `words()` answers; a test sets it. */
	wordDocs: WordDoc[] = [];
	/** The line `cellLine()` answers for a cell, keyed `x,y`; a test sets them. */
	readonly cellLines = new Map<string, number>();
	/** The refusal every `applyEdit` throws while a test has set it, such as a `locked` error. */
	refuseEdits: LevelError | null = null;
	/** The locked layers; a test may set them, and `setLayerLocked` changes them. */
	locked: string[] = [];
	private layerListeners = new Set<(id: string, locked: string[]) => void>();
	/** What `ghosts()` answers; a test sets it. */
	ghostProposals: GhostProposal[] = [];

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
		if (this.refuseEdits) throw this.refuseEdits;
		this.applied.push({ edit, basedOn, mergeKey });
		const joins = mergeKey !== undefined && this.openKey === mergeKey && this.undoStack.length > 0;
		const before = this.current;
		const next = cloneSnapshot(before);
		next.text = `${before.text.replace(/\n?$/, '\n')}${editLine(edit)}\n`;
		// The edit's line is the last one, before the text's final newline.
		this.apply(next, edit, next.text.split('\n').length - 1);
		next.revision = before.revision + 1n;
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

	async read(id: string): Promise<LevelSnapshot> {
		this.check(id);
		return this.snapshot();
	}

	async cellLine(id: string, x: number, y: number): Promise<number | null> {
		this.check(id);
		return this.cellLines.get(`${x},${y}`) ?? null;
	}

	async words(): Promise<WordDoc[]> {
		return this.wordDocs.map((doc) => ({ ...doc }));
	}

	async ghosts(id: string): Promise<GhostProposal[]> {
		this.check(id);
		return this.ghostProposals.map((proposal) => ({ ...proposal }));
	}

	/** Every `viewMasked` call, for tests to inspect. */
	readonly masked: Array<{ id: string; hidden: string[] }> = [];

	/** Answers the view with every cell empty when anything is hidden, so a test can tell it apart. */
	async viewMasked(id: string, hidden: string[]): Promise<LevelView> {
		this.check(id);
		this.masked.push({ id, hidden: [...hidden] });
		const view = this.snapshot().view;
		return hidden.length === 0 ? view : { ...view, cells: view.cells.map(() => 0) };
	}

	async layers(id: string): Promise<string[]> {
		this.check(id);
		return [...this.locked];
	}

	async setLayerLocked(id: string, layer: string, locked: boolean): Promise<string[]> {
		this.check(id);
		this.locked = this.locked.filter((held) => held !== layer);
		if (locked) this.locked.push(layer);
		for (const listener of this.layerListeners) listener(id, [...this.locked]);
		return [...this.locked];
	}

	onLayersChanged(listener: (id: string, locked: string[]) => void): () => void {
		this.layerListeners.add(listener);
		return () => {
			this.layerListeners.delete(listener);
		};
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

	private apply(snapshot: LevelSnapshot, edit: LevelEdit, line: number): void {
		const { view } = snapshot;
		if (edit.kind === 'row') {
			for (let x = edit.x[0]; x <= edit.x[1]; x += Math.max(edit.by, 1)) {
				if (x >= 0 && x < view.width && edit.y < view.height) {
					view.items.push({ kind: edit.item, x, y: edit.y, line });
				}
			}
			return;
		}
		if (edit.kind === 'spawn') {
			view.spawns.push({
				kind: edit.enemy,
				x: edit.x,
				y: edit.y,
				dir: null,
				ride: false,
				line,
			});
			return;
		}
		const columns = edit.x.flatMap(([from, to]) => span(from, to));
		const rows = edit.y.flatMap(([from, to]) => span(from, to));
		const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < view.width && y < view.height;
		if (edit.kind === 'place') {
			for (const y of rows) {
				for (const x of columns) {
					if (inside(x, y)) view.items.push({ kind: edit.item, x, y, line });
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
