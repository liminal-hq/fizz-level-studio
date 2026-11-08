// What the Inspector says about a selected cell: its tile, the language's words for it, and its script line
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A pure model: it reads the level's own view, the script text and the language's word list, and
// answers in plain data, so the panel only draws it. Nothing here is a game fact of its own. The
// tile's category and description are the language's (`WordDoc`, the same text the Palette's hover
// shows), the layer and the line come from Rust's view of the script, and the properties of a tile
// (solid, one-way, lethal and so on) are the ones that description states in its own words.

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import type { Brush } from '../tools/brush';
import { paletteSections, type SectionId } from '../tools/paletteSections';

/** The layer a studio paint is added to: the end of the script. */
export const PAINT_LAYER = 'edits';

/** The value `cell_sections` holds for a cell no statement set. */
const NO_SECTION = 255;

/** A layer of the script, with whether the person has hidden or locked it. */
export interface CellLayer {
	id: string;
	/** The name Rust sent, for a layer the catalogue has no name for. */
	label: string;
	locked: boolean;
	hidden: boolean;
}

export interface CellDescription {
	x: number;
	y: number;
	/** The tile word on the cell as the level really holds it, `empty` included. */
	tile: string;
	/** True where nothing is painted (the `empty` tile). */
	empty: boolean;
	/** The group the language files the tile under, such as `Ground and solids`, or null. */
	category: string | null;
	/** The language's description of the tile, without its group prefix, or null when it has none. */
	note: string | null;
	/** The tile's script syntax, such as `fill x=A..B y=A..B`, or null. */
	syntax: string | null;
	/** The line (from 1) of the statement that last set the cell, or null when none did. */
	line: number | null;
	/** That line's text, or null. */
	lineText: string | null;
	/** The layer that owns the cell: where its last statement sits. Null when none did. */
	layer: CellLayer | null;
	/** The Palette brush that places this tile, or null (an empty cell has none). */
	brush: Brush | null;
	/** For an empty cell: the Palette sections whose brushes could be placed on it. */
	placeable: SectionId[];
	/** For an empty cell: the layer a paint here would write to, or null when the level has no layers. */
	paintLayer: CellLayer | null;
}

export interface CellDescriptionInput {
	view: LevelView;
	/** The script text, to read the line from. */
	text: string;
	words: readonly WordDoc[];
	x: number;
	y: number;
	/** The line `level_cell_line` reported for the cell, or null when none did or it is not known yet. */
	line: number | null;
	locked: readonly string[];
	hidden: readonly string[];
}

/** The text of line `line` (from 1) of `text`, without its line break, or null past the end. */
export function lineTextOf(text: string, line: number | null): string | null {
	if (line === null || line < 1) return null;
	const lines = text.split('\n');
	const found = lines[line - 1];
	return found === undefined ? null : found.replace(/\r$/, '').trim();
}

/** The section of `view` that owns script line `line`, for a level that gives no per-cell owner. */
function sectionAtLine(sections: readonly ViewSection[], line: number): ViewSection | null {
	return (
		sections.find((section) =>
			section.lines.some(([first, last]) => line >= first && line <= last),
		) ?? null
	);
}

/** The tile word at a cell of the whole view, or null outside the level. */
export function tileWordAt(view: LevelView, x: number, y: number): string | null {
	if (x < 0 || y < 0 || x >= view.width || y >= view.height) return null;
	const index = view.cells[y * view.width + x];
	return index === undefined ? null : (view.palette[index] ?? null);
}

function layerOf(
	section: Pick<ViewSection, 'id' | 'label'>,
	locked: readonly string[],
	hidden: readonly string[],
): CellLayer {
	return {
		id: section.id,
		label: section.label,
		locked: locked.includes(section.id),
		hidden: hidden.includes(section.id),
	};
}

/** The description of the cell with the tile name the selection carried as the fallback. */
export function describeCell(input: CellDescriptionInput, fallbackTile = 'empty'): CellDescription {
	const { view, words, x, y, line, locked, hidden } = input;
	const tile = tileWordAt(view, x, y) ?? fallbackTile;
	const empty = tile === 'empty';
	const doc = words.find((word) => word.word === tile && word.kind === 'tile') ?? null;
	const category = doc && doc.group !== '' ? doc.group : null;
	const prefix = category === null ? null : `${category}: `;
	const note =
		doc === null || doc.note === ''
			? null
			: prefix !== null && doc.note.startsWith(prefix)
				? doc.note.slice(prefix.length)
				: doc.note;

	// The layer that owns the cell: the view's own answer, or the layer holding the line.
	const at = view.cell_sections[y * view.width + x];
	const owner =
		at !== undefined && at !== NO_SECTION
			? (view.sections[at] ?? null)
			: line !== null
				? sectionAtLine(view.sections, line)
				: null;
	const layer = owner ? layerOf(owner, locked, hidden) : null;

	const hasLayers = view.sections.length > 0;
	const paintSection = view.sections.find((section) => section.id === PAINT_LAYER);
	const paintLayer =
		empty && hasLayers
			? layerOf(paintSection ?? { id: PAINT_LAYER, label: PAINT_LAYER }, locked, hidden)
			: null;

	const sections = empty ? paletteSections(view.palette, words) : [];
	// The Palette offers a tile brush for every word of the level's palette but `empty`.
	const brush: Brush | null =
		!empty && view.palette.includes(tile) ? { group: 'tile', kind: tile } : null;

	return {
		x,
		y,
		tile,
		empty,
		category,
		note,
		syntax: doc && doc.syntax !== '' ? doc.syntax : null,
		line,
		lineText: lineTextOf(input.text, line),
		layer,
		brush,
		placeable: sections.map((section) => section.id),
		paintLayer,
	};
}
