// Tests for docking a panel back exactly where it left, route by route
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import { describe, expect, it } from 'vitest';
import { dropOnZone } from './dockDrop';
import { rememberHome } from './dockHome';
import {
	activateTab,
	bringBack,
	dockBack,
	dockPanel,
	dockToZone,
	floatPanel,
	reorderTab,
	sendToWindow,
	setPanelVisible,
	setZoneCollapsed,
} from './dockLayout';
import { defaultWorkspaceFor, dockedIn } from './dockModel';
import { normaliseWorkspace, validateWorkspace } from './dockNormalise';
import { withAwayTabs } from '../windows/awayTabs';

const big = { w: 1440, h: 900 };
const workspaces = ['Paint', 'Script', 'Review'] as const;

function sound(ws: Workspace) {
	expect(validateWorkspace(ws, big)).toEqual([]);
}

/** Where a panel is, in the terms the owner checks: zone, group, tab index, whether it shows. */
function whereIs(ws: Workspace, id: string) {
	for (const zone of ['left', 'right', 'bottom'] as const) {
		const groups = ws.zones[zone].groups;
		const group = groups.findIndex((g) => g.tabs.includes(id));
		if (group >= 0) {
			return {
				zone,
				group,
				index: groups[group]!.tabs.indexOf(id),
				active: groups[group]!.active === id,
				folded: ws.zones[zone].collapsed,
			};
		}
	}
	return null;
}

/** The panels that have a neighbour to remember in each shipped workspace. */
const CASES: [string, string][] = [
	['palette', 'left'],
	['layers', 'left'],
	['inspector', 'right'],
	['objects', 'right'],
	['history', 'right'],
];

describe('float then dock back', () => {
	for (const name of workspaces) {
		for (const [id] of CASES) {
			it(`${id} returns to its tab in the ${name} workspace`, () => {
				let ws = defaultWorkspaceFor(name);
				// Make each panel in turn the showing one, so both active and not-active are met.
				for (const showing of [id, dockedIn(ws, ws.panels[id]!.home)[0]!]) {
					ws = activateTab(ws, showing);
					const before = whereIs(ws, id);
					if (!before) continue;
					const back = dockBack(floatPanel(ws, id), id);
					expect(whereIs(back, id)).toEqual(before);
					expect(dockedIn(back, before.zone)).toEqual(dockedIn(ws, before.zone));
					sound(back);
				}
			});
		}
	}

	it('keeps Palette first and Layers second, and the showing tab', () => {
		const ws = activateTab(defaultWorkspaceFor('Paint'), 'layers');
		const out = floatPanel(ws, 'palette');
		expect(dockedIn(out, 'left')).toEqual(['layers']);
		const back = dockBack(out, 'palette');
		expect(dockedIn(back, 'left')).toEqual(['palette', 'layers']);
		// Layers was showing when Palette left, so Layers is still the showing tab.
		expect(back.zones.left.groups[0]!.active).toBe('layers');
	});

	it('puts History before Objects and Objects after Inspector when they leave', () => {
		const ws = defaultWorkspaceFor('Paint');
		const out = floatPanel(floatPanel(ws, 'objects'), 'history');
		expect(dockedIn(out, 'right')).toEqual(['inspector']);
		// They return in the other order: each goes by its own neighbours, and ends up as it was.
		const back = dockBack(dockBack(out, 'history'), 'objects');
		expect(dockedIn(back, 'right')).toEqual(['inspector', 'objects', 'history']);
	});

	it('forgets nothing the old way would: the record is cleared once used', () => {
		const out = floatPanel(defaultWorkspaceFor('Paint'), 'layers');
		expect(out.panels.layers!.home_spot).not.toBeNull();
		expect(dockBack(out, 'layers').panels.layers!.home_spot).toBeNull();
	});
});

describe('tear off then bring back', () => {
	for (const name of workspaces) {
		it(`restores every panel of the ${name} workspace`, () => {
			const ws = defaultWorkspaceFor(name);
			for (const [id] of CASES) {
				const before = whereIs(ws, id)!;
				const back = bringBack(sendToWindow(ws, id), id);
				expect(whereIs(back, id)).toEqual(before);
				sound(back);
			}
		});
	}

	it('docked, floated, torn off, brought back to floating, then docked back, keeps the place', () => {
		const ws = activateTab(defaultWorkspaceFor('Paint'), 'objects');
		const before = whereIs(ws, 'objects');
		const floated = floatPanel(ws, 'objects');
		const torn = sendToWindow(floated, 'objects');
		expect(torn.panels.objects!.window_from).toBe('floating');
		const floatingAgain = bringBack(torn, 'objects');
		expect(floatingAgain.panels.objects!.place).toBe('floating');
		expect(whereIs(dockBack(floatingAgain, 'objects'), 'objects')).toEqual(before);
	});

	it('docked, torn off from the dock and brought back, returns by Dock back as well', () => {
		const ws = defaultWorkspaceFor('Paint');
		const out = sendToWindow(ws, 'history');
		expect(whereIs(dockBack(out, 'history'), 'history')).toEqual(whereIs(ws, 'history'));
	});
});

describe('drag out then back', () => {
	it('floating at a drop rectangle, then Dock back, returns to the tab', () => {
		const ws = defaultWorkspaceFor('Paint');
		const out = floatPanel(ws, 'layers', { x: 100, y: 100 });
		expect(whereIs(dockBack(out, 'layers'), 'layers')).toEqual(whereIs(ws, 'layers'));
	});

	it('a drop on a specific dock and tab is explicit and wins over the remembered home', () => {
		const ws = defaultWorkspaceFor('Paint');
		const out = floatPanel(ws, 'layers');
		const dropped = dropOnZone(out, 'layers', 'right', 0, 1);
		expect(whereIs(dropped, 'layers')).toMatchObject({ zone: 'right', group: 0, index: 1 });
		sound(dropped);
		expect(dropped.panels.layers!.home_spot).toBeNull();
	});

	it('a torn-off panel let go over the level returns to its remembered tab', () => {
		const ws = defaultWorkspaceFor('Paint');
		const out = sendToWindow(ws, 'objects');
		expect(whereIs(bringBack(out, 'objects'), 'objects')).toEqual(whereIs(ws, 'objects'));
	});
});

describe('moved between zones then back', () => {
	it('remembers the zone it last sat in, not the first', () => {
		let ws = defaultWorkspaceFor('Paint');
		ws = dockPanel(ws, 'layers', 'bottom');
		const before = whereIs(ws, 'layers');
		expect(before!.zone).toBe('bottom');
		const back = dockBack(floatPanel(ws, 'layers'), 'layers');
		expect(whereIs(back, 'layers')).toEqual(before);
		expect(dockedIn(back, 'left')).toEqual(['palette']);
	});

	it('docking a floating panel to a zone by menu replaces a remembered place', () => {
		const ws = floatPanel(defaultWorkspaceFor('Paint'), 'layers');
		const docked = dockPanel(ws, 'layers', 'right');
		expect(docked.panels.layers!.home).toBe('right');
		expect(docked.panels.layers!.home_spot).toBeNull();
	});
});

describe('while it is away', () => {
	it('reordering while away: it follows the tab it sat after', () => {
		const ws = defaultWorkspaceFor('Paint');
		// History sat after Objects. While it is away Objects moves to the front.
		let out = floatPanel(ws, 'history');
		out = reorderTab(out, 'objects', 0);
		expect(dockedIn(out, 'right')).toEqual(['objects', 'inspector']);
		const back = dockBack(out, 'history');
		expect(dockedIn(back, 'right')).toEqual(['objects', 'history', 'inspector']);
	});

	it('a neighbour that left: the other neighbour is used', () => {
		const ws = defaultWorkspaceFor('Paint');
		// Objects sat between Inspector and History.
		let out = floatPanel(ws, 'objects');
		out = floatPanel(out, 'inspector');
		expect(dockedIn(out, 'right')).toEqual(['history']);
		const back = dockBack(out, 'objects');
		// Its "after" (Inspector) is gone; it goes before History, its "before".
		expect(dockedIn(back, 'right')).toEqual(['objects', 'history']);
		sound(back);
	});

	it('both neighbours moved to another zone: the group at its old index, at its old end', () => {
		const ws = defaultWorkspaceFor('Paint');
		let out = floatPanel(ws, 'objects');
		out = dockPanel(out, 'inspector', 'bottom');
		out = dockPanel(out, 'history', 'bottom');
		// The right zone is now empty: it is recreated.
		const back = dockBack(out, 'objects');
		expect(dockedIn(back, 'right')).toEqual(['objects']);
		sound(back);
		// With another panel there instead, it joins that group.
		let out2 = floatPanel(ws, 'objects');
		out2 = dockPanel(out2, 'inspector', 'bottom');
		const back2 = dockBack(out2, 'objects');
		expect(dockedIn(back2, 'right')).toEqual(['objects', 'history']);
	});

	it('the group was emptied and the zone has other groups: it gets a group of its own at its index', () => {
		let ws = defaultWorkspaceFor('Paint');
		// A second group on the right, holding History alone, after the first group.
		ws = dockPanel(ws, 'history', 'right', { alone: true, group: 1 });
		expect(ws.zones.right.groups.length).toBe(2);
		const out = floatPanel(ws, 'history');
		expect(ws.panels.history!.home_spot).toBeNull();
		expect(out.panels.history!.home_spot).toMatchObject({ group: 1, after: null, before: null });
		const back = dockBack(out, 'history');
		expect(back.zones.right.groups.map((g) => g.tabs)).toEqual([
			['inspector', 'objects'],
			['history'],
		]);
		sound(back);
		// If the first group has gone meanwhile, the index is clamped: a group of its own at the end.
		let gone = floatPanel(floatPanel(floatPanel(ws, 'history'), 'inspector'), 'objects');
		gone = dockPanel(gone, 'script', 'right');
		const back2 = dockBack(gone, 'history');
		expect(dockedIn(back2, 'right').includes('history')).toBe(true);
		sound(back2);
	});

	it('the zone is empty: it is recreated at its remembered size and fold', () => {
		let ws = defaultWorkspaceFor('Script'); // the left zone is folded in Script
		ws = { ...ws, zones: { ...ws.zones, left: { ...ws.zones.left, size: 222 } } };
		// Remove Layers first so Palette is the only one.
		let out = floatPanel(ws, 'layers');
		out = floatPanel(out, 'palette');
		expect(out.zones.left.groups).toEqual([]);
		// Meanwhile the zone is resized, as an empty zone's size may be reset.
		out = { ...out, zones: { ...out.zones, left: { ...out.zones.left, size: 400 } } };
		const back = dockBack(out, 'palette');
		expect(dockedIn(back, 'left')).toEqual(['palette']);
		expect(back.zones.left).toMatchObject({ collapsed: true, size: 222 });
		sound(back);
	});

	it('the only panel in a zone returns it at the size and fold it had', () => {
		let ws = defaultWorkspaceFor('Review'); // bottom holds Script alone, folded, 180
		ws = { ...ws, zones: { ...ws.zones, bottom: { ...ws.zones.bottom, size: 150 } } };
		const out = floatPanel(ws, 'script');
		expect(out.panels.script!.home_spot).toMatchObject({ size: 150, folded: true });
		const resized = { ...out, zones: { ...out.zones, bottom: { ...out.zones.bottom, size: 300 } } };
		const back = dockBack(resized, 'script');
		expect(back.zones.bottom).toMatchObject({ size: 150, collapsed: true });
		sound(back);
	});

	it('a remembered size outside the limits is clamped', () => {
		const out = floatPanel(defaultWorkspaceFor('Review'), 'script');
		out.panels.script!.home_spot!.size = 1;
		expect(dockBack(out, 'script').zones.bottom.size).toBe(96);
		out.panels.script!.home_spot!.size = 99_999;
		expect(dockBack(out, 'script').zones.bottom.size).toBe(4_000);
	});

	it('a hidden floating panel is still docked back where it left', () => {
		const ws = defaultWorkspaceFor('Paint');
		const hidden = setPanelVisible(floatPanel(ws, 'layers'), 'layers', false);
		expect(whereIs(dockBack(hidden, 'layers'), 'layers')).toEqual(whereIs(ws, 'layers'));
	});
});

describe('the fold', () => {
	it('a folded zone that has other panels stays folded when the panel comes back', () => {
		let ws = defaultWorkspaceFor('Script'); // left folded
		const before = whereIs(ws, 'layers');
		const out = floatPanel(ws, 'layers');
		ws = dockBack(out, 'layers');
		expect(whereIs(ws, 'layers')).toEqual(before);
		expect(ws.zones.left.collapsed).toBe(true);
	});

	it('a zone the person unfolded while it was away stays unfolded', () => {
		const out = floatPanel(defaultWorkspaceFor('Script'), 'layers');
		const opened = setZoneCollapsed(out, 'left', false);
		expect(dockBack(opened, 'layers').zones.left.collapsed).toBe(false);
	});

	it('a folded zone that was emptied is recreated folded', () => {
		let ws = defaultWorkspaceFor('Script');
		ws = floatPanel(floatPanel(ws, 'layers'), 'palette');
		expect(ws.panels.palette!.home_spot!.folded).toBe(true);
		const back = dockBack(ws, 'palette');
		expect(back.zones.left.collapsed).toBe(true);
	});
});

describe('the away marker', () => {
	it('sits where the panel left, not at the end', () => {
		const ws = defaultWorkspaceFor('Paint');
		const out = sendToWindow(ws, 'inspector');
		const marked = withAwayTabs(out);
		expect(dockedIn(marked, 'right')).toEqual(['inspector', 'objects', 'history']);
	});

	it('goes to the end of the last group when nothing is remembered', () => {
		const ws = sendToWindow(defaultWorkspaceFor('Paint'), 'inspector');
		ws.panels.inspector!.home_spot = null;
		expect(dockedIn(withAwayTabs(ws), 'right')).toEqual(['objects', 'history', 'inspector']);
	});
});

describe('an old settings file', () => {
	it('with no record docks back at the end of the zone, as it always did', () => {
		const out = sendToWindow(defaultWorkspaceFor('Paint'), 'palette');
		out.panels.palette!.home_spot = null;
		const back = dockBack(out, 'palette');
		expect(dockedIn(back, 'left')).toEqual(['layers', 'palette']);
		expect(back.zones.left.groups[0]!.active).toBe('palette');
		sound(back);
	});

	it('normalising a panel entry without the field gives no record', () => {
		const ws = defaultWorkspaceFor('Paint') as unknown as {
			panels: Record<string, Record<string, unknown>>;
		};
		for (const entry of Object.values(ws.panels)) delete entry.home_spot;
		const fixed = normaliseWorkspace(ws, big);
		expect(fixed.panels.layers!.home_spot).toBeNull();
		sound(fixed);
	});

	it('keeps a sound record and drops an unsound one', () => {
		const out = floatPanel(defaultWorkspaceFor('Paint'), 'objects');
		const again = normaliseWorkspace(structuredClone(out), big);
		expect(again.panels.objects!.home_spot).toEqual(out.panels.objects!.home_spot);
		const bad = structuredClone(out);
		bad.panels.objects!.home_spot!.zone = 'bottom';
		expect(normaliseWorkspace(bad, big).panels.objects!.home_spot).toBeNull();
		const odd = structuredClone(out) as unknown as {
			panels: { objects: { home_spot: Record<string, unknown> } };
		};
		odd.panels.objects.home_spot.after = 'nonsense';
		odd.panels.objects.home_spot.group = 9_999;
		const repaired = normaliseWorkspace(odd, big).panels.objects!.home_spot!;
		expect(repaired.after).toBeNull();
		expect(repaired.group).toBe(64);
	});
});

describe('rememberHome', () => {
	it('is null for a panel that is not docked', () => {
		expect(rememberHome(floatPanel(defaultWorkspaceFor('Paint'), 'layers'), 'layers')).toBeNull();
	});

	it('records the neighbours, the showing tab and no size for a crowded zone', () => {
		const ws = activateTab(defaultWorkspaceFor('Paint'), 'objects');
		expect(rememberHome(ws, 'objects')).toEqual({
			zone: 'right',
			group: 0,
			after: 'inspector',
			before: 'history',
			active: true,
			folded: false,
			size: null,
		});
	});
});

describe('Dock left, right or bottom from a panel menu', () => {
	it('the zone it left puts a floating panel back at its place', () => {
		const ws = activateTab(defaultWorkspaceFor('Paint'), 'objects');
		const out = floatPanel(ws, 'objects');
		expect(whereIs(dockToZone(out, 'objects', 'right'), 'objects')).toEqual(whereIs(ws, 'objects'));
	});

	it('the zone it left puts a torn-off panel back at its place', () => {
		const ws = defaultWorkspaceFor('Paint');
		const out = sendToWindow(ws, 'history');
		expect(whereIs(dockToZone(out, 'history', 'right'), 'history')).toEqual(whereIs(ws, 'history'));
	});

	it('another zone is an explicit choice and takes the default place there', () => {
		const out = floatPanel(defaultWorkspaceFor('Paint'), 'history');
		const docked = dockToZone(out, 'history', 'left');
		expect(dockedIn(docked, 'left')).toEqual(['palette', 'layers', 'history']);
		expect(docked.panels.history!.home_spot).toBeNull();
	});
});
