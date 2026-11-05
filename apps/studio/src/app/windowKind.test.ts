// Tests for the window label parser
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { ownerOfPanel, panelFromLabel, windowKindFromLabel } from './windowKind';

describe('windowKindFromLabel', () => {
	it('names every kind of window', () => {
		expect(windowKindFromLabel('main-1')).toBe('main');
		expect(windowKindFromLabel('main-12')).toBe('main');
		expect(windowKindFromLabel('panel-script-1')).toBe('panel');
		expect(windowKindFromLabel('panel-game-view-3')).toBe('panel');
		expect(windowKindFromLabel('new-world')).toBe('new-world');
		expect(windowKindFromLabel('preferences')).toBe('preferences');
		expect(windowKindFromLabel('about')).toBe('about');
		expect(windowKindFromLabel('tear-ghost')).toBe('tear-ghost');
	});

	it('refuses labels the protocol crate refuses', () => {
		for (const label of [
			'',
			'main',
			'main-',
			'main-0',
			'main-01',
			'main-1a',
			'main-x',
			'panel-1',
			'panel--1',
			'panel-Script-1',
			'panel-script',
			'panel-script-0',
			'panel-sc_ript-1',
			'About',
			'settings',
		]) {
			expect(windowKindFromLabel(label), label).toBeNull();
		}
	});
});

describe('panelFromLabel', () => {
	it('names the panel a panel window holds', () => {
		expect(panelFromLabel('panel-script-1')).toBe('script');
		expect(panelFromLabel('panel-game-view-3')).toBe('game-view');
	});

	it('is null for every other label', () => {
		expect(panelFromLabel('main-1')).toBeNull();
		expect(panelFromLabel('panel-script')).toBeNull();
		expect(panelFromLabel('tear-ghost')).toBeNull();
	});
});

describe('ownerOfPanel', () => {
	it('names the main window a panel window belongs to', () => {
		expect(ownerOfPanel('panel-script-1')).toBe('main-1');
		expect(ownerOfPanel('panel-game-view-3')).toBe('main-3');
	});

	it('names nothing for a window that is not a panel', () => {
		expect(ownerOfPanel('main-1')).toBeNull();
		expect(ownerOfPanel('about')).toBeNull();
		expect(ownerOfPanel('panel-script')).toBeNull();
	});
});
