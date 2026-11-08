// Names the selected thing for an edit: where the caller saw it and the line it read
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Rust finds the thing again from this: first by its index and line, and when the text has moved
// under the caller, by the line's exact text and the thing's cell.

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { ThingRef } from '@liminal-hq/fizz-studio-protocol/generated/ThingRef';
import type { Thing } from '../tools/tool';

/**
 * The reference to `thing` as `view` and `text` (the script it was drawn from) show it, or null for
 * a cell, which is painted rather than placed, and for a thing the view cannot place on a line.
 */
export function thingRef(view: LevelView, text: string, thing: Thing): ThingRef | null {
	if (thing.kind === 'cell' || thing.line === null) return null;
	const expect = text.split('\n')[thing.line - 1];
	if (expect === undefined) return null;
	if (thing.kind === 'item') {
		const item = view.items[thing.index];
		if (!item) return null;
		return { kind: 'item', index: thing.index, line: thing.line, expect, x: item.x, y: item.y };
	}
	if (thing.kind === 'enemy') {
		const spawn = view.spawns[thing.index];
		if (!spawn) return null;
		return { kind: 'spawn', index: thing.index, line: thing.line, expect, x: spawn.x, y: spawn.y };
	}
	const start = view.start;
	if (!start) return null;
	return { kind: 'start', index: 0, line: thing.line, expect, x: start.x, y: start.y };
}
