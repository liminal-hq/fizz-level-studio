// Copy and paste of a rectangle of the level: what the Stamp tool carries, and the edits that paste it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { restingRow } from '../canvas/drawLevel';
import { coalesce, enemyEdit, itemEdits } from './runs';
import type { Cell, Rect } from './tool';

/** A thing in a clip, at an offset from the clip's bottom-left cell. */
export interface ClipThing {
	kind: string;
	dx: number;
	dy: number;
}

/** What was inside a selected rectangle: its tiles, items and enemies. */
export interface Clip {
	width: number;
	height: number;
	/** The tile word of each cell, `dy * width + dx`, row 0 at the bottom. */
	tiles: string[];
	items: ClipThing[];
	enemies: ClipThing[];
}

/** Copies the tiles, items and enemies inside `rect` (inclusive). */
export function copyArea(view: LevelView, rect: Rect): Clip {
	const width = rect.x1 - rect.x0 + 1;
	const height = rect.y1 - rect.y0 + 1;
	const tiles: string[] = [];
	for (let y = rect.y0; y <= rect.y1; y++) {
		for (let x = rect.x0; x <= rect.x1; x++) {
			tiles.push(view.palette[view.cells[y * view.width + x] ?? 0] ?? 'empty');
		}
	}
	const inside = (x: number, y: number) =>
		x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
	const items: ClipThing[] = [];
	for (const item of view.items) {
		const x = Math.floor(item.x);
		const y = Math.floor(item.y);
		if (inside(x, y)) items.push({ kind: item.kind, dx: x - rect.x0, dy: y - rect.y0 });
	}
	const enemies: ClipThing[] = [];
	for (const spawn of view.spawns) {
		const x = Math.floor(spawn.x);
		const y = Math.floor(spawn.y ?? restingRow(view, x));
		if (inside(x, y)) enemies.push({ kind: spawn.kind, dx: x - rect.x0, dy: y - rect.y0 });
	}
	return { width, height, tiles, items, enemies };
}

/** The rectangle a paste with its top-left cell at `at` covers (it may run past the level). */
export function pasteRect(clip: Clip, at: Cell): Rect {
	const y0 = at.y - (clip.height - 1);
	return { x0: at.x, y0, x1: at.x + clip.width - 1, y1: at.y };
}

/**
 * The edits that paste `clip` with its top-left cell on `at`, as the spec has it. Empty cells are left alone, so a
 * paste lays the clip's shapes over what is there; cells outside the level are dropped. Tiles come
 * first, one `paint` per tile word, then items (as `row` and `place` lines), then enemies.
 */
export function pasteEdits(view: LevelView, clip: Clip, at: Cell): LevelEdit[] {
	const inside = (cell: Cell) =>
		cell.x >= 0 && cell.y >= 0 && cell.x < view.width && cell.y < view.height;
	const base = { x: at.x, y: at.y - (clip.height - 1) };
	const byTile = new Map<string, Cell[]>();
	clip.tiles.forEach((word, index) => {
		if (word === 'empty') return;
		const cell = { x: base.x + (index % clip.width), y: base.y + Math.floor(index / clip.width) };
		if (!inside(cell)) return;
		byTile.set(word, [...(byTile.get(word) ?? []), cell]);
	});
	const edits: LevelEdit[] = [];
	for (const [tile, cells] of byTile) {
		for (const block of coalesce(cells)) {
			edits.push({ kind: 'paint', tile, x: block.x, y: [block.y] });
		}
	}
	const byItem = new Map<string, Cell[]>();
	for (const item of clip.items) {
		const cell = { x: base.x + item.dx, y: base.y + item.dy };
		if (inside(cell)) byItem.set(item.kind, [...(byItem.get(item.kind) ?? []), cell]);
	}
	for (const [kind, cells] of byItem) edits.push(...itemEdits(kind, cells));
	for (const enemy of clip.enemies) {
		const cell = { x: base.x + enemy.dx, y: base.y + enemy.dy };
		if (inside(cell)) edits.push(enemyEdit(enemy.kind, cell));
	}
	return edits;
}
