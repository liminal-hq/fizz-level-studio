// The studio core: the level file, its sidecar state, proposals, direct edits, accept, reject and undo.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Ast } from '../../language/src/ast.ts';
import { appendEdits } from '../../language/src/edits.ts';
import type { Edit } from '../../language/src/edits.ts';
import type { FizzError } from '../../language/src/errors.ts';
import { parse } from '../../language/src/parser.ts';
import { formatNode, print } from '../../language/src/printer.ts';

export type Mode = 'propose' | 'direct';
export type Status = 'pending' | 'accepted' | 'rejected' | 'applied' | 'undone';

export interface HistoryEntry {
	/** `h1`, `h2`, ... in the order entries were created. */
	id: string;
	by: 'claude';
	time: string;
	mode: Mode;
	title: string;
	why?: string;
	/** The lines as the language prints them (normalised), exactly as appended to the file. */
	lines: string[];
	status: Status;
	resolved_at?: string;
	resolved_by?: 'person' | 'claude';
	/** The person's reason when they accepted, rejected or undid it. */
	reason?: string;
	/** The exact lines this entry added to the file, kept so undo removes only them. */
	inserted?: string[];
}

export type Where = { x: number; y: number } | { x0: number; y0: number; x1: number; y1: number };

export interface Note {
	id: string;
	by: 'claude';
	time: string;
	at: Where;
	text: string;
}

export interface SidecarState {
	version: 1;
	mode: Mode;
	nextId: number;
	nextNote: number;
	history: HistoryEntry[];
	notes: Note[];
}

export interface LineProblem {
	/** 1-based index into the lines the caller sent. */
	line: number;
	code: string;
	message: string;
	fix: string;
	text: string;
}

export class StudioError extends Error {
	constructor(
		message: string,
		public readonly problems: LineProblem[] = [],
	) {
		super(message);
	}
}

export function sidecarPath(levelPath: string): string {
	return levelPath.replace(/\.fizz$/, '') + '.studio.json';
}

/** Writes through a temporary file in the same directory, then renames it over the target. */
export function writeAtomic(path: string, text: string): void {
	const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
	try {
		writeFileSync(tmp, text);
		renameSync(tmp, path);
	} catch (e) {
		try {
			unlinkSync(tmp);
		} catch {
			// nothing to clean up
		}
		throw e;
	}
}

function freshState(): SidecarState {
	return { version: 1, mode: 'propose', nextId: 1, nextNote: 1, history: [], notes: [] };
}

export function readState(levelPath: string): SidecarState {
	const p = sidecarPath(levelPath);
	const state = freshState();
	if (!existsSync(p)) return state;
	try {
		const raw = JSON.parse(readFileSync(p, 'utf8'));
		if (raw.mode === 'direct') state.mode = 'direct';
		if (Array.isArray(raw.history)) state.history = raw.history;
		if (Array.isArray(raw.notes)) state.notes = raw.notes;
		if (Number.isInteger(raw.nextId)) state.nextId = raw.nextId;
		if (Number.isInteger(raw.nextNote)) state.nextNote = raw.nextNote;
	} catch {
		// An unreadable sidecar is treated as new, in the safe `propose` mode. It is never overwritten
		// until something is written through the studio.
	}
	return state;
}

export function writeState(levelPath: string, state: SidecarState): void {
	writeAtomic(sidecarPath(levelPath), JSON.stringify(state, null, 2) + '\n');
}

export interface LoadedLevel {
	text: string;
	ast: Ast;
	errors: FizzError[];
}

export function loadLevel(levelPath: string): LoadedLevel {
	const text = readFileSync(levelPath, 'utf8');
	const { ast, errors } = parse(text);
	return { text, ast, errors };
}

const MAX_LINES = 200;

/**
 * Validates proposed `edits` lines with the language parser, before anything is stored. The lines are
 * parsed inside a scratch script that has the real level header, so bounds and word checks are the
 * real ones and the reported line numbers are positions in the lines the caller sent.
 */
export function validateLines(level: LoadedLevel, lines: string[]): { edits: Edit[]; canonical: string[] } {
	if (level.errors.length > 0) {
		throw new StudioError(
			'the level file has parse errors, so nothing can be added until they are fixed',
			level.errors.map((e) => ({ line: 0, code: e.code, message: `level file line ${e.line}: ${e.message}`, fix: e.fix, text: '' })),
		);
	}
	if (lines.length === 0) throw new StudioError('`lines` is empty');
	if (lines.length > MAX_LINES) throw new StudioError(`too many lines (${lines.length}); send at most ${MAX_LINES} per edit`);
	const header = level.ast.nodes.find((n) => n.type === 'level');
	if (!header) throw new StudioError('the level file has no `level` header');
	const problems: LineProblem[] = [];
	lines.forEach((l, i) => {
		if (typeof l !== 'string' || /[\r\n]/.test(l)) {
			problems.push({ line: i + 1, code: 'S001', message: 'each entry in `lines` must be one line of text', fix: 'send one statement per array entry', text: String(l) });
		}
	});
	if (problems.length > 0) throw new StudioError('invalid lines', problems);
	const prefix = [header.raw ?? formatNode(header), 'start 0,0', 'edits'];
	const scratch = [...prefix, ...lines].join('\n');
	const { ast, errors } = parse(scratch);
	for (const e of errors) {
		if (e.line <= prefix.length) continue;
		problems.push({ line: e.line - prefix.length, code: e.code, message: e.message, fix: e.fix, text: lines[e.line - prefix.length - 1] });
	}
	const edits: Edit[] = [];
	ast.nodes.slice(prefix.length).forEach((n, i) => {
		if (problems.some((p) => p.line === i + 1)) return;
		if (n.type === 'paint') edits.push({ op: 'paint', tile: n.tile, xs: n.xs, ys: n.ys });
		else if (n.type === 'clear') edits.push({ op: 'clear', xs: n.xs, ys: n.ys });
		else if (n.type === 'place') edits.push({ op: 'place', kind: n.kind, xs: n.xs, ys: n.ys });
		else {
			problems.push({
				line: i + 1,
				code: 'S002',
				message: 'blank lines and comments cannot be sent; only `paint`, `clear` and `place` lines',
				fix: 'remove this entry, or write a paint, clear or place line',
				text: lines[i],
			});
		}
	});
	if (problems.length > 0) {
		problems.sort((a, b) => a.line - b.line);
		throw new StudioError(`${problems.length} line(s) rejected; nothing was stored`, problems);
	}
	const canonical = edits.map((e) => formatNode(toNode(e)));
	return { edits, canonical };
}

function toNode(e: Edit) {
	const base = { line: 0, raw: null, comment: null };
	if (e.op === 'paint') return { type: 'paint' as const, tile: e.tile, xs: e.xs, ys: e.ys, ...base };
	if (e.op === 'clear') return { type: 'clear' as const, xs: e.xs, ys: e.ys, ...base };
	return { type: 'place' as const, kind: e.kind, xs: e.xs, ys: e.ys, ...base };
}

/** Appends edits with the language helper and returns the new text plus the exact lines it added. */
export function appendToText(level: LoadedLevel, edits: Edit[]): { text: string; inserted: string[] } {
	const next = appendEdits(level.ast, edits);
	const inserted = next.nodes.filter((n) => n.raw === null).map((n) => formatNode(n));
	return { text: print(next), inserted };
}

function nowIso(): string {
	return new Date().toISOString();
}

export class Studio {
	constructor(readonly levelPath: string) {}

	level(): LoadedLevel {
		return loadLevel(this.levelPath);
	}

	state(): SidecarState {
		return readState(this.levelPath);
	}

	private entry(state: SidecarState, id: string): HistoryEntry | undefined {
		return state.history.find((h) => h.id === id);
	}

	/** Claude's write. The mode comes from the sidecar file, never from the caller. */
	edit(input: { lines: string[]; title: string; why?: string }): HistoryEntry {
		const level = this.level();
		const { edits, canonical } = validateLines(level, input.lines);
		const state = this.state();
		const entry: HistoryEntry = {
			id: `h${state.nextId}`,
			by: 'claude',
			time: nowIso(),
			mode: state.mode,
			title: input.title,
			...(input.why ? { why: input.why } : {}),
			lines: canonical,
			status: state.mode === 'direct' ? 'applied' : 'pending',
		};
		state.nextId++;
		if (state.mode === 'direct') {
			const { text, inserted } = appendToText(level, edits);
			entry.inserted = inserted;
			writeAtomic(this.levelPath, text);
		}
		state.history.push(entry);
		writeState(this.levelPath, state);
		return entry;
	}

	private resolveTargets(state: SidecarState, target: string): HistoryEntry[] {
		if (target === 'all') return state.history.filter((h) => h.status === 'pending');
		const e = this.entry(state, target);
		if (!e) throw new StudioError(`no proposal with id ${target}`);
		if (e.status !== 'pending') throw new StudioError(`${target} is ${e.status}, not pending`);
		return [e];
	}

	/** The person's accept. Each proposal is validated again against the file as it is now. */
	accept(target: string, reason?: string): { accepted: string[]; failed: { id: string; problem: string }[] } {
		const state = this.state();
		const targets = this.resolveTargets(state, target);
		const accepted: string[] = [];
		const failed: { id: string; problem: string }[] = [];
		for (const e of targets) {
			try {
				const level = this.level();
				const { edits } = validateLines(level, e.lines);
				const { text, inserted } = appendToText(level, edits);
				writeAtomic(this.levelPath, text);
				e.status = 'accepted';
				e.resolved_at = nowIso();
				e.resolved_by = 'person';
				if (reason) e.reason = reason;
				e.inserted = inserted;
				accepted.push(e.id);
				writeState(this.levelPath, state);
			} catch (err) {
				const detail = err instanceof StudioError && err.problems.length > 0 ? err.problems.map((p) => `${p.code} ${p.message}`).join('; ') : (err as Error).message;
				failed.push({ id: e.id, problem: detail });
			}
		}
		return { accepted, failed };
	}

	reject(target: string, reason?: string): string[] {
		const state = this.state();
		const targets = this.resolveTargets(state, target);
		for (const e of targets) {
			e.status = 'rejected';
			e.resolved_at = nowIso();
			e.resolved_by = 'person';
			if (reason) e.reason = reason;
		}
		writeState(this.levelPath, state);
		return targets.map((t) => t.id);
	}

	/** Reverts Claude's last applied step, or refuses when the file no longer ends with that step's lines. */
	undo(): { undone: string } {
		const state = this.state();
		const applied = state.history.filter((h) => h.status === 'applied');
		const last = applied[applied.length - 1];
		if (!last || !last.inserted) throw new StudioError('nothing to undo: there is no applied step of Claude\'s that has not been undone');
		const text = readFileSync(this.levelPath, 'utf8');
		const lines = text.split('\n');
		const k = last.inserted.length;
		let at = -1;
		for (let i = lines.length - k; i >= 0; i--) {
			if (lines.slice(i, i + k).every((l, j) => l === last.inserted![j]) && lines.slice(i + k).every((l) => l.trim() === '')) {
				at = i;
				break;
			}
		}
		if (at < 0) {
			throw new StudioError(
				`cannot undo ${last.id} (${last.title}): the file has been edited after it in a way that conflicts, because its lines are no longer the last statements in the file. Nothing was changed. Undo it by hand, or ask the person.`,
			);
		}
		lines.splice(at, k);
		writeAtomic(this.levelPath, lines.join('\n'));
		last.status = 'undone';
		last.resolved_at = nowIso();
		last.resolved_by = 'claude';
		writeState(this.levelPath, state);
		return { undone: last.id };
	}

	setMode(mode: Mode): void {
		const state = this.state();
		state.mode = mode;
		writeState(this.levelPath, state);
	}

	addNote(at: Where, text: string): Note {
		const state = this.state();
		const note: Note = { id: `n${state.nextNote}`, by: 'claude', time: nowIso(), at, text };
		state.nextNote++;
		state.notes.push(note);
		writeState(this.levelPath, state);
		return note;
	}
}
