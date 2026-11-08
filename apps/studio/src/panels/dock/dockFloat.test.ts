// Tests for the floating moves inside a workspace
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { moveFloat, raiseFloat, toggleFloatCollapsed } from './dockFloat';
import { defaultWorkspace } from './dockModel';

describe('moveFloat', () => {
	it('places the rectangle and leaves the input alone', () => {
		const ws = defaultWorkspace();
		const moved = moveFloat(ws, 'history', { x: 5, y: 6, w: 300, h: 200 });
		expect(moved.panels.history!.float).toMatchObject({ x: 5, y: 6, w: 300, h: 200 });
		expect(ws.panels.history!.float.x).not.toBe(5);
	});

	it('returns the same workspace for the same rectangle or an unknown panel', () => {
		const ws = defaultWorkspace();
		const f = ws.panels.history!.float;
		expect(moveFloat(ws, 'history', { x: f.x, y: f.y, w: f.w, h: f.h })).toBe(ws);
		expect(moveFloat(ws, 'nope', { x: 1, y: 1, w: 1, h: 1 })).toBe(ws);
	});
});

describe('toggleFloatCollapsed', () => {
	it('flips the flag', () => {
		const ws = toggleFloatCollapsed(defaultWorkspace(), 'history');
		expect(ws.panels.history!.float.collapsed).toBe(true);
		expect(toggleFloatCollapsed(ws, 'history').panels.history!.float.collapsed).toBe(false);
	});
});

describe('raiseFloat', () => {
	it('puts a panel above the rest and does nothing when it is already there', () => {
		const ws = raiseFloat(defaultWorkspace(), 'palette');
		const z = (id: string) => ws.panels[id]!.float.z;
		expect(Object.keys(ws.panels).every((id) => id === 'palette' || z('palette') > z(id))).toBe(
			true,
		);
		expect(raiseFloat(ws, 'palette')).toBe(ws);
	});

	it('renumbers when the numbers grow large, keeping the order', () => {
		const ws = defaultWorkspace();
		ws.panels.script!.float.z = 1_000_000;
		const next = raiseFloat(ws, 'palette');
		expect(next.panels.palette!.float.z).toBe(7);
		expect(next.panels.script!.float.z).toBe(6);
	});
});
