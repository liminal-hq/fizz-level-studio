// The level's layers and the keyboard cursor, as the facts the per-layer and "here" commands read
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { layerName } from '../panels/layers/layerNames';
import { inBounds, type Cell } from '../tools/tool';
import { NO_CURSOR, type CursorFacts, type LayerFact } from './commandBridge';

/** The value `cell_sections` holds for a cell no statement set. */
const NO_SECTION = 255;

/** The layers of `view` in file order, named in the person's language; none for a level that has none. */
export function layerFacts(view: LevelView): LayerFact[] {
	return view.sections.map((section) => ({
		id: section.id,
		name: layerName(section),
		firstLine: section.lines[0]?.[0] ?? null,
	}));
}

/** What the cursor's cell holds: its tile and the layer that last set it, from the level's own view. */
export function cursorFacts(view: LevelView, cursor: Cell): CursorFacts {
	if (!inBounds(view, cursor)) return NO_CURSOR;
	const at = cursor.y * view.width + cursor.x;
	const section = view.cell_sections[at];
	return {
		inside: true,
		tile: view.palette[view.cells[at] ?? 0] ?? null,
		layer:
			section === undefined || section === NO_SECTION ? null : (view.sections[section]?.id ?? null),
	};
}
