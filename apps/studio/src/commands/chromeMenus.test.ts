// Tests for the chrome's context menus: panel headers, tabs, the commands row, the workspace switcher, the zoom pill and History
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expectEveryItemHasIcon } from '@liminal-hq/fizz-studio-chrome/ContextMenu/expectEveryItemHasIcon';
import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import type { PanelId } from '../panels/float/panelSpecs';
import { NO_FACTS, perPanel, type BridgeSnapshot, type CommandFacts } from './commandBridge';
import { chromeMenuItems } from './chromeMenus';
import { buildContextMenu } from './contextMenuModel';
import { ZONE_IDS } from '../panels/dock/dockModel';
import { panelMenuCommandIds } from './panelMenuModel';

const noop = () => {};

/** Handlers for every command id: a main window with an editor publishes them all. */
function handlersFor(ids: string[]): BridgeSnapshot['handlers'] {
	return Object.fromEntries(ids.map((id) => [id, vi.fn()]));
}

const mainIds = [
	...panelMenuCommandIds('script', false).flat(),
	...panelMenuCommandIds('script', true).flat(),
	'view.panel.script',
	'view.maximise.script',
	'view.restore.script',
	'view.panel.history',
	'script.tab.level.activate',
	'script.tab.level.close',
	'view.toolbar.classic',
	'view.toolbar.ribbon',
	'view.toolbar.hidden',
	'view.menuBar',
	'view.ribbon.fold',
	'workspace.paint',
	'workspace.script',
	'workspace.review',
	'view.zoomIn',
	'view.zoomOut',
	'view.zoomFit',
	'edit.undo',
	'edit.redo',
	'view.commandPalette',
	'view.panel.script.tearOff',
	'view.panel.script.dockBack',
	...ZONE_IDS.map((zone) => `panel.history.dock.${zone}`),
];

function snapshot(
	facts: Partial<CommandFacts> = {},
	handlers: BridgeSnapshot['handlers'] = handlersFor(mainIds),
): BridgeSnapshot {
	return {
		facts: {
			...NO_FACTS,
			editorOpen: true,
			hasLevel: true,
			panels: { ...perPanel(true) },
			placeOf: { ...perPanel<CommandFacts['placeOf'][PanelId]>('left') },
			...facts,
		},
		handlers,
	};
}

const labels = (items: MenuItem[]) =>
	items.map((item) => (item.type === 'separator' ? '-' : 'label' in item ? item.label : ''));
const find = (items: MenuItem[], id: string) => items.find((item) => item.id === id);

describe('a panel header, rail button or tab', () => {
	it('is the panel menu, then Maximise and Hide', () => {
		const items = chromeMenuItems({ kind: 'panel', panel: 'script', where: 'header' }, snapshot());
		expect(labels(items)).toEqual([
			'Dock left',
			'Dock right',
			'Dock bottom',
			'Float',
			'-',
			'Tear off',
			'-',
			'Reset layout',
			'-',
			'Maximise Script',
			'Hide Script',
		]);
		expectEveryItemHasIcon(items);
	});

	it.each(['header', 'rail', 'tab'] as const)('is the same menu from the %s', (where) => {
		const here = chromeMenuItems({ kind: 'panel', panel: 'script', where }, snapshot());
		const header = chromeMenuItems({ kind: 'panel', panel: 'script', where: 'header' }, snapshot());
		expect(labels(here)).toEqual(labels(header));
	});

	it('offers Restore, not Maximise, on the panel that fills the workspace', () => {
		const items = chromeMenuItems(
			{ kind: 'panel', panel: 'script', where: 'header' },
			snapshot({ maximised: 'script' }),
		);
		expect(labels(items)).toContain('Restore Script');
		expect(labels(items)).not.toContain('Maximise Script');
	});

	it('offers Dock back in place of Tear off for a panel in its own window', () => {
		const items = chromeMenuItems(
			{ kind: 'panel', panel: 'script', where: 'rail' },
			snapshot({ away: { ...perPanel(false), script: true } }),
		);
		expect(labels(items)).toContain('Dock back');
		expect(labels(items)).not.toContain('Tear off');
	});

	it('leaves Maximise out for a panel that cannot fill the workspace', () => {
		const items = chromeMenuItems({ kind: 'panel', panel: 'history', where: 'header' }, snapshot());
		expect(labels(items).some((label) => label.startsWith('Maximise'))).toBe(false);
		expect(labels(items)).toContain('Hide History');
	});

	it("is only Dock back in the panel's own window, which cannot place or hide it", () => {
		const items = chromeMenuItems(
			{ kind: 'panel', panel: 'script', where: 'header' },
			snapshot(
				{ away: { ...perPanel(false), script: true } },
				{ 'view.panel.script.dockBack': noop },
			),
		);
		expect(labels(items)).toEqual(['Dock back']);
	});
});

describe('the script tab', () => {
	it('shows or closes the tab, then tears the panel off', () => {
		const items = chromeMenuItems({ kind: 'scriptTab' }, snapshot());
		expect(labels(items)).toEqual([
			'Show the level script tab',
			'Close the level script tab',
			'-',
			'Tear off',
		]);
		expectEveryItemHasIcon(items);
	});

	it("is Dock back alone in the panel's own window", () => {
		const items = chromeMenuItems(
			{ kind: 'scriptTab' },
			snapshot(
				{ away: { ...perPanel(false), script: true } },
				{ 'script.tab.level.close': noop, 'view.panel.script.dockBack': noop },
			),
		);
		expect(labels(items)).toEqual(['Close the level script tab', '-', 'Dock back']);
	});
});

describe('the commands row', () => {
	it('is the toolbar choice, then the menu bar and the ribbon fold', () => {
		const items = chromeMenuItems(
			{ kind: 'commandsRow', row: 'toolbar' },
			snapshot({ toolbar: 'ribbon' }),
		);
		expect(labels(items)).toEqual([
			'Toolbar',
			'Ribbon',
			'Hide the toolbar and ribbon',
			'-',
			'Menu bar',
			'Fold the ribbon',
		]);
		expect(find(items, 'view.toolbar.ribbon')).toMatchObject({ checked: true });
		expectEveryItemHasIcon(items);
	});

	it('leaves the ribbon fold out of the classic toolbar', () => {
		const items = chromeMenuItems(
			{ kind: 'commandsRow', row: 'toolbar' },
			snapshot({ toolbar: 'classic' }),
		);
		expect(find(items, 'view.ribbon.fold')).toBeUndefined();
	});
});

describe('the workspace switcher', () => {
	it('lists the workspaces with the current one ticked, then Reset layout', () => {
		const items = chromeMenuItems(
			{ kind: 'workspace' },
			snapshot({ workspace: { active: 'Paint', names: ['Paint', 'Script', 'Review'] } }),
		);
		expect(labels(items)).toEqual(['Paint', 'Script', 'Review', '-', 'Reset layout']);
		expect(find(items, 'workspace.paint')).toMatchObject({ checked: true, disabled: true });
		expect(find(items, 'workspace.script')).toMatchObject({ checked: false });
		expectEveryItemHasIcon(items);
	});
});

describe('the zoom pill', () => {
	it('is zoom in, out and fit, with the reason a limit gives', () => {
		const items = chromeMenuItems(
			{ kind: 'zoom' },
			snapshot({ zoom: { level: 16, canIn: false, canOut: true } }),
		);
		expect(labels(items)).toEqual(['Zoom in', 'Zoom out', 'Fit level']);
		const zoomIn = find(items, 'view.zoomIn');
		expect(zoomIn).toMatchObject({ disabled: true });
		expect(zoomIn && 'title' in zoomIn ? zoomIn.title : '').toMatch(/zoom|largest|maximum/i);
		expectEveryItemHasIcon(items);
	});

	it('has no menu before the canvas has published its zoom', () => {
		expect(chromeMenuItems({ kind: 'zoom' }, snapshot({ zoom: null }))).toEqual([]);
	});
});

describe('History', () => {
	it('is the Undo history menu the application menu builds', () => {
		const items = chromeMenuItems(
			{ kind: 'history' },
			snapshot({ canUndo: true, undoName: 'Paint grass' }),
		);
		expect(labels(items)[0]).toBe('Paint grass');
		expectEveryItemHasIcon(items);
	});
});

describe('the tool picker and the Palette', () => {
	it('have no menu yet', () => {
		expect(chromeMenuItems({ kind: 'tools' }, snapshot())).toEqual([]);
		expect(buildContextMenu({ kind: 'tools' }, snapshot())).toEqual([]);
	});
});
