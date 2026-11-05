// Tests for drawing the panels in windows of their own as tabs in their home zones
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { floatPanel, sendToWindow } from '../dock/dockLayout';
import { defaultWorkspace, dockedIn } from '../dock/dockModel';
import { awayFloating, awayPanels, withAwayTabs } from './awayTabs';

describe('withAwayTabs', () => {
	it('changes nothing when no panel is away', () => {
		const ws = defaultWorkspace();
		expect(withAwayTabs(ws)).toBe(ws);
		expect(awayPanels(ws)).toEqual([]);
	});

	it('adds a docked panel’s tab back to its home zone, last in the last group', () => {
		const ws = sendToWindow(defaultWorkspace(), 'history');
		expect(dockedIn(ws, 'right')).toEqual(['objects']);
		const drawn = withAwayTabs(ws);
		expect(dockedIn(drawn, 'right')).toEqual(['objects', 'history']);
		expect(drawn.zones.right.groups[0]!.active).toBe('objects');
		expect(dockedIn(ws, 'right')).toEqual(['objects']);
	});

	it('shows the away tab when asked to', () => {
		const ws = sendToWindow(defaultWorkspace(), 'history');
		expect(withAwayTabs(ws, ['history']).zones.right.groups[0]!.active).toBe('history');
	});

	it('makes a group of its own in a zone with none', () => {
		const ws = sendToWindow(defaultWorkspace(), 'palette');
		expect(dockedIn(ws, 'left')).toEqual([]);
		expect(dockedIn(withAwayTabs(ws), 'left')).toEqual(['palette']);
	});

	it('leaves a panel that came from floating to be drawn as a floating notice', () => {
		const ws = sendToWindow(floatPanel(defaultWorkspace(), 'script'), 'script');
		expect(awayFloating(ws, 'script')).toBe(true);
		expect(awayFloating(ws, 'palette')).toBe(false);
		expect(dockedIn(withAwayTabs(ws), 'bottom')).not.toContain('script');
	});
});
