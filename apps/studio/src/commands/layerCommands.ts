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

/** True when `layer` is the only layer shown: every other layer is hidden and it is not. */
export function isOnlyShown(facts: CommandFacts, layer: string): boolean {
	return (
		!facts.hiddenLayers.includes(layer) &&
		facts.layers.every((other) => other.id === layer || facts.hiddenLayers.includes(other.id))
	);
}

/** The four commands of one layer, built from the `layers` fact the way `brushCommands` is built from the brushes. */
function layerOwnCommands(
	facts: CommandFacts,
	layer: CommandFacts['layers'][number],
): CommandDef[] {
	const hidden = facts.hiddenLayers.includes(layer.id);
	const locked = facts.locks.includes(layer.id);
	const values = { layer: layer.name };
	const editor = (now: CommandFacts) => now.editorOpen;
	return [
		{
			id: layerCommandId('hide', layer.id),
			icon: hidden ? 'layers.show' : 'layers.hide',
			group: 'panels',
			label: hidden ? 'layers.showOne' : 'layers.hideOne',
			labelValues: values,
			visible: editor,
			enabled: editor,
		},
		{
			id: layerCommandId('only', layer.id),
			icon: 'layers.only',
			group: 'panels',
			label: 'layers.only',
			labelValues: values,
			visible: editor,
			enabled: (now) => now.editorOpen && !isOnlyShown(now, layer.id),
			reason: () => 'layers.onlyHere',
		},
		{
			id: layerCommandId('lock', layer.id),
			icon: locked ? 'layers.unlock' : 'layers.lock',
			group: 'panels',
			label: locked ? 'layers.unlockOne' : 'layers.lockOne',
			labelValues: values,
			visible: editor,
			enabled: editor,
		},
		{
			id: layerCommandId('reveal', layer.id),
			icon: 'selection.showInScript',
			group: 'panels',
			label: 'layers.reveal',
			labelValues: values,
			shortLabel: 'layers.revealOne',
			visible: editor,
			enabled: (now) => now.editorOpen && layer.firstLine !== null,
			reason: () => 'layers.noLine',
		},
	];
}

/**
 * Show all and Unlock all, each enabled only while there is something to change, and the commands of
 * each layer the level has: Hide (or Show), Show only, Lock (or Unlock) and Show its first line in the script.
 */
export function layerCommands(facts?: CommandFacts): CommandDef[] {
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
		...(facts?.layers ?? []).flatMap((layer) => layerOwnCommands(facts!, layer)),
	];
}
