// Tests for the toolbar model: its groups, how each command becomes a button and the panel toggles
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { NO_FACTS, perPanel, type BridgeSnapshot } from './commandBridge';
import { allCommands, viewOf } from './registry';
import { buildToolbar, commandItem, commandItems, panelToggles } from './toolbarModel';

const snapshot = (
	facts: Partial<BridgeSnapshot['facts']> = {},
	handlers: BridgeSnapshot['handlers'] = {},
): BridgeSnapshot => ({
	facts: { ...NO_FACTS, hasLevel: true, editorOpen: true, ...facts },
	handlers,
});
const all = Object.fromEntries(
	[
		'file.new',
		'file.open',
		'file.save',
		'file.close',
		'edit.undo',
		'edit.redo',
		...['palette', 'objects', 'history', 'proposals', 'script'].map((id) => `view.panel.${id}`),
	].map((id) => [id, () => {}]),
);

describe('buildToolbar', () => {
	it('is the files, then the history, as groups of buttons named after their commands', () => {
		const model = buildToolbar(snapshot({}, all));
		expect(model.groups.map((group) => group.map((item) => item.id))).toEqual([
			['file.new', 'file.open', 'file.save', 'file.close'],
			['edit.undo', 'edit.redo'],
		]);
		expect(model.groups[0]!.map((item) => item.label)).toEqual([
			'New level…',
			'Open level…',
			'Save',
			'Close level',
		]);
	});

	it('draws each button’s icon from the one icon set, at the size asked', () => {
		const [save] = buildToolbar(snapshot({}, all)).groups[0]!.slice(2);
		expect(save!.icon).toBeTypeOf('function');
		expect(save!.d).toBeUndefined();
		expect((save!.icon!(14) as { props: { size: number } }).props.size).toBe(14);
	});

	it('shows the keys of a command in its tooltip, and why one cannot run', () => {
		const model = buildToolbar(snapshot({}, all));
		const byId = (id: string) => model.groups.flat().find((item) => item.id === id)!;
		expect(byId('file.save')).toMatchObject({ key: 'Ctrl+S' });
		expect(byId('file.save')).not.toHaveProperty('disabled');
		expect(byId('edit.undo')).toMatchObject({
			key: 'Ctrl+Z',
			disabled: true,
			desc: 'Nothing to undo',
		});
	});

	it('enables Undo and Redo when the history has steps', () => {
		const model = buildToolbar(snapshot({ canUndo: true, canRedo: true }, all));
		for (const id of ['edit.undo', 'edit.redo']) {
			expect(model.groups.flat().find((item) => item.id === id)).not.toHaveProperty('disabled');
		}
	});

	it('dims what nothing can do, such as Save with no handler', () => {
		const model = buildToolbar(snapshot({}, { 'file.new': () => {} }));
		expect(model.groups.flat().find((item) => item.id === 'file.save')).toMatchObject({
			disabled: true,
		});
	});
});

describe('commandItem and commandItems', () => {
	it('leaves out a command with no toolbar icon, and one that is not visible', () => {
		const snap = snapshot({}, all);
		const find = (id: string) => allCommands(snap.facts).find((def) => def.id === id)!;
		expect(commandItem(viewOf(find('help.about'), snap))).toBeNull();
		expect(commandItem(viewOf(find('view.panel.script'), { ...snap, facts: NO_FACTS }))).toBeNull();
		expect(commandItems(snap, ['help.about', 'file.save']).map((item) => item.id)).toEqual([
			'file.save',
		]);
	});

	it('makes a command with a checked state a toggle, and a large button when asked', () => {
		const snap = snapshot({ panels: { ...perPanel(false), script: true } }, all);
		const [script] = commandItems(snap, ['view.panel.script'], { large: true });
		expect(script).toMatchObject({ kind: 'toggle', active: true, size: 'large' });
	});
});

describe('panelToggles', () => {
	it('is one toggle for each panel, pressed while the panel shows', () => {
		const toggles = panelToggles(snapshot({ panels: { ...perPanel(false), history: true } }, all));
		expect(toggles.map((toggle) => toggle.label)).toEqual([
			'Palette',
			'Objects',
			'History',
			'Proposals',
			'Script',
		]);
		expect(toggles.find((toggle) => toggle.panel === 'history')).toMatchObject({
			command: 'view.panel.history',
			pressed: true,
			enabled: true,
		});
		expect(toggles.find((toggle) => toggle.panel === 'script')!.pressed).toBe(false);
	});

	it('has none while no editor is open', () => {
		expect(panelToggles({ facts: NO_FACTS, handlers: {} })).toEqual([]);
	});
});
