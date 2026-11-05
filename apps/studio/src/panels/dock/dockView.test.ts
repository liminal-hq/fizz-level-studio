// Tests for what the dock draws
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { setPanelVisible, setZoneCollapsed } from './dockLayout';
import { PANEL_IDS, defaultWorkspace, dockedIn } from './dockModel';
import { shownPanels, visibleWorkspace } from './dockView';

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
		const ws = setPanelVisible(defaultWorkspace(), 'palette', false);
		expect(visibleWorkspace(ws).zones.left.groups).toEqual([]);
	});

	it('hides the open zones in level-first and keeps the folded ones for their rails', () => {
		const ws = setZoneCollapsed(defaultWorkspace(), 'bottom', true);
		const view = visibleWorkspace(ws, true);
		expect(view.zones.left.groups).toEqual([]);
		expect(view.zones.right.groups).toEqual([]);
		expect(dockedIn(view, 'bottom')).toEqual(['script', 'proposals']);
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
