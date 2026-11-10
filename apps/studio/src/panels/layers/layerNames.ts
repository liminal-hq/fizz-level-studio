// The names and notes of the layers, from the message catalogue
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import { t, type MessageId } from '../../i18n/messages';

const NAMES: Record<string, MessageId> = {
	terrain: 'layers.name.terrain',
	walls: 'layers.name.walls',
	blocks: 'layers.name.blocks',
	crystals: 'layers.name.crystals',
	markers: 'layers.name.markers',
	treats: 'layers.name.treats',
	enemies: 'layers.name.enemies',
	edits: 'layers.name.edits',
};

const NOTES: Record<string, MessageId> = {
	terrain: 'layers.note.terrain',
	walls: 'layers.note.walls',
	blocks: 'layers.note.blocks',
	crystals: 'layers.note.crystals',
	markers: 'layers.note.markers',
	treats: 'layers.note.treats',
	enemies: 'layers.note.enemies',
	edits: 'layers.note.edits',
};

/** The layer's name in the person's language; a layer the catalogue does not know shows Rust's. */
export function layerName(section: Pick<ViewSection, 'id' | 'label'>): string {
	const id = NAMES[section.id];
	return id ? t(id) : section.label;
}

/** A short note on what the layer holds, or none for a layer the catalogue does not know. */
export function layerNote(id: string): string | null {
	const note = NOTES[id];
	return note ? t(note) : null;
}

/** A list of layer ids as names for a sentence: `Terrain and Treats`. */
export function layerNames(ids: readonly string[], sections: readonly ViewSection[]): string[] {
	return ids.map((id) => layerName(sections.find((s) => s.id === id) ?? { id, label: id }));
}
