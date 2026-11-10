// Tests for checking and repairing a saved dock layout
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import { describe, expect, it } from 'vitest';
import { floatPanel } from './dockLayout';
import {
	PANEL_IDS,
	defaultDock,
	defaultWorkspace,
	defaultWorkspaceFor,
	dockedIn,
	zoneOf,
} from './dockModel';
import {
	createWorkspace,
	normaliseDock,
	normaliseWorkspace,
	resetWorkspace,
	switchWorkspace,
	validateWorkspace,
} from './dockNormalise';

const big = { w: 1440, h: 900 };

function kinds(ws: Workspace, window = big) {
	return validateWorkspace(ws, window).map((p) => p.kind);
}

/** Each panel is docked in exactly one group, or is not docked and in none. */
function exactlyOnce(ws: Workspace) {
	for (const id of PANEL_IDS) {
		const count = Object.values(ws.zones)
			.flatMap((z) => z.groups.flatMap((g) => g.tabs))
			.filter((t) => t === id).length;
		expect(count).toBe(ws.panels[id]!.place === 'docked' ? 1 : 0);
	}
}

describe('validateWorkspace', () => {
	it('accepts the defaults and every shipped workspace', () => {
		expect(kinds(defaultWorkspace())).toEqual([]);
		for (const ws of Object.values(defaultDock().workspaces)) expect(kinds(ws)).toEqual([]);
	});

	it('names each kind of problem', () => {
		const dup = defaultWorkspace();
		dup.zones.left.groups[0]!.tabs.push('objects');
		expect(kinds(dup)).toContain('duplicate-panel');

		const missing = defaultWorkspace();
		delete missing.panels.script;
		expect(kinds(missing)).toContain('missing-panel');

		const unknown = defaultWorkspace();
		unknown.panels.ghost = unknown.panels.palette!;
		expect(kinds(unknown)).toContain('unknown-panel');

		const empty = defaultWorkspace();
		empty.zones.left.groups.push({ tabs: [], active: '' });
		expect(kinds(empty)).toContain('empty-group');

		const active = defaultWorkspace();
		active.zones.right.groups[0]!.active = 'palette';
		expect(kinds(active)).toContain('bad-active');

		const size = defaultWorkspace();
		size.zones.right.size = 900;
		expect(kinds(size)).toContain('size-range');
		expect(kinds(size, { w: 4000, h: 4000 })).not.toContain('size-range');

		const place = floatPanel(defaultWorkspace(), 'palette');
		place.zones.left.groups = [{ tabs: ['palette'], active: 'palette' }];
		expect(kinds(place)).toContain('wrong-place');

		const lost = defaultWorkspace();
		lost.zones.left.groups = [];
		expect(kinds(lost)).toContain('wrong-place');

		const rect = defaultWorkspace();
		rect.panels.palette!.float.w = 0;
		expect(kinds(rect)).toContain('bad-rect');
		const noWindow = defaultWorkspace();
		noWindow.panels.palette!.place = 'window';
		noWindow.zones.left.groups = [];
		expect(kinds(noWindow)).toContain('bad-rect');
	});

	it('checks sizes without a window against the absolute range', () => {
		const ws = defaultWorkspace();
		ws.zones.left.size = 900;
		expect(validateWorkspace(ws)).toEqual([]);
		ws.zones.left.size = 50;
		expect(validateWorkspace(ws).map((p) => p.kind)).toEqual(['size-range']);
	});
});

describe('normaliseWorkspace', () => {
	it('returns a sound layout equal to the input when the input is sound', () => {
		for (const ws of Object.values(defaultDock().workspaces)) {
			expect(normaliseWorkspace(ws, big)).toEqual(ws);
		}
	});

	it('gives the default for garbage and never loses a panel', () => {
		for (const bad of [null, undefined, 7, 'x', [], {}, { panels: 3, zones: [] }]) {
			const ws = normaliseWorkspace(bad, big);
			expect(kinds(ws)).toEqual([]);
			exactlyOnce(ws);
			expect(PANEL_IDS.every((id) => ws.panels[id])).toBe(true);
		}
		expect(normaliseWorkspace({}, big)).toEqual(defaultWorkspace());
		expect(normaliseWorkspace({}, big).tool_picker).toBeNull();
	});

	it('keeps a usable tool picker place, bounds it, and drops one that is not a place', () => {
		const ws = defaultWorkspace();
		expect(normaliseWorkspace({ ...ws, tool_picker: { x: 40, y: 12 } }, big).tool_picker).toEqual({
			x: 40,
			y: 12,
		});
		expect(
			normaliseWorkspace({ ...ws, tool_picker: { x: -5, y: 99_999.4 } }, big).tool_picker,
		).toEqual({ x: 0, y: 20_000 });
		for (const bad of [7, 'x', [], { x: 'a', y: 1 }, { x: 1 }]) {
			expect(normaliseWorkspace({ ...ws, tool_picker: bad }, big).tool_picker).toBeNull();
		}
	});

	it('removes duplicates, unknown panels and empty groups', () => {
		const ws = defaultWorkspace() as unknown as Record<string, any>;
		ws.zones.left.groups.push(
			{ tabs: ['objects', 'ghost'], active: 'ghost' },
			{ tabs: [], active: '' },
		);
		ws.zones.bottom.groups.push({ tabs: 'nope' }, 4);
		const fixed = normaliseWorkspace(ws, big);
		expect(kinds(fixed)).toEqual([]);
		expect(dockedIn(fixed, 'left')).toEqual(['palette', 'layers', 'objects']);
		expect(dockedIn(fixed, 'right')).toEqual(['inspector', 'history']);
		exactlyOnce(fixed);
	});

	it('adds a panel a saved workspace lacks beside the panels already docked in its home zone', () => {
		const ws = defaultWorkspace() as unknown as Record<string, any>;
		delete ws.panels.layers;
		ws.zones.left.groups[0].tabs = ['palette'];
		const fixed = normaliseWorkspace(ws, big);
		expect(kinds(fixed)).toEqual([]);
		expect(dockedIn(fixed, 'left')).toEqual(['palette', 'layers']);
		expect(fixed.panels.layers).toEqual(defaultWorkspace().panels.layers);
	});

	it('repairs an active tab that does not exist', () => {
		const ws = defaultWorkspace();
		ws.zones.right.groups[0]!.active = 'gone';
		expect(normaliseWorkspace(ws, big).zones.right.groups[0]!.active).toBe('inspector');
	});

	it('docks a panel that says docked but is in no group, in its home zone', () => {
		const ws = defaultWorkspace();
		ws.zones.right.groups = [];
		const fixed = normaliseWorkspace(ws, big);
		expect(dockedIn(fixed, 'right').sort()).toEqual(['history', 'inspector', 'objects']);
		exactlyOnce(fixed);
		const emptied = defaultWorkspace();
		emptied.zones.left.groups = [];
		expect(dockedIn(normaliseWorkspace(emptied, big), 'left')).toEqual(['palette', 'layers']);
	});

	it('lets a panel that is not docked leave the groups that still name it', () => {
		const ws = floatPanel(defaultWorkspace(), 'palette');
		ws.zones.left.groups = [{ tabs: ['palette'], active: 'palette' }];
		const fixed = normaliseWorkspace(ws, big);
		expect(zoneOf(fixed, 'palette')).toBeNull();
		expect(fixed.panels.palette!.place).toBe('floating');
		exactlyOnce(fixed);
	});

	it('restores a missing panel to its default place', () => {
		const ws = defaultWorkspace();
		delete ws.panels.script;
		ws.zones.bottom.groups = [{ tabs: ['proposals'], active: 'proposals' }];
		const fixed = normaliseWorkspace(ws, big);
		expect(dockedIn(fixed, 'bottom').sort()).toEqual(['proposals', 'script']);
	});

	it('holds sizes within the caps for the window', () => {
		const ws = defaultWorkspace();
		ws.zones.left.size = 5000;
		ws.zones.bottom.size = 1;
		const fixed = normaliseWorkspace(ws, { w: 1280, h: 720 });
		expect(fixed.zones.left.size).toBe(384);
		expect(fixed.zones.bottom.size).toBe(96);
		expect(normaliseWorkspace(ws).zones.left.size).toBe(4000);
	});

	it('takes defaults for bad numbers, enums and flags', () => {
		const ws = defaultWorkspace() as unknown as Record<string, any>;
		ws.zones.left.size = 'wide';
		ws.zones.left.collapsed = 'yes';
		ws.panels.palette = {
			place: 'sideways',
			home: 'up',
			float: { x: -5, w: 'no', visible: 3, z: -1 },
		};
		const fixed = normaliseWorkspace(ws, big);
		expect(fixed.zones.left.size).toBe(196);
		expect(fixed.zones.left.collapsed).toBe(false);
		expect(fixed.panels.palette).toMatchObject({
			place: 'docked',
			home: 'left',
			float: { x: 0, w: 252, visible: true, z: 0 },
		});
		expect(kinds(fixed)).toEqual([]);
	});

	it('floats a window panel with no window placement in at its rectangle', () => {
		const ws = defaultWorkspace();
		ws.panels.script!.place = 'window';
		ws.zones.bottom.groups = [{ tabs: ['proposals'], active: 'proposals' }];
		const fixed = normaliseWorkspace(ws, big);
		expect(fixed.panels.script!.window).toEqual({ x: 812, y: 8, w: 460, h: 420 });
		expect(kinds(fixed)).toEqual([]);
	});

	it('keeps a window placement, negative coordinates included, and a floating return', () => {
		const ws = defaultWorkspace();
		ws.panels.script = {
			...ws.panels.script!,
			place: 'window',
			window: { x: -1920, y: 40, w: 600, h: 400 },
			window_from: 'floating',
		};
		ws.zones.bottom.groups = [{ tabs: ['proposals'], active: 'proposals' }];
		const fixed = normaliseWorkspace(ws, big);
		expect(fixed.panels.script).toMatchObject({
			window: { x: -1920, y: 40, w: 600, h: 400 },
			window_from: 'floating',
		});
	});

	it('survives random damage with every panel kept exactly once', () => {
		let seed = 7;
		const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
		const junk = () =>
			[null, 1, -3, 1e12, 'left', 'palette', 'ghost', [], {}, true][Math.floor(next() * 10)];
		const damage = (value: unknown, depth: number): unknown => {
			if (Array.isArray(value)) {
				const copy = value.map((v) => damage(v, depth + 1));
				if (next() < 0.3) copy.splice(Math.floor(next() * copy.length), 0, junk());
				if (next() < 0.2) copy.pop();
				return copy;
			}
			if (value && typeof value === 'object') {
				const out: Record<string, unknown> = {};
				for (const [k, v] of Object.entries(value)) {
					if (next() < 0.08) continue;
					out[k] = next() < 0.12 ? junk() : damage(v, depth + 1);
				}
				return out;
			}
			return next() < 0.1 ? junk() : value;
		};
		for (let i = 0; i < 400; i++) {
			const source = Object.values(defaultDock().workspaces)[i % 3]!;
			const fixed = normaliseWorkspace(damage(source, 0), big);
			expect(kinds(fixed)).toEqual([]);
			exactlyOnce(fixed);
			expect(Object.keys(fixed.panels).sort()).toEqual([...PANEL_IDS].sort());
		}
	});
});

describe('the dock and its workspaces', () => {
	it('starts with Paint, Script and Review, Paint active', () => {
		const dock = defaultDock();
		expect(Object.keys(dock.workspaces).sort()).toEqual(['Paint', 'Review', 'Script']);
		expect(dock.active).toBe('Paint');
		expect(normaliseDock(dock, big)).toEqual(dock);
	});

	it('shapes the shipped workspaces as designed', () => {
		const { Paint, Script, Review } = defaultDock().workspaces;
		expect(Paint!.zones.left.collapsed).toBe(false);
		expect(Paint!.zones.right.collapsed || Paint!.zones.bottom.collapsed).toBe(false);
		expect(dockedIn(Script!, 'bottom')).toEqual(['script', 'proposals']);
		expect(Script!.zones.bottom.size).toBeGreaterThan(defaultWorkspace().zones.bottom.size);
		expect(Review!.zones.right.groups[0]!.active).toBe('proposals');
		expect(Review!.zones.right.size).toBeGreaterThan(defaultWorkspace().zones.right.size);
	});

	it('drops empty names and falls back to the defaults when none are left', () => {
		const fixed = normaliseDock({ active: 'x', workspaces: { '': {}, '  ': {} } }, big);
		expect(fixed).toEqual(defaultDock());
		expect(normaliseDock(null, big)).toEqual(defaultDock());
		expect(normaliseDock({ workspaces: { ['__proto__']: {} } }, big)).toEqual(defaultDock());
	});

	it('picks the first workspace when the active one is gone', () => {
		const fixed = normaliseDock({ active: 'Gone', workspaces: { Mine: {}, Other: {} } }, big);
		expect(fixed.active).toBe('Mine');
		expect(fixed.workspaces.Mine).toEqual(defaultWorkspace());
		expect(normaliseDock({ active: 'toString', workspaces: { A: {} } }, big).active).toBe('A');
	});

	it('resets the active workspace to its shipped arrangement, or the fixed default', () => {
		const dock = defaultDock();
		const moved = {
			...dock,
			workspaces: { ...dock.workspaces, Paint: floatPanel(dock.workspaces.Paint!, 'palette') },
		};
		expect(resetWorkspace(moved, big).workspaces.Paint).toEqual(defaultWorkspaceFor('Paint'));
		const custom = createWorkspace(moved, 'Mine');
		const reset = resetWorkspace(floatCustom(custom), big);
		expect(reset.workspaces.Mine).toEqual(defaultWorkspace());
		expect(reset.workspaces.Paint).toEqual(moved.workspaces.Paint);
	});

	it('switches and creates workspaces', () => {
		const dock = defaultDock();
		expect(switchWorkspace(dock, 'Review').active).toBe('Review');
		expect(switchWorkspace(dock, 'Nope')).toBe(dock);
		expect(switchWorkspace(dock, 'toString')).toBe(dock);
		expect(switchWorkspace(dock, 'Paint')).toBe(dock);
		const made = createWorkspace(dock, ' Mine ');
		expect(made.active).toBe('Mine');
		expect(made.workspaces.Mine).toEqual(dock.workspaces.Paint);
		expect(createWorkspace(dock, 'Paint')).toBe(dock);
		expect(createWorkspace(dock, '  ')).toBe(dock);
		expect(createWorkspace(dock, '__proto__')).toBe(dock);
	});
});

function floatCustom(dock: ReturnType<typeof defaultDock>) {
	const current = dock.workspaces[dock.active]!;
	return {
		...dock,
		workspaces: { ...dock.workspaces, [dock.active]: floatPanel(current, 'palette') },
	};
}
