// Tests for drawing the panels in windows of their own as tabs in their home zones
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { floatPanel, sendToWindow } from '../dock/dockLayout';
import { defaultWorkspace, dockedIn } from '../dock/dockModel';
import { awayPanels, withAwayTabs } from './awayTabs';

describe('withAwayTabs', () => {
	it('changes nothing when no panel is away', () => {
		const ws = defaultWorkspace();
		expect(withAwayTabs(ws)).toBe(ws);
		expect(awayPanels(ws)).toEqual([]);
	});

	it('adds a docked panel’s tab back to its home zone, last in the last group', () => {
		const ws = sendToWindow(defaultWorkspace(), 'history');
		expect(dockedIn(ws, 'right')).toEqual(['inspector', 'objects']);
		const drawn = withAwayTabs(ws);
		expect(dockedIn(drawn, 'right')).toEqual(['inspector', 'objects', 'history']);
		expect(drawn.zones.right.groups[0]!.active).toBe('inspector');
		expect(dockedIn(ws, 'right')).toEqual(['inspector', 'objects']);
	});

	it('shows the away tab when asked to', () => {
		const ws = sendToWindow(defaultWorkspace(), 'history');
		expect(withAwayTabs(ws, ['history']).zones.right.groups[0]!.active).toBe('history');
	});

	it('makes a group of its own in a zone with none', () => {
		const ws = sendToWindow(sendToWindow(defaultWorkspace(), 'layers'), 'palette');
		expect(dockedIn(ws, 'left')).toEqual([]);
		expect(dockedIn(withAwayTabs(ws), 'left')).toEqual(['palette', 'layers']);
	});

	it('shows a panel that came from floating in its home zone and keeps its floating rectangle', () => {
		const floated = floatPanel(defaultWorkspace(), 'script', { x: 40, y: 50 });
		const ws = sendToWindow(floated, 'script');
		expect(dockedIn(withAwayTabs(ws), 'bottom')).toContain('script');
		expect(ws.panels.script!.float).toMatchObject({ x: 40, y: 50 });
	});
});
