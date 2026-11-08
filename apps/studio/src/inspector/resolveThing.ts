// Keeps the selected thing pointing at the same thing as the level changes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The level's own list order never changes under the studio's edits (a move, a turn or a delete
// rewrites one thing in place), so the index stays right after the person's own edit. After a change
// from outside, the list may have shifted, so the thing is found again by what it is and where it
// was, and dropped when it is gone.

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { spawnCell, type Thing } from '../tools/tool';

interface Entry {
	kind: string;
	x: number;
	y: number | null;
	line: number | null;
}

/** The thing the entry is, drawn the way the canvas and the lists read it. */
function asThing(kind: 'item' | 'enemy', index: number, entry: Entry, view: LevelView): Thing {
	const cell =
		kind === 'item'
			? { x: Math.floor(entry.x), y: Math.floor(entry.y ?? 0) }
			: spawnCell(view, entry);
	return { kind, name: entry.kind, ...cell, layer: 'objects', index, line: entry.line };
}

function same(a: Thing, b: Thing): boolean {
	return (
		a.kind === b.kind &&
		a.name === b.name &&
		a.x === b.x &&
		a.y === b.y &&
		a.index === b.index &&
		a.line === b.line
	);
}

/**
 * Where `prev` is in `view` now, or null when it is gone.
 *
 * - An item or an enemy stays selected at its index when the entry there is the same word and is
 *   still on the same cell or the same line.
 * - Otherwise the entry with the same word on the same cell is taken, the one whose line is nearest.
 * - Otherwise an entry of the same word at the same index is taken as the thing after the person's
 *   own move, which can change both its cell and, when a statement is split, its line.
 * - The start stays selected while the level has one, and a cell while it is inside the level.
 *
 * The result is `prev` itself when nothing about it changed, so a selection that was not touched
 * does not redraw.
 */
export function resolveThing(prev: Thing, view: LevelView): Thing | null {
	let next: Thing | null = null;
	if (prev.kind === 'item' || prev.kind === 'enemy') {
		const list: readonly Entry[] = prev.kind === 'item' ? view.items : view.spawns;
		const at = list[prev.index];
		const mine = (entry: Entry, index: number) =>
			asThing(prev.kind as 'item' | 'enemy', index, entry, view);
		if (at && at.kind === prev.name) {
			const here = mine(at, prev.index);
			if ((here.x === prev.x && here.y === prev.y) || at.line === prev.line) next = here;
		}
		if (!next) {
			let best: Thing | null = null;
			list.forEach((entry, index) => {
				if (entry.kind !== prev.name) return;
				const candidate = mine(entry, index);
				if (candidate.x !== prev.x || candidate.y !== prev.y) return;
				const distance = Math.abs((entry.line ?? 0) - (prev.line ?? 0));
				const bestDistance = best ? Math.abs((best.line ?? 0) - (prev.line ?? 0)) : Infinity;
				if (distance < bestDistance) best = candidate;
			});
			next = best;
		}
		if (!next && at && at.kind === prev.name) next = mine(at, prev.index);
	} else if (prev.kind === 'start') {
		const start = view.start;
		if (start) {
			next = {
				...prev,
				x: Math.floor(start.x),
				y: Math.floor(start.y),
				line: start.line,
			};
		}
	} else if (prev.x < view.width && prev.y < view.height) {
		const word = view.palette[view.cells[prev.y * view.width + prev.x] ?? 0] ?? 'empty';
		next = { ...prev, name: word };
	}
	return next && same(prev, next) ? prev : next;
}
