// What hiding layers does to the view the canvas draws: it drops the things of the hidden layers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Hide is the person's view only. It is not saved, it does not stop an edit, and Claude always
// reads the whole level, so this is a pure function of the view and the ids the person hid.

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';

/** The view the canvas draws with the things of the `hidden` layers left out. */
export function layersView(view: LevelView, hidden: readonly string[]): LevelView {
	if (hidden.length === 0) return view;
	const gone = new Set(hidden);
	const items = gone.has('treats') ? [] : view.items;
	const spawns = gone.has('enemies') ? [] : view.spawns;
	const markers = gone.has('markers') ? [] : view.markers;
	if (items === view.items && spawns === view.spawns && markers === view.markers) return view;
	return { ...view, items, spawns, markers };
}

/**
 * The layers among `hidden` whose tiles Rust has to leave out (the ground, walls, blocks, crystals
 * and edits), which only the masked view can do. The things (items, enemies, exits and doors) are
 * filtered here by `layersView`.
 */
export function cellLayers(sections: readonly ViewSection[], hidden: readonly string[]): string[] {
	return sections
		.filter((section) => section.affects === 'cells' && hidden.includes(section.id))
		.map((section) => section.id);
}

/** The ids of `hidden` that the level still has, so a layer that went away leaves the set. */
export function stillHidden(sections: readonly ViewSection[], hidden: readonly string[]): string[] {
	const present = new Set(sections.map((section) => section.id));
	return hidden.filter((id) => present.has(id));
}
