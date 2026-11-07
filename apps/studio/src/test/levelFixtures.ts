// Builds LevelSnapshot fixtures for the canvas, tool and panel tests
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';

/** A view of `width` by `height` cells of `empty`, with a floor of `fill` along row 0. */
export function levelView(width = 12, height = 8, overrides: Partial<LevelView> = {}): LevelView {
	const cells = new Array<number>(width * height).fill(0);
	for (let x = 0; x < width; x++) cells[x] = 1;
	return {
		width,
		height,
		name: 'Test Level',
		palette: ['empty', 'fill', 'grass', 'spike'],
		cells,
		items: [],
		spawns: [],
		start: { x: 1, y: 1, line: 2 },
		markers: [],
		sections: [],
		diagnostics: [],
		...overrides,
	};
}

export function levelSnapshot(
	overrides: Partial<LevelSnapshot> = {},
	view: LevelView = levelView(),
): LevelSnapshot {
	return {
		id: 'level-1',
		path: 'levels/test.fizz',
		revision: 1n,
		saved_revision: 1n,
		text: 'script fizz1 0\nlevel test\n',
		view,
		can_undo: false,
		can_redo: false,
		undo_name: null,
		redo_name: null,
		author: 'person',
		edited_outside: false,
		target: 'fizz1',
		banner: null,
		...overrides,
	};
}
