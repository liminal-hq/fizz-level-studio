// The editing tools as pure functions from pointer events and the level view to level edits
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { restingRow } from '../canvas/drawLevel';
import type { Brush } from './brush';
import { pasteEdits, type Clip } from './clip';
import { coalesce, enemyEdit, itemEdits, spacedCells } from './runs';

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

/** What a tool reads: the level as drawn, the brush, the item spacing and the copied area. */
export interface ToolContext {
	view: LevelView;
	brush: Brush;
	/** Item brushes drop one item in every `spacing` visited cells. */
	spacing: number;
	/** What Stamp pastes; `null` until an area has been copied. */
	clip: Clip | null;
}

export interface ToolResult {
	state: ToolState;
	/** Edits to send now. They form one stroke group: one merge key, then `endStep`. */
	edits: LevelEdit[];
	/** The brush Pick read (a tile, an item or an enemy), if it read one. */
	pick: Brush | null;
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
		// An enemy is placed by one click; dragging does not spray them.
		if (kind === 'paint' && context.brush.group === 'enemy') {
			if (phase !== 'down' || !inside) return { state, edits: [], pick: null };
			return { state, edits: [enemyEdit(context.brush.kind, cell)], pick: null };
		}
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
		let edits: LevelEdit[];
		if (kind === 'clear') {
			edits = pathEdits(path, (x, y) => ({ kind: 'clear', x, y }));
		} else if (context.brush.group === 'item') {
			edits = itemEdits(context.brush.kind, spacedCells(path, context.spacing));
		} else {
			const tile = context.brush.kind;
			edits = pathEdits(path, (x, y) => ({ kind: 'paint', tile, x, y }));
		}
		return { state: { ...state, active: false, path: [] }, edits, pick: null };
	};
}

/** What lies on a cell, topmost first: an item, an enemy, then the tile. */
function brushAt(view: LevelView, cell: Cell): Brush | null {
	if (!inBounds(view, cell)) return null;
	const item = view.items.find((i) => Math.floor(i.x) === cell.x && Math.floor(i.y) === cell.y);
	if (item) return { group: 'item', kind: item.kind };
	const spawn = view.spawns.find(
		(s) => Math.floor(s.x) === cell.x && Math.floor(s.y ?? restingRow(view, cell.x)) === cell.y,
	);
	if (spawn) return { group: 'enemy', kind: spawn.kind };
	const word = view.palette[view.cells[cell.y * view.width + cell.x] ?? 0];
	return word === undefined ? null : { group: 'tile', kind: word };
}

function pick(state: ToolState, phase: PointerPhase, cell: Cell, context: ToolContext): ToolResult {
	const active = phase !== 'up' && (phase === 'down' || state.active);
	return {
		state: { ...state, active },
		edits: [],
		pick: active ? brushAt(context.view, cell) : null,
	};
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

/** Pastes the copied area with its top-left cell on the pressed cell, as one stroke. */
function stamp(
	state: ToolState,
	phase: PointerPhase,
	cell: Cell,
	context: ToolContext,
): ToolResult {
	if (phase !== 'down' || !context.clip || !inBounds(context.view, cell)) {
		return { state, edits: [], pick: null };
	}
	return { state, edits: pasteEdits(context.view, context.clip, cell), pick: null };
}

const paintTool = strokeTool('paint');
const eraseTool = strokeTool('clear');

/**
 * One pointer event for one tool. The result carries the next state, the edits to send now (a
 * paint or erase stroke sends its edits when the pointer is released; a stamp sends on press),
 * and the brush Pick read. It never touches the canvas or the backend.
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
