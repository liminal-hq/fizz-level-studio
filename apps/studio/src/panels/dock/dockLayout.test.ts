// Tests for the dock's reducers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import { describe, expect, it } from 'vitest';
import {
	INITIAL_SESSION,
	activateTab,
	bringBack,
	closePeek,
	dockBack,
	dockPanel,
	floatPanel,
	maximiseDocked,
	maximisePanel,
	peekPanel,
	pinPanel,
	reorderTab,
	resizeZone,
	restorePanel,
	sendToWindow,
	setPanelVisible,
	setZoneCollapsed,
	settleSession,
	toggleLevelFirst,
	toggleZone,
} from './dockLayout';
import { PANEL_IDS, defaultWorkspace, dockedIn, zoneOf } from './dockModel';
import { validateWorkspace } from './dockNormalise';

const big = { w: 1440, h: 900 };

/** Every move must leave each panel in exactly one place. */
function sound(ws: Workspace) {
	expect(validateWorkspace(ws, big)).toEqual([]);
}

describe('the default layout', () => {
	it('puts every panel in exactly one place', () => {
		const ws = defaultWorkspace();
		sound(ws);
		expect(dockedIn(ws, 'left')).toEqual(['palette', 'layers']);
		expect(dockedIn(ws, 'right')).toEqual(['objects', 'history']);
		expect(dockedIn(ws, 'bottom')).toEqual(['script', 'proposals']);
		expect(PANEL_IDS.every((id) => zoneOf(ws, id) !== null)).toBe(true);
	});
});

describe('dockPanel', () => {
	it('docks as a new tab and makes it the showing one', () => {
		const ws = dockPanel(defaultWorkspace(), 'palette', 'right');
		expect(dockedIn(ws, 'right')).toEqual(['objects', 'history', 'palette']);
		expect(ws.zones.right.groups[0]!.active).toBe('palette');
		expect(dockedIn(ws, 'left')).toEqual(['layers']);
		expect(ws.panels.palette!.home).toBe('right');
		sound(ws);
	});

	it('docks alone in a group of its own', () => {
		const ws = dockPanel(defaultWorkspace(), 'palette', 'right', { alone: true });
		expect(ws.zones.right.groups.map((g) => g.tabs)).toEqual([['objects', 'history'], ['palette']]);
		sound(ws);
	});

	it('puts a new group where asked and a tab where asked', () => {
		const first = dockPanel(defaultWorkspace(), 'palette', 'right', { alone: true, group: 0 });
		expect(first.zones.right.groups[0]!.tabs).toEqual(['palette']);
		const second = dockPanel(defaultWorkspace(), 'palette', 'right', { index: 0 });
		expect(dockedIn(second, 'right')).toEqual(['palette', 'objects', 'history']);
	});

	it('starts a group in an empty zone', () => {
		const ws = dockPanel(defaultWorkspace(), 'objects', 'left', { alone: false });
		expect(ws.zones.left.groups.map((g) => g.tabs)).toEqual([['palette', 'layers', 'objects']]);
		const bare = dockPanel(dockPanel(defaultWorkspace(), 'palette', 'right'), 'layers', 'right');
		expect(bare.zones.left.groups).toEqual([]);
		const empty = dockPanel(bare, 'objects', 'left');
		expect(empty.zones.left.groups).toEqual([{ tabs: ['objects'], active: 'objects' }]);
	});

	it('moves a panel between zones without leaving a copy', () => {
		const ws = dockPanel(defaultWorkspace(), 'script', 'right');
		expect(dockedIn(ws, 'bottom')).toEqual(['proposals']);
		expect(ws.zones.bottom.groups[0]!.active).toBe('proposals');
		expect(dockedIn(ws, 'right')).toContain('script');
		sound(ws);
	});

	it('opens a collapsed zone it docks into', () => {
		const ws = dockPanel(setZoneCollapsed(defaultWorkspace(), 'right', true), 'palette', 'right');
		expect(ws.zones.right.collapsed).toBe(false);
	});

	it('hands the showing tab to a neighbour when it leaves', () => {
		const ws = dockPanel(defaultWorkspace(), 'objects', 'left');
		expect(ws.zones.right.groups[0]).toEqual({ tabs: ['history'], active: 'history' });
	});

	it('ignores an unknown panel and never changes its input', () => {
		const ws = defaultWorkspace();
		const before = structuredClone(ws);
		expect(dockPanel(ws, 'nope', 'left')).toBe(ws);
		dockPanel(ws, 'palette', 'bottom');
		expect(ws).toEqual(before);
	});
});

describe('tabs', () => {
	it('activates a tab', () => {
		const ws = activateTab(defaultWorkspace(), 'history');
		expect(ws.zones.right.groups[0]!.active).toBe('history');
		expect(activateTab(ws, 'palette').zones.left.groups[0]!.active).toBe('palette');
	});

	it('ignores activating a panel that is not docked', () => {
		const ws = floatPanel(defaultWorkspace(), 'palette');
		expect(activateTab(ws, 'palette')).toBe(ws);
	});

	it('reorders within the group and clamps the position', () => {
		const ws = reorderTab(defaultWorkspace(), 'history', 0);
		expect(dockedIn(ws, 'right')).toEqual(['history', 'objects']);
		expect(dockedIn(reorderTab(ws, 'history', 99), 'right')).toEqual(['objects', 'history']);
		expect(dockedIn(reorderTab(ws, 'history', -4), 'right')).toEqual(['history', 'objects']);
		sound(ws);
	});

	it('ignores reordering a floating panel', () => {
		const ws = floatPanel(defaultWorkspace(), 'history');
		expect(reorderTab(ws, 'history', 0)).toBe(ws);
	});
});

describe('floating', () => {
	it('floats a docked panel at a rectangle and remembers its zone', () => {
		const ws = floatPanel(defaultWorkspace(), 'objects', { x: 300, y: 200, w: 280, h: 320 });
		expect(ws.panels.objects).toMatchObject({
			place: 'floating',
			home: 'right',
			float: { x: 300, y: 200, w: 280, h: 320, visible: true },
		});
		expect(dockedIn(ws, 'right')).toEqual(['history']);
		sound(ws);
	});

	it('floats where it last floated when no rectangle is given', () => {
		const ws = floatPanel(defaultWorkspace(), 'script');
		expect(ws.panels.script!.float).toMatchObject({ x: 812, y: 8, w: 460, h: 420 });
	});

	it('brings a floated panel to the front', () => {
		const ws = floatPanel(floatPanel(defaultWorkspace(), 'palette'), 'history');
		expect(ws.panels.history!.float.z).toBeGreaterThan(ws.panels.palette!.float.z);
	});

	it('docks back to the previous zone as a tab', () => {
		const floated = floatPanel(defaultWorkspace(), 'history', { x: 10, y: 10 });
		const back = dockBack(floated, 'history');
		expect(dockedIn(back, 'right')).toEqual(['objects', 'history']);
		expect(back.panels.history!.place).toBe('docked');
		expect(back.panels.history!.float).toMatchObject({ x: 10, y: 10 });
		sound(back);
	});

	it('docks back into a zone that has been emptied meanwhile', () => {
		let ws = floatPanel(defaultWorkspace(), 'palette');
		ws = dockPanel(ws, 'layers', 'bottom');
		expect(ws.zones.left.groups).toEqual([]);
		const back = dockBack(ws, 'palette');
		expect(back.zones.left.groups).toEqual([{ tabs: ['palette'], active: 'palette' }]);
	});

	it('leaves a docked panel alone when asked to dock back', () => {
		const ws = defaultWorkspace();
		expect(dockBack(ws, 'palette')).toBe(ws);
	});
});

describe('its own window', () => {
	it('sends a docked panel to a window and brings it back to its zone', () => {
		const out = sendToWindow(defaultWorkspace(), 'history', { x: -1200, y: 80, w: 400, h: 500 });
		expect(out.panels.history).toMatchObject({
			place: 'window',
			home: 'right',
			window: { x: -1200, y: 80, w: 400, h: 500 },
			window_from: 'docked',
		});
		expect(dockedIn(out, 'right')).toEqual(['objects']);
		sound(out);
		const back = bringBack(out, 'history');
		expect(dockedIn(back, 'right')).toEqual(['objects', 'history']);
		expect(back.panels.history!.window).toEqual({ x: -1200, y: 80, w: 400, h: 500 });
		sound(back);
	});

	it('returns a floating panel to floating', () => {
		const floated = floatPanel(defaultWorkspace(), 'script', { x: 40, y: 50 });
		const out = sendToWindow(floated, 'script');
		expect(out.panels.script!.window_from).toBe('floating');
		const back = bringBack(out, 'script');
		expect(back.panels.script).toMatchObject({ place: 'floating', float: { x: 40, y: 50 } });
	});

	it('opens a first window at the floating rectangle and later where it was left', () => {
		const first = sendToWindow(defaultWorkspace(), 'script');
		expect(first.panels.script!.window).toEqual({ x: 812, y: 8, w: 460, h: 420 });
		const moved = sendToWindow(first, 'script', { x: 5, y: 6, w: 700, h: 500 });
		expect(moved.panels.script!.window).toEqual({ x: 5, y: 6, w: 700, h: 500 });
		expect(sendToWindow(first, 'script')).toBe(first);
		const again = sendToWindow(bringBack(moved, 'script'), 'script');
		expect(again.panels.script!.window).toEqual({ x: 5, y: 6, w: 700, h: 500 });
	});

	it('docks a windowed panel back in its home zone', () => {
		const out = sendToWindow(floatPanel(defaultWorkspace(), 'palette'), 'palette');
		const back = dockBack(out, 'palette');
		expect(back.panels.palette!.place).toBe('docked');
		sound(back);
	});

	it('ignores bringing back a panel that is not in a window', () => {
		const ws = defaultWorkspace();
		expect(bringBack(ws, 'palette')).toBe(ws);
	});
});

describe('zones', () => {
	it('collapses, expands and toggles', () => {
		const collapsed = setZoneCollapsed(defaultWorkspace(), 'left', true);
		expect(collapsed.zones.left.collapsed).toBe(true);
		expect(setZoneCollapsed(collapsed, 'left', true)).toBe(collapsed);
		expect(toggleZone(collapsed, 'left').zones.left.collapsed).toBe(false);
		expect(dockedIn(collapsed, 'left')).toEqual(['palette', 'layers']);
	});

	it('resizes within the caps and minimums for the window', () => {
		const ws = defaultWorkspace();
		expect(resizeZone(ws, 'right', 300, big).zones.right.size).toBe(300);
		expect(resizeZone(ws, 'right', 900, big).zones.right.size).toBe(432);
		expect(resizeZone(ws, 'right', 5, big).zones.right.size).toBe(160);
		expect(resizeZone(ws, 'bottom', 5000, { w: 1280, h: 720 }).zones.bottom.size).toBe(216);
		expect(resizeZone(ws, 'bottom', 50, big).zones.bottom.size).toBe(96);
		expect(resizeZone(ws, 'right', 264, big)).toBe(ws);
	});
});

describe('peek and pin', () => {
	const collapsed = setZoneCollapsed(defaultWorkspace(), 'right', true);

	it('peeks a rail item and closes the peek', () => {
		const session = peekPanel(INITIAL_SESSION, collapsed, 'history');
		expect(session.peeking).toBe('history');
		expect(closePeek(session).peeking).toBeNull();
		expect(closePeek(INITIAL_SESSION)).toBe(INITIAL_SESSION);
	});

	it('does not peek what is not on a rail', () => {
		expect(peekPanel(INITIAL_SESSION, defaultWorkspace(), 'history')).toBe(INITIAL_SESSION);
		expect(peekPanel(INITIAL_SESSION, collapsed, 'palette')).toBe(INITIAL_SESSION);
		const floating = floatPanel(collapsed, 'history');
		expect(peekPanel(INITIAL_SESSION, floating, 'history')).toBe(INITIAL_SESSION);
	});

	it('does not peek in level-first', () => {
		const hidden = toggleLevelFirst(INITIAL_SESSION);
		expect(peekPanel(hidden, collapsed, 'history')).toBe(hidden);
	});

	it('pins a peeking item into a real dock with that tab showing', () => {
		const peeking = peekPanel(INITIAL_SESSION, collapsed, 'history');
		const pinned = pinPanel(collapsed, peeking, 'history');
		expect(pinned.workspace.zones.right.collapsed).toBe(false);
		expect(pinned.workspace.zones.right.groups[0]!.active).toBe('history');
		expect(pinned.session.peeking).toBeNull();
		const same = pinPanel(collapsed, INITIAL_SESSION, 'nope');
		expect(same.workspace).toBe(collapsed);
	});
});

describe('maximise and level-first', () => {
	it('maximises and restores a panel', () => {
		const ws = defaultWorkspace();
		const full = maximisePanel(INITIAL_SESSION, ws, 'script');
		expect(full.maximised).toBe('script');
		expect(restorePanel(full).maximised).toBeNull();
		expect(restorePanel(INITIAL_SESSION)).toBe(INITIAL_SESSION);
	});

	it('maximises a floating panel but not one in a window or an unknown one', () => {
		const ws = defaultWorkspace();
		expect(maximisePanel(INITIAL_SESSION, floatPanel(ws, 'script'), 'script').maximised).toBe(
			'script',
		);
		expect(maximisePanel(INITIAL_SESSION, sendToWindow(ws, 'script'), 'script')).toBe(
			INITIAL_SESSION,
		);
		expect(maximisePanel(INITIAL_SESSION, ws, 'nope')).toBe(INITIAL_SESSION);
	});

	describe('maximiseDocked', () => {
		const foldedBottom = () => setZoneCollapsed(defaultWorkspace(), 'bottom', true);

		it('unfolds a folded zone, shows the tab and maximises; restore leaves the dock open', () => {
			const ws = foldedBottom();
			const moved = maximiseDocked(ws, INITIAL_SESSION, 'proposals');
			expect(moved.session.maximised).toBe('proposals');
			expect(moved.workspace.zones.bottom.collapsed).toBe(false);
			expect(
				moved.workspace.zones.bottom.groups.find((g) => g.tabs.includes('proposals'))!.active,
			).toBe('proposals');
			expect(ws.zones.bottom.collapsed).toBe(true);
			sound(moved.workspace);
			const back = restorePanel(moved.session);
			expect(back.maximised).toBeNull();
			expect(moved.workspace.zones.bottom.collapsed).toBe(false);
		});

		it('maximises a peeking panel, pinning it and closing the peek', () => {
			const ws = foldedBottom();
			const peeking = peekPanel(INITIAL_SESSION, ws, 'script');
			expect(peeking.peeking).toBe('script');
			const moved = maximiseDocked(ws, peeking, 'script');
			expect(moved.session).toMatchObject({ maximised: 'script', peeking: null });
			expect(moved.workspace.zones.bottom.collapsed).toBe(false);
		});

		it('leaves an already showing panel in an open dock untouched', () => {
			const ws = defaultWorkspace();
			const moved = maximiseDocked(ws, INITIAL_SESSION, 'script');
			expect(moved.workspace).toBe(ws);
			expect(moved.session.maximised).toBe('script');
		});

		it('makes a background tab the showing one', () => {
			const ws = defaultWorkspace();
			const group = ws.zones.bottom.groups.find((g) => g.tabs.includes('proposals'))!;
			expect(group.active).not.toBe('proposals');
			const moved = maximiseDocked(ws, INITIAL_SESSION, 'proposals');
			expect(
				moved.workspace.zones.bottom.groups.find((g) => g.tabs.includes('proposals'))!.active,
			).toBe('proposals');
		});

		it('is idempotent when already maximised', () => {
			const first = maximiseDocked(foldedBottom(), INITIAL_SESSION, 'script');
			const again = maximiseDocked(first.workspace, first.session, 'script');
			expect(again.workspace).toBe(first.workspace);
			expect(again.session.maximised).toBe('script');
		});

		it('refuses a panel in a window, an unknown one and a hidden floating one', () => {
			const ws = defaultWorkspace();
			const windowed = sendToWindow(ws, 'script');
			expect(maximiseDocked(windowed, INITIAL_SESSION, 'script')).toEqual({
				workspace: windowed,
				session: INITIAL_SESSION,
			});
			expect(maximiseDocked(ws, INITIAL_SESSION, 'nope').session).toBe(INITIAL_SESSION);
			const hidden = setPanelVisible(floatPanel(ws, 'script'), 'script', false);
			expect(maximiseDocked(hidden, INITIAL_SESSION, 'script').session).toBe(INITIAL_SESSION);
		});

		it('maximises a visible floating panel without touching the layout', () => {
			const ws = floatPanel(defaultWorkspace(), 'script');
			const moved = maximiseDocked(ws, INITIAL_SESSION, 'script');
			expect(moved.workspace).toBe(ws);
			expect(moved.session.maximised).toBe('script');
		});

		it('keeps a hidden docked panel’s tab and maximises it', () => {
			const ws = setPanelVisible(defaultWorkspace(), 'script', false);
			const moved = maximiseDocked(ws, INITIAL_SESSION, 'script');
			expect(moved.session.maximised).toBe('script');
			sound(moved.workspace);
		});
	});

	it('toggles level-first without touching the layout', () => {
		const ws = floatPanel(defaultWorkspace(), 'history');
		const before = structuredClone(ws);
		const hidden = toggleLevelFirst(INITIAL_SESSION);
		expect(hidden.levelFirst).toBe(true);
		expect(toggleLevelFirst(hidden).levelFirst).toBe(false);
		expect(ws).toEqual(before);
	});

	it('lets go of a maximised or peeking panel that has moved', () => {
		const ws = defaultWorkspace();
		const full = maximisePanel(INITIAL_SESSION, ws, 'script');
		expect(settleSession(full, ws)).toBe(full);
		expect(settleSession(full, sendToWindow(ws, 'script')).maximised).toBeNull();
		const peeking = peekPanel(INITIAL_SESSION, setZoneCollapsed(ws, 'right', true), 'history');
		expect(settleSession(peeking, ws).peeking).toBeNull();
	});
});

describe('setPanelVisible', () => {
	it('hides a docked panel without taking it out of its tab group', () => {
		const ws = setPanelVisible(defaultWorkspace(), 'objects', false);
		expect(ws.panels.objects!.float.visible).toBe(false);
		expect(dockedIn(ws, 'right')).toEqual(['objects', 'history']);
		sound(ws);
	});

	it('shows a hidden docked panel as the showing tab and opens a folded zone', () => {
		let ws = setPanelVisible(defaultWorkspace(), 'history', false);
		ws = setZoneCollapsed(ws, 'right', true);
		ws = setPanelVisible(ws, 'history', true);
		expect(ws.panels.history!.float.visible).toBe(true);
		expect(ws.zones.right.collapsed).toBe(false);
		expect(ws.zones.right.groups[0]!.active).toBe('history');
	});

	it('shows a panel that is already visible by making it the showing tab', () => {
		const ws = setPanelVisible(defaultWorkspace(), 'history', true);
		expect(ws.zones.right.groups[0]!.active).toBe('history');
	});

	it('brings a shown floating panel to the front', () => {
		let ws = floatPanel(defaultWorkspace(), 'palette');
		ws = setPanelVisible(ws, 'palette', false);
		ws = setPanelVisible(ws, 'palette', true);
		const z = Math.max(...Object.values(ws.panels).map((e) => e.float.z));
		expect(ws.panels.palette!.float.z).toBe(z);
		expect(ws.panels.palette!.float.visible).toBe(true);
	});

	it('leaves an unknown panel and an unchanged flag alone', () => {
		const ws = defaultWorkspace();
		expect(setPanelVisible(ws, 'nope', false)).toBe(ws);
		const floating = floatPanel(ws, 'palette');
		expect(setPanelVisible(floating, 'palette', true)).toBe(floating);
	});
});
