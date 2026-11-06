// The palette's sections: which heading each brush sits under, in one table
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { brushWords, BRUSH_GROUPS, type Brush, type BrushGroup } from './brush';

export type SectionId = 'terrain' | 'hazards' | 'treats' | 'enemies' | 'markers';

/** Every section, in the order the palette lists them. */
export const SECTION_IDS: readonly SectionId[] = [
	'terrain',
	'hazards',
	'treats',
	'enemies',
	'markers',
];

const tiles = (...kinds: string[]): Brush[] => kinds.map((kind) => ({ group: 'tile', kind }));
const items = (...kinds: string[]): Brush[] => kinds.map((kind) => ({ group: 'item', kind }));
const enemies = (...kinds: string[]): Brush[] => kinds.map((kind) => ({ group: 'enemy', kind }));

/**
 * Every brush the studio knows, under the section it belongs to. A brush missing here still shows
 * (see `sectionOf`), but the test over this table fails until it is given a place.
 *
 * Markers holds only Exit: a start position has no edit yet, so there is no Start brush to offer.
 * The props (switches, terminals, cages and the like) are spawned like enemies, so they sit with them.
 */
export const SECTION_BRUSHES: Readonly<Record<SectionId, readonly Brush[]>> = {
	terrain: tiles(
		'fill',
		'block',
		'cracked',
		'facade',
		'wall-bg',
		'one-way',
		'bridge',
		'slope-r45',
		'slope-l45',
		'slope-r22a',
		'slope-r22b',
		'slope-l22a',
		'slope-l22b',
		'red-door',
		'blue-door',
		'green-door',
		'gate',
		'gate-2',
		'gate-3',
		'grass',
		'tree',
		'vine',
		'rock',
		'river',
		'path',
		'house-a',
		'house-b',
		'shop',
		'fountain',
		'rung',
		'rung-top',
		'conveyor-l',
		'conveyor-r',
		'crystal-tile',
		'mural-origin',
		'mural-part',
	),
	hazards: tiles('choc', 'spike', 'furnace'),
	treats: items('cheezie', 'soda', 'choc', 'cookie', 'key-red', 'key-blue', 'key-green', 'usb'),
	enemies: enemies(
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
	),
	markers: tiles('exit'),
};

const FALLBACK: Record<BrushGroup, SectionId> = {
	tile: 'terrain',
	item: 'treats',
	enemy: 'enemies',
};

const BY_BRUSH = new Map<string, SectionId>(
	SECTION_IDS.flatMap((id) =>
		SECTION_BRUSHES[id].map((brush): [string, SectionId] => [`${brush.group}:${brush.kind}`, id]),
	),
);

/** The section a brush sits under; a word the table does not know goes to its group's main section. */
export function sectionOf(brush: Brush): SectionId {
	return BY_BRUSH.get(`${brush.group}:${brush.kind}`) ?? FALLBACK[brush.group];
}

/** The brushes the palette offers, by section, in the order of the level's palette and the docs. */
export function paletteSections(
	tileWords: readonly string[],
	docs: readonly { word: string; kind: string }[],
): { id: SectionId; brushes: Brush[] }[] {
	const all: Brush[] = BRUSH_GROUPS.flatMap((group) =>
		brushWords(group, tileWords, docs).map((kind): Brush => ({ group, kind })),
	);
	return SECTION_IDS.map((id) => ({
		id,
		brushes: all.filter((brush) => sectionOf(brush) === id),
	})).filter((section) => section.brushes.length > 0);
}
