// The Layers commands: Show all and Unlock all, from the same list of commands as everything else
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The registry adds these through its `extraCommands` step, so the palette and the ribbon's Layers
// group list them. The editor publishes the handlers, and the `locks` and `hiddenLayers` facts that
// say when each one can run.

import type { CommandDef } from './registry';

export const LAYERS_SHOW_ALL = 'layers.showAll';
export const LAYERS_UNLOCK_ALL = 'layers.unlockAll';

/** Show all and Unlock all, each enabled only while there is something to change. */
export function layerCommands(): CommandDef[] {
	return [
		{
			id: LAYERS_SHOW_ALL,
			icon: 'layers.showAll',
			group: 'panels',
			label: 'layers.showAll',
			visible: (facts) => facts.editorOpen,
			enabled: (facts) => facts.editorOpen && facts.hiddenLayers.length > 0,
			reason: () => 'layers.noneHidden',
		},
		{
			id: LAYERS_UNLOCK_ALL,
			icon: 'layers.unlockAll',
			group: 'panels',
			label: 'layers.unlockAll',
			visible: (facts) => facts.editorOpen,
			enabled: (facts) => facts.editorOpen && facts.locks.length > 0,
			reason: () => 'layers.noneLocked',
		},
	];
}
