// The Layers commands: Show all and Unlock all, from the same list of commands as everything else
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The registry adds these through its `extraCommands` step, so the palette and the ribbon's Layers
// group list them. The editor publishes the handlers, and the `locks` and `hiddenLayers` facts that
// say when each one can run.

import type { CommandFacts } from './commandBridge';
import type { CommandDef } from './registry';

export const LAYERS_SHOW_ALL = 'layers.showAll';
export const LAYERS_UNLOCK_ALL = 'layers.unlockAll';

/** What a layer's own command does: hide it (or show it again), show only it, lock it (or unlock it), or show its first line in the script. */
export type LayerAction = 'hide' | 'only' | 'lock' | 'reveal';
export const LAYER_ACTIONS: readonly LayerAction[] = ['hide', 'only', 'lock', 'reveal'];

/** The id of a layer's own command, such as `layers.lock.treats`. The commands are built from the `layers` fact, one set per layer the level has. */
export const layerCommandId = (action: LayerAction, layer: string) => `layers.${action}.${layer}`;

/** Show all and Unlock all, each enabled only while there is something to change, and each layer's own commands. */
export function layerCommands(_facts?: CommandFacts): CommandDef[] {
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
