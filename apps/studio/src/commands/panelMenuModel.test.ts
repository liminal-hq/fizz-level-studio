// Tests for the panel menu model: the rows of a panel's own ⋮ menu and the commands they run
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { NO_FACTS, perPanel, type BridgeSnapshot } from './commandBridge';
import { panelMenuItems } from './panelMenuModel';
import type { PanelId } from '../panels/float/panelSpecs';
import { runCommand } from './registry';

const ids = ['left', 'right', 'bottom'].map((zone) => `panel.history.dock.${zone}`);
const handlers = Object.fromEntries([...ids, 'panel.history.float'].map((id) => [id, vi.fn()]));
type Place = BridgeSnapshot['facts']['placeOf'][PanelId];
const places = (history: Place): BridgeSnapshot['facts']['placeOf'] => ({
	...perPanel<Place>('left'),
	history,
});
const snapshot = (
	facts: Partial<BridgeSnapshot['facts']> = {},
	given: BridgeSnapshot['handlers'] = {},
): BridgeSnapshot => ({
	facts: { ...NO_FACTS, editorOpen: true, hasLevel: true, ...facts },
	handlers: given,
});

const labels = (items: MenuItem[]) =>
	items.map((item) => (item.type === 'separator' ? '-' : 'label' in item ? item.label : ''));

describe('panelMenuItems', () => {
	it('lists where the panel can sit, how it leaves and the layout, in three groups', () => {
		const items = panelMenuItems('history', snapshot({ placeOf: places('right') }, handlers));
		expect(labels(items)).toEqual([
			'Dock left',
			'Dock right',
			'Dock bottom',
			'Float',
			'-',
			'Tear off',
			'-',
			'Reset layout',
		]);
	});

	it('ticks and dims the row for where the panel is now, and says why', () => {
		const items = panelMenuItems('history', snapshot({ placeOf: places('right') }, handlers));
		const right = items.find((item) => item.id === 'panel.history.dock.right');
		expect(right).toMatchObject({
			type: 'checkbox',
			checked: true,
			disabled: true,
			title: 'Already here',
		});
		const left = items.find((item) => item.id === 'panel.history.dock.left');
		expect(left).toMatchObject({ type: 'checkbox', checked: false });
		expect(left && 'disabled' in left ? left.disabled : undefined).toBeUndefined();
	});

	it('offers Dock back in place of Tear off for a panel in a window of its own', () => {
		const items = panelMenuItems(
			'history',
			snapshot(
				{
					away: { ...perPanel(false), history: true },
					placeOf: places('window'),
				},
				handlers,
			),
		);
		expect(labels(items)).toContain('Dock back');
		expect(labels(items)).not.toContain('Tear off');
		expect(items.find((item) => item.id === 'panel.history.dock.left')).not.toHaveProperty(
			'disabled',
		);
	});

	it('runs the dock commands through the registry, and not the one for where it is', () => {
		const facts = { placeOf: places('right') };
		expect(runCommand('panel.history.dock.left', snapshot(facts, handlers))).toBe(true);
		expect(handlers['panel.history.dock.left']).toHaveBeenCalledOnce();
		expect(runCommand('panel.history.dock.right', snapshot(facts, handlers))).toBe(false);
	});

	it('is empty of place rows when no editor is open', () => {
		expect(labels(panelMenuItems('history', { facts: NO_FACTS, handlers: {} }))).toEqual([]);
	});
});
