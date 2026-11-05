// The editing tools as pure functions from pointer events and the level view to level edits
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';

export type ToolId = 'paint' | 'erase' | 'pick' | 'select' | 'stamp';

/** Every tool, in the order the palette lists them. */
export const TOOL_IDS: readonly ToolId[] = ['paint', 'erase', 'pick', 'select', 'stamp'];

/** A cell, counted from the bottom-left corner (`y` grows upward). */
export interface Cell {
	x: number;
	y: number;
}

/** An inclusive rectangle of cells with `x0 <= x1` and `y0 <= y1`. */
export interface Rect {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export type PointerPhase = 'down' | 'move' | 'up';

/** What a tool remembers between the events of one gesture. */
export interface ToolState {
	/** True between `down` and `up`. */
	active: boolean;
	/** The cells a paint or erase drag has visited, in order. */
	path: Cell[];
	/** Where a select drag began. */
	anchor: Cell | null;
	/** The rectangle Select outlines; kept after the drag ends. */
	selection: Rect | null;
}

/** What a tool reads: the level as drawn, and what the person has chosen to place. */
export interface ToolContext {
	view: LevelView;
	tile: string;
	item: string;
}

export interface ToolResult {
	state: ToolState;
	/** Edits to send now. They form one stroke group: one merge key, then `endStep`. */
	edits: LevelEdit[];
	/** The tile word Pick read, if it read one. */
	pick: string | null;
}

export const initialToolState: ToolState = {
	active: false,
	path: [],
	anchor: null,
	selection: null,
};

export function inBounds(view: LevelView, cell: Cell): boolean {
	return cell.x >= 0 && cell.y >= 0 && cell.x < view.width && cell.y < view.height;
}

/** The cells on the straight line from `from` to `to`, both included (Bresenham). */
export function lineCells(from: Cell, to: Cell): Cell[] {
	const cells: Cell[] = [];
	let { x, y } = from;
	const dx = Math.abs(to.x - x);
	const dy = -Math.abs(to.y - y);
	const sx = x < to.x ? 1 : -1;
	const sy = y < to.y ? 1 : -1;
	let error = dx + dy;
	for (;;) {
		cells.push({ x, y });
		if (x === to.x && y === to.y) return cells;
		const doubled = 2 * error;
		if (doubled >= dy) {
			error += dy;
			x += sx;
		}
		if (doubled <= dx) {
			error += dx;
			y += sy;
		}
	}
}

export function rectOf(a: Cell, b: Cell): Rect {
	return {
		x0: Math.min(a.x, b.x),
		y0: Math.min(a.y, b.y),
		x1: Math.max(a.x, b.x),
		y1: Math.max(a.y, b.y),
	};
}

interface Block {
	x: Array<[number, number]>;
	y: [number, number];
}

/**
 * Folds a set of cells into as few `x` by `y` blocks as the language's cross product allows. Runs
 * along a row become one range; rows with the same run and neighbouring `y` become one `y` range;
 * blocks with the same `y` range share one edit with several `x` ranges. A horizontal drag is one
 * range, and a drag that paints a filled rectangle is one block.
 */
export function coalesce(cells: readonly Cell[]): Block[] {
	const rows = new Map<number, Set<number>>();
	for (const { x, y } of cells) {
		const row = rows.get(y) ?? new Set<number>();
		row.add(x);
		rows.set(y, row);
	}
	// Runs per row, keyed by their x range so equal runs on neighbouring rows can join.
	const runs = new Map<string, { x0: number; x1: number; ys: number[] }>();
	for (const [y, xs] of rows) {
		const sorted = [...xs].sort((a, b) => a - b);
		let start = sorted[0];
		let previous = sorted[0];
		const close = () => {
			if (start === undefined || previous === undefined) return;
			const key = `${start}:${previous}`;
			const run = runs.get(key) ?? { x0: start, x1: previous, ys: [] };
			run.ys.push(y);
			runs.set(key, run);
		};
		for (const x of sorted.slice(1)) {
			if (x === (previous ?? x) + 1) {
				previous = x;
				continue;
			}
			close();
			start = x;
			previous = x;
		}
		close();
	}
	const rectangles: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
	for (const run of runs.values()) {
		const ys = [...run.ys].sort((a, b) => a - b);
		let y0 = ys[0];
		let y1 = ys[0];
		for (const y of ys.slice(1)) {
			if (y === (y1 ?? y) + 1) {
				y1 = y;
				continue;
			}
			if (y0 !== undefined && y1 !== undefined) {
				rectangles.push({ x0: run.x0, x1: run.x1, y0, y1 });
			}
			y0 = y;
			y1 = y;
		}
		if (y0 !== undefined && y1 !== undefined) {
			rectangles.push({ x0: run.x0, x1: run.x1, y0, y1 });
		}
	}
	const blocks = new Map<string, Block>();
	for (const r of rectangles.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
		const key = `${r.y0}:${r.y1}`;
		const block = blocks.get(key) ?? { x: [], y: [r.y0, r.y1] as [number, number] };
		block.x.push([r.x0, r.x1]);
		blocks.set(key, block);
	}
	return [...blocks.values()];
}

/** Turns a visited path into the `LevelEdit`s that paint, clear or place on it. */
export function pathEdits(
	path: readonly Cell[],
	make: (x: Array<[number, number]>, y: Array<[number, number]>) => LevelEdit,
): LevelEdit[] {
	return coalesce(path).map((block) => make(block.x, [block.y]));
}

function strokeTool(
	kind: 'paint' | 'clear',
): (state: ToolState, phase: PointerPhase, cell: Cell, context: ToolContext) => ToolResult {
	return (state, phase, cell, context) => {
		const inside = inBounds(context.view, cell);
		if (phase === 'down') {
			return {
				state: { ...state, active: true, path: inside ? [cell] : [] },
				edits: [],
				pick: null,
			};
		}
		if (!state.active) return { state, edits: [], pick: null };
		const last = state.path[state.path.length - 1];
		const added = last ? lineCells(last, cell).slice(1) : inside ? [cell] : [];
		const path = [...state.path, ...added.filter((c) => inBounds(context.view, c))];
		if (phase === 'move') return { state: { ...state, path }, edits: [], pick: null };
		const edits =
			kind === 'paint'
				? pathEdits(path, (x, y) => ({ kind: 'paint', tile: context.tile, x, y }))
				: pathEdits(path, (x, y) => ({ kind: 'clear', x, y }));
		return { state: { ...state, active: false, path: [] }, edits, pick: null };
	};
}

function pick(state: ToolState, phase: PointerPhase, cell: Cell, context: ToolContext): ToolResult {
	const active = phase !== 'up' && (phase === 'down' || state.active);
	const index = cell.y * context.view.width + cell.x;
	const word =
		active && inBounds(context.view, cell)
			? (context.view.palette[context.view.cells[index] ?? 0] ?? null)
			: null;
	return { state: { ...state, active }, edits: [], pick: word };
}

function select(
	state: ToolState,
	phase: PointerPhase,
	cell: Cell,
	context: ToolContext,
): ToolResult {
	const clamped = {
		x: Math.min(Math.max(cell.x, 0), context.view.width - 1),
		y: Math.min(Math.max(cell.y, 0), context.view.height - 1),
	};
	if (phase === 'down') {
		return {
			state: { ...state, active: true, anchor: clamped, selection: rectOf(clamped, clamped) },
			edits: [],
			pick: null,
		};
	}
	if (!state.active || !state.anchor) return { state, edits: [], pick: null };
	const selection = rectOf(state.anchor, clamped);
	return {
		state: { ...state, active: phase === 'move', selection },
		edits: [],
		pick: null,
	};
}

function stamp(
	state: ToolState,
	phase: PointerPhase,
	cell: Cell,
	context: ToolContext,
): ToolResult {
	if (phase !== 'down' || !inBounds(context.view, cell)) {
		return { state, edits: [], pick: null };
	}
	return {
		state,
		edits: [{ kind: 'place', item: context.item, x: [[cell.x, cell.x]], y: [[cell.y, cell.y]] }],
		pick: null,
	};
}

const paintTool = strokeTool('paint');
const eraseTool = strokeTool('clear');

/**
 * One pointer event for one tool. The result carries the next state, the edits to send now (a
 * paint or erase stroke sends its edits when the pointer is released; a stamp sends on press),
 * and the tile Pick read. It never touches the canvas or the backend.
 */
export function reduceTool(
	tool: ToolId,
	state: ToolState,
	phase: PointerPhase,
	cell: Cell,
	context: ToolContext,
): ToolResult {
	switch (tool) {
		case 'paint':
			return paintTool(state, phase, cell, context);
		case 'erase':
			return eraseTool(state, phase, cell, context);
		case 'pick':
			return pick(state, phase, cell, context);
		case 'select':
			return select(state, phase, cell, context);
		case 'stamp':
			return stamp(state, phase, cell, context);
	}
}
