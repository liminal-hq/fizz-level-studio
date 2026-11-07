// Tests for what the dock draws
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { floatPanel, setPanelVisible, setZoneCollapsed } from './dockLayout';
import { PANEL_IDS, defaultWorkspace, dockedIn } from './dockModel';
import { railChoice, shownPanels, visibleWorkspace } from './dockView';

describe('visibleWorkspace', () => {
	it('is the workspace itself when nothing is hidden', () => {
		const ws = defaultWorkspace();
		expect(visibleWorkspace(ws)).toEqual(ws);
	});

	it('drops the tab of a hidden panel and moves the showing tab on', () => {
		const ws = setPanelVisible(defaultWorkspace(), 'objects', false);
		const view = visibleWorkspace(ws);
		expect(dockedIn(view, 'right')).toEqual(['history']);
		expect(view.zones.right.groups[0]!.active).toBe('history');
		expect(dockedIn(ws, 'right')).toEqual(['objects', 'history']);
	});

	it('drops a group and a zone with nothing showing', () => {
		const ws = setPanelVisible(
			setPanelVisible(defaultWorkspace(), 'palette', false),
			'layers',
			false,
		);
		expect(visibleWorkspace(ws).zones.left.groups).toEqual([]);
	});

	it('folds every zone in level-first, keeping its panels for its rail', () => {
		const ws = setZoneCollapsed(defaultWorkspace(), 'bottom', true);
		const view = visibleWorkspace(ws, true);
		for (const zone of ['left', 'right', 'bottom'] as const) {
			expect(view.zones[zone].collapsed).toBe(true);
		}
		expect(dockedIn(view, 'left')).toEqual(['palette', 'layers']);
		expect(dockedIn(view, 'right')).toEqual(['objects', 'history']);
		expect(dockedIn(view, 'bottom')).toEqual(['script', 'proposals']);
		expect(ws.zones.left.collapsed).toBe(false);
	});
});

describe('railChoice', () => {
	it('shows a panel that is not showing in an open zone', () => {
		expect(railChoice(visibleWorkspace(defaultWorkspace()), 'history')).toBe('show');
	});

	it('folds the zone when its showing panel is chosen', () => {
		const view = visibleWorkspace(defaultWorkspace());
		expect(railChoice(view, 'objects')).toBe('fold');
		expect(railChoice(view, 'palette')).toBe('fold');
		expect(railChoice(view, 'script')).toBe('fold');
	});

	it('opens a folded zone on any of its panels', () => {
		const view = visibleWorkspace(setZoneCollapsed(defaultWorkspace(), 'right', true));
		expect(railChoice(view, 'objects')).toBe('open');
		expect(railChoice(view, 'history')).toBe('open');
	});

	it('reads the panel drawn in place of a hidden active one as the showing one', () => {
		const view = visibleWorkspace(setPanelVisible(defaultWorkspace(), 'objects', false));
		expect(railChoice(view, 'history')).toBe('fold');
		expect(railChoice(view, 'objects')).toBeNull();
	});

	it('has nothing to do for a panel that is not docked', () => {
		const view = visibleWorkspace(floatPanel(defaultWorkspace(), 'history'));
		expect(railChoice(view, 'history')).toBeNull();
	});
});

describe('shownPanels', () => {
	it('lists the visible flag of each panel', () => {
		const ws = setPanelVisible(defaultWorkspace(), 'history', false);
		const shown = shownPanels(ws, PANEL_IDS);
		expect(shown.history).toBe(false);
		expect(shown.script).toBe(true);
	});
});
