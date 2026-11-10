// Show all and Unlock all: when each can run, and that the surfaces list them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { NO_FACTS, type BridgeSnapshot } from './commandBridge';
import { LAYERS_SHOW_ALL, LAYERS_UNLOCK_ALL } from './layerCommands';
import { allCommands, runCommand, viewOf } from './registry';
import { buildRibbon } from './ribbonModel';

const snapshot = (
	facts: Partial<BridgeSnapshot['facts']>,
	handlers: BridgeSnapshot['handlers'] = {},
): BridgeSnapshot => ({
	facts: { ...NO_FACTS, editorOpen: true, hasLevel: true, ...facts },
	handlers,
});

const view = (id: string, s: BridgeSnapshot) =>
	viewOf(allCommands(s.facts).find((def) => def.id === id)!, s);

describe('the Layers commands', () => {
	it('are registered with the other commands', () => {
		const ids = allCommands(NO_FACTS).map((def) => def.id);
		expect(ids).toContain(LAYERS_SHOW_ALL);
		expect(ids).toContain(LAYERS_UNLOCK_ALL);
	});

	it('are visible only with an editor open, and need something to change', () => {
		const handlers = { [LAYERS_SHOW_ALL]: () => {}, [LAYERS_UNLOCK_ALL]: () => {} };
		const idle = snapshot({}, handlers);
		expect(view(LAYERS_SHOW_ALL, idle)).toMatchObject({ visible: true, enabled: false });
		expect(view(LAYERS_SHOW_ALL, idle).reason).toBe('No layer is hidden');
		expect(view(LAYERS_UNLOCK_ALL, idle).reason).toBe('No layer is locked');
		const busy = snapshot({ hiddenLayers: ['treats'], locks: ['terrain'] }, handlers);
		expect(view(LAYERS_SHOW_ALL, busy).enabled).toBe(true);
		expect(view(LAYERS_UNLOCK_ALL, busy).enabled).toBe(true);
		const closed = { facts: NO_FACTS, handlers };
		expect(view(LAYERS_SHOW_ALL, closed).visible).toBe(false);
	});

	it('run the handler the editor published', () => {
		const calls: string[] = [];
		const s = snapshot(
			{ hiddenLayers: ['treats'], locks: ['terrain'] },
			{
				[LAYERS_SHOW_ALL]: () => calls.push('show'),
				[LAYERS_UNLOCK_ALL]: () => calls.push('unlock'),
			},
		);
		runCommand(LAYERS_SHOW_ALL, s);
		runCommand(LAYERS_UNLOCK_ALL, s);
		expect(calls).toEqual(['show', 'unlock']);
	});

	it('fill the ribbon’s Layers group beside the panel toggle', () => {
		const s = snapshot(
			{ hiddenLayers: ['treats'], locks: [] },
			{ [LAYERS_SHOW_ALL]: () => {}, [LAYERS_UNLOCK_ALL]: () => {}, 'view.panel.layers': () => {} },
		);
		const level = buildRibbon(s).tabs.find((entry) => entry.id === 'level')!;
		const group = level.groups.find((entry) => entry.id === 'layers')!;
		expect(group.items!.map((item) => item.id)).toEqual([
			'view.panel.layers',
			LAYERS_SHOW_ALL,
			LAYERS_UNLOCK_ALL,
		]);
		expect(group.items![2]).toMatchObject({ disabled: true, desc: 'No layer is locked' });
	});
});
