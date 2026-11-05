// Turning the cells of a stroke into the fewest edits: blocks, spaced item cells, and item runs
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import { MAX_SPACING } from './brush';
import type { Cell } from './tool';

export interface Block {
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

/** The cells of a path with each cell once, in the order it was first visited. */
export function visitedOnce(path: readonly Cell[]): Cell[] {
	const seen = new Set<string>();
	const out: Cell[] = [];
	for (const cell of path) {
		const key = `${cell.x},${cell.y}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(cell);
	}
	return out;
}

/**
 * The cells an item stroke drops items on: the first visited cell, then every `step`th one after
 * it. The canvas draws these as ghosts, and `itemEdits` writes exactly these.
 */
export function spacedCells(path: readonly Cell[], step: number): Cell[] {
	const gap = Math.max(1, Math.floor(step));
	return visitedOnce(path).filter((_, index) => index % gap === 0);
}

/**
 * Items on `cells` as edits: along each row, cells an equal step apart become one
 * `row ITEM x=a..b y=r [by=n]` line (a step is at most `MAX_SPACING`); the rest are placed one by
 * one in as few `place` lines as the cross product allows.
 */
export function itemEdits(item: string, cells: readonly Cell[]): LevelEdit[] {
	const rows = new Map<number, number[]>();
	for (const { x, y } of cells) rows.set(y, [...(rows.get(y) ?? []), x]);
	const edits: LevelEdit[] = [];
	const singles: Cell[] = [];
	for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
		const sorted = [...new Set(xs)].sort((a, b) => a - b);
		let i = 0;
		while (i < sorted.length) {
			const from = sorted[i] ?? 0;
			const next = sorted[i + 1];
			const by = next === undefined ? 0 : next - from;
			if (by < 1 || by > MAX_SPACING) {
				singles.push({ x: from, y });
				i += 1;
				continue;
			}
			let j = i + 1;
			while (sorted[j + 1] !== undefined && (sorted[j + 1] ?? 0) - (sorted[j] ?? 0) === by) j += 1;
			edits.push({ kind: 'row', item, x: [from, sorted[j] ?? from], y, by });
			i = j + 1;
		}
	}
	for (const block of coalesce(singles)) {
		edits.push({ kind: 'place', item, x: block.x, y: [block.y] });
	}
	return edits;
}

/** An enemy goes on the cell that was pressed, one per click. */
export function enemyEdit(enemy: string, cell: Cell): LevelEdit {
	return { kind: 'spawn', enemy, x: cell.x, y: cell.y };
}
