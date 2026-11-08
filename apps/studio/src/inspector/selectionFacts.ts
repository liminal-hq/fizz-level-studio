// What may be done to the selected thing, worked out from the level's own entry for it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The Inspector's controls and the selection commands (Delete, Flip, the nudges, Show in script)
// read the same answer, so a command and a button are enabled together. It only describes: Rust is
// still the one that refuses a change it cannot make.

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { NO_SELECTION, type SelectionFacts } from '../commands/commandBridge';
import type { Thing } from '../tools/tool';

/** The entry of the level's own view that `thing` points to, or null where it is no longer there. */
export function entryOf(view: LevelView, thing: Thing) {
	if (thing.kind === 'item') return view.items[thing.index] ?? null;
	if (thing.kind === 'enemy') return view.spawns[thing.index] ?? null;
	if (thing.kind === 'start') return view.start;
	return null;
}

/** The id of the layer that owns script line `line`: the section whose runs hold it, or null. */
export function layerOfLine(view: LevelView, line: number | null): string | null {
	if (line === null) return null;
	const section = view.sections.find((candidate) =>
		candidate.lines.some(([first, last]) => line >= first && line <= last),
	);
	return section?.id ?? null;
}

/**
 * What the selection commands may do with `thing` in this level. `locked` is the ids of the locked
 * layers (Rust's to say): the thing's layer is `lockedLayer` while it is one of them.
 */
export function selectionFacts(
	snapshot: LevelSnapshot,
	thing: Thing | null,
	locked: readonly string[] = [],
): SelectionFacts {
	if (!thing) return NO_SELECTION;
	if (thing.kind === 'cell') return { ...NO_SELECTION, kind: 'cell' };
	const view = snapshot.view;
	const entry = entryOf(view, thing);
	if (!entry) return NO_SELECTION;
	const fizz2 = snapshot.target === 'fizz2';
	const spawn = thing.kind === 'enemy' ? view.spawns[thing.index] : undefined;
	const item = thing.kind === 'item' ? view.items[thing.index] : undefined;
	const generated = (item?.generator ?? null) !== null;
	const editable = !fizz2 && !generated && entry.line !== null;
	const layer = layerOfLine(view, entry.line);
	return {
		kind: thing.kind,
		editable,
		canFlip: editable && spawn !== undefined && !spawn.ride,
		canDelete: editable && thing.kind !== 'start',
		hasLine: entry.line !== null,
		reason: fizz2 ? 'inspector.fizz2' : generated ? 'selection.generated' : null,
		lockedLayer: layer !== null && locked.includes(layer) ? layer : null,
	};
}
