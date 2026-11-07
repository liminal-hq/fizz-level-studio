// Tests for the ribbon model: the layout filled in from the registry, and the contextual Script tab
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { visibleTabs } from '@liminal-hq/fizz-studio-ribbon/visibleTabs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { PANEL_SPECS } from '../panels/float/panelSpecs';
import { NO_FACTS, perPanel, type BridgeSnapshot } from './commandBridge';
import { allCommands } from './registry';
import { RIBBON_TABS } from './ribbonLayout';
import { buildRibbon, contextualTabs } from './ribbonModel';

/** Every command a ribbon item can run has a handler, as the editor publishes them. */
function handlersFor(facts: BridgeSnapshot['facts']): BridgeSnapshot['handlers'] {
	return Object.fromEntries(allCommands(facts).map((def) => [def.id, () => {}]));
}
const snapshot = (facts: Partial<BridgeSnapshot['facts']> = {}): BridgeSnapshot => {
	const merged = {
		...NO_FACTS,
		hasLevel: true,
		editorOpen: true,
		panels: perPanel(true),
		brush: { group: 'tile', kind: 'grass' } as const,
		tool: 'paint' as const,
		workspace: { active: 'Paint', names: ['Paint', 'Review', 'Script'] },
		zoom: { level: 4, canIn: true, canOut: true },
		...facts,
	};
	return { facts: merged, handlers: handlersFor(merged) };
};

const tab = (model: ReturnType<typeof buildRibbon>, id: string) =>
	model.tabs.find((candidate) => candidate.id === id)!;
const labelsOf = (group: { items?: { label: string }[] }) => group.items?.map((i) => i.label);

describe('buildRibbon', () => {
	it('has Home, Level, View and the contextual Script tab, named from the catalogue', () => {
		const model = buildRibbon(snapshot());
		expect(model.tabs.map((entry) => entry.label)).toEqual(['Home', 'Level', 'View', 'Script']);
		expect(tab(model, 'script').contextual).toBe(true);
		expect(tab(model, 'home').contextual).toBeUndefined();
	});

	it('puts the files, the history, the tools and the brush on Home, with the keys', () => {
		const home = tab(buildRibbon(snapshot()), 'home');
		expect(home.groups.map((group) => group.label)).toEqual(['File', 'History', 'Tools', 'Brush']);
		expect(labelsOf(home.groups[0]!)).toEqual(['New level…', 'Open level…', 'Save', 'Close level']);
		expect(labelsOf(home.groups[1]!)).toEqual(['Undo', 'Redo']);
		expect(labelsOf(home.groups[2]!)).toEqual([
			'Paint',
			'Erase',
			'Pick',
			'Select',
			'Stamp',
			'Inspect',
		]);
		const paint = home.groups[2]!.items!.find((item) => item.id === 'tool.paint')!;
		expect(paint).toMatchObject({ size: 'large', kind: 'toggle', active: true, key: 'B' });
	});

	it('lights the tool in use and no other', () => {
		const lit = (tool: 'erase' | 'paint') =>
			tab(buildRibbon(snapshot({ tool })), 'home')
				.groups[2]!.items!.filter((item) => item.active)
				.map((item) => item.id);
		expect(lit('erase')).toEqual(['tool.erase']);
		expect(lit('paint')).toEqual(['tool.paint']);
	});

	it('names the brush on its button', () => {
		const brush = tab(buildRibbon(snapshot()), 'home').groups[3]!.items![0]!;
		expect(brush).toMatchObject({ id: 'panel.palette.show', label: 'Brush: grass' });
		expect(brush.icon).toBeTypeOf('function');
	});

	it('gives the View tab zoom, a toggle for each panel, the layout, the chrome and the workspaces', () => {
		const view = tab(buildRibbon(snapshot()), 'view');
		expect(view.groups.map((group) => group.label)).toEqual([
			'Zoom',
			'Panels',
			'Layout',
			'Window',
			'Workspaces',
		]);
		expect(labelsOf(view.groups[0]!)).toEqual(['Zoom out', 'Zoom in', 'Fit level']);
		expect(view.groups[1]!.items!.map((item) => item.id)).toEqual(
			PANEL_SPECS.map((spec) => `view.panel.${spec.id}`),
		);
		expect(view.groups[1]!.items!.every((item) => item.kind === 'toggle' && item.active)).toBe(
			true,
		);
		expect(labelsOf(view.groups[3]!)).toEqual(['Menu bar', 'Toolbar', 'Ribbon']);
		expect(labelsOf(view.groups[4]!)).toEqual(['Paint', 'Script', 'Review']);
		expect(view.groups[4]!.items!.find((item) => item.label === 'Paint')).toMatchObject({
			active: true,
		});
	});

	it('shows no zoom group until the canvas reports its zoom (the ribbon drops an empty group)', () => {
		const model = buildRibbon(snapshot({ zoom: null }));
		const view = visibleTabs(model, 'expert').find((entry) => entry.id === 'view')!;
		expect(view.groups.map((group) => group.label)).not.toContain('Zoom');
	});

	it('offers the file commands in the File button’s menu', () => {
		const { file } = buildRibbon(snapshot());
		expect(file?.label).toBe('File');
		expect(file?.items?.map(([id]) => id)).toEqual([
			'file.new',
			'file.open',
			'file.save',
			'file.close',
			'file.preferences',
			'file.quit',
		]);
	});

	it('has an item for no command that does not exist, and drops what that leaves empty', () => {
		const model = buildRibbon(snapshot());
		const known = new Set(allCommands(snapshot().facts).map((def) => def.id));
		for (const entry of model.tabs) {
			for (const group of entry.groups) {
				for (const item of group.items ?? []) expect(known.has(item.id), item.id).toBe(true);
			}
		}
		// Layers has no panel yet, so the Level tab shows only Checks; every layout id is a string.
		expect(
			tab(model, 'level')
				.groups.filter((group) => group.items?.length)
				.map((g) => g.label),
		).toEqual(['Checks']);
		expect(RIBBON_TABS.every((entry) => entry.groups.length > 0)).toBe(true);
	});

	it('dims an item for a command that cannot run, with its reason in the tooltip', () => {
		const model = buildRibbon(snapshot({ canUndo: false }));
		const undo = tab(model, 'home').groups[1]!.items![0]!;
		expect(undo).toMatchObject({ disabled: true, desc: 'Nothing to undo', key: 'Ctrl+Z' });
	});
});

describe('contextualTabs and visibleTabs', () => {
	it('shows the Script tab while the Script panel is the one in use, and not otherwise', () => {
		expect(contextualTabs(snapshot({ focusedPanel: 'script' }))).toEqual(['script']);
		expect(contextualTabs(snapshot({ focusedPanel: 'history' }))).toEqual([]);
		expect(contextualTabs(snapshot({ focusedPanel: null }))).toEqual([]);
		expect(contextualTabs(snapshot({ focusedPanel: 'script', panels: perPanel(false) }))).toEqual(
			[],
		);
		const model = buildRibbon(snapshot());
		const shown = (ids: string[]) => visibleTabs(model, 'expert', ids).map((entry) => entry.id);
		expect(shown([])).not.toContain('script');
		expect(shown(['script'])).toContain('script');
	});

	it('has Problems and Tabs on the Script tab, with Tear off or Dock back as the panel allows', () => {
		const script = (away: boolean) =>
			tab(
				buildRibbon(snapshot({ away: { ...perPanel(false), script: away } })),
				'script',
			).groups.map((group) => labelsOf(group));
		expect(script(false)).toEqual([
			['Show the Script and its problems'],
			['Close the level script tab', 'Tear off Script'],
		]);
		expect(script(true)[1]).toEqual(['Close the level script tab', 'Dock Script back']);
	});
});
