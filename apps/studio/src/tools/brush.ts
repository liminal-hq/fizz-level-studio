// The brush: the one thing Paint lays down, a tile, an item or an enemy, with the item spacing
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';

export type BrushGroup = 'tile' | 'item' | 'enemy';

/** Every group, in the order the palette lists them. */
export const BRUSH_GROUPS: readonly BrushGroup[] = ['tile', 'item', 'enemy'];

export interface Brush {
	group: BrushGroup;
	/** The language word: a tile, an item or an enemy kind. */
	kind: string;
}

/** The item words a Fizz 1 level can `place`; the backend validates, this is only the chooser. */
export const ITEM_WORDS: readonly string[] = [
	'cheezie',
	'choc',
	'cookie',
	'soda',
	'key-red',
	'key-blue',
	'key-green',
	'usb',
];

/** The enemy and prop words a Fizz 1 level can spawn; the backend validates. */
export const ENEMY_WORDS: readonly string[] = [
	'gloop',
	'hopper',
	'marsh',
	'beetle',
	'bat',
	'pod',
	'phantom',
	'roller',
	'sentry',
	'drone',
	'boss',
	'switch',
	'terminal',
	'cage',
	'mirror',
	'swivel',
	'crystal-switch',
	'press',
	'target',
	'glyph',
	'cameo',
];

/** The widest gap between spaced items: one in every `MAX_SPACING` cells. */
export const MAX_SPACING = 8;

export function clampSpacing(spacing: number): number {
	return Math.min(Math.max(Math.round(spacing), 1), MAX_SPACING);
}

export function sameBrush(a: Brush, b: Brush): boolean {
	return a.group === b.group && a.kind === b.kind;
}

/** The first tile word of the level that is not `empty`, as a tile brush. */
export function defaultBrush(view: LevelView): Brush {
	return { group: 'tile', kind: view.palette.find((word) => word !== 'empty') ?? 'fill' };
}

/** The words of one group; tiles come from the open level's palette, without `empty`. */
export function wordsOf(
	group: BrushGroup,
	view: { palette: readonly string[] },
): readonly string[] {
	if (group === 'item') return ITEM_WORDS;
	if (group === 'enemy') return ENEMY_WORDS;
	return view.palette.filter((word) => word !== 'empty');
}

/**
 * The words the palette offers for a group: the documented items and enemies lead when the
 * backend has sent them, and the built-in lists stand in until then, so the list is never empty.
 */
export function brushWords(
	group: BrushGroup,
	tiles: readonly string[],
	docs: readonly { word: string; kind: string }[],
): readonly string[] {
	const documented = docs.filter((doc) => doc.kind === group).map((doc) => doc.word);
	return group !== 'tile' && documented.length > 0
		? documented
		: wordsOf(group, { palette: tiles });
}
