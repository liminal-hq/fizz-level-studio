// Tests for the app-wide key dispatcher: the chord each command lists and the command a key press runs
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/windowsClient', () => ({ openWindow: vi.fn(async () => {}) }));

import { commandForKey, type KeyPhase } from './appShortcuts';
import { NO_FACTS, type BridgeSnapshot } from './commandBridge';
import { allCommands, runCommand, shortcutOf } from './registry';

const snapshot = (
	facts: Partial<BridgeSnapshot['facts']> = {},
	handlers: BridgeSnapshot['handlers'] = {},
): BridgeSnapshot => ({ facts: { ...NO_FACTS, ...facts }, handlers });

describe('the app keys', () => {
	const key = (
		init: Partial<Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>>,
		target: EventTarget | null = null,
		phase: KeyPhase = 'bubble',
	) =>
		commandForKey(
			{
				key: '',
				ctrlKey: false,
				metaKey: false,
				altKey: false,
				shiftKey: false,
				target,
				...init,
			},
			allCommands(NO_FACTS),
			phase,
		);

	it('maps Ctrl+N, Ctrl+O and Ctrl+W to New, Open and Close level', () => {
		expect(key({ key: 'n', ctrlKey: true })).toBe('file.new');
		expect(key({ key: 'o', ctrlKey: true })).toBe('file.open');
		expect(key({ key: 'w', ctrlKey: true })).toBe('file.close');
		expect(key({ key: 'W', metaKey: true })).toBe('file.close');
	});

	it('leaves the other modified keys and the bare letters alone', () => {
		expect(key({ key: 'n', ctrlKey: true, shiftKey: true })).toBeNull();
		expect(key({ key: 'w', ctrlKey: true, altKey: true })).toBeNull();
		for (const letter of ['n', 'o', 'w', 'b', 'e', 'i', 's', 't', 'q']) {
			expect(key({ key: letter })).toBeNull();
		}
	});

	it('maps Ctrl+S, Ctrl+, and Ctrl+Q to Save, Preferences and Quit', () => {
		expect(key({ key: 's', ctrlKey: true })).toBe('file.save');
		expect(key({ key: ',', ctrlKey: true })).toBe('file.preferences');
		expect(key({ key: 'q', ctrlKey: true })).toBe('file.quit');
	});

	it('takes Ctrl+Shift+P only in the capture phase, so it works with focus in the script editor', () => {
		const chord = { key: 'P', ctrlKey: true, shiftKey: true };
		expect(key(chord, null, 'capture')).toBe('view.commandPalette');
		expect(key(chord, null, 'bubble')).toBeNull();
		expect(key({ key: 'n', ctrlKey: true }, null, 'capture')).toBeNull();
	});

	it('maps Ctrl+=, Ctrl++, Ctrl+- and Ctrl+0 to the zoom commands, and Ctrl+Shift+0 to nothing', () => {
		expect(key({ key: '=', ctrlKey: true })).toBe('view.zoomIn');
		expect(key({ key: '+', ctrlKey: true, shiftKey: true })).toBe('view.zoomIn');
		expect(key({ key: '-', ctrlKey: true })).toBe('view.zoomOut');
		expect(key({ key: '0', ctrlKey: true })).toBe('view.zoomFit');
		expect(key({ key: '0', ctrlKey: true, shiftKey: true })).toBeNull();
		expect(key({ key: '=', metaKey: true })).toBe('view.zoomIn');
	});

	it('shows the first chord of a command on its rows', () => {
		const shown = (id: string) => shortcutOf(allCommands(NO_FACTS).find((def) => def.id === id)!);
		expect(shown('file.save')).toBe('Ctrl+S');
		expect(shown('view.commandPalette')).toBe('Ctrl+Shift+P');
		expect(shown('view.zoomIn')).toBe('Ctrl+=');
		expect(shown('help.shortcuts')).toBe('?');
		expect(shown('help.help')).toBe('F1');
	});

	it('gives no two commands the same chord in the same phase', () => {
		const seen = new Map<string, string>();
		for (const def of allCommands(NO_FACTS)) {
			for (const chord of def.keys ?? []) {
				const id = `${chord.capture ? 'c' : 'b'}:${chord.mod}:${chord.shift}:${chord.key}`;
				expect(seen.get(id), `${def.id} repeats ${id}`).toBeUndefined();
				seen.set(id, def.id);
			}
		}
	});

	it('maps F1 to Help and the question mark to Keyboard shortcuts', () => {
		expect(key({ key: 'F1' })).toBe('help.help');
		expect(key({ key: '?', shiftKey: true })).toBe('help.shortcuts');
	});

	it('pauses the question mark while typing in a box', () => {
		const input = document.createElement('input');
		const editable = document.createElement('div');
		editable.setAttribute('contenteditable', 'true');
		const inner = document.createElement('span');
		editable.append(inner);
		expect(key({ key: '?' }, input)).toBeNull();
		expect(key({ key: '?' }, inner)).toBeNull();
		expect(key({ key: '?' }, document.createElement('button'))).toBe('help.shortcuts');
		// F1 and the Ctrl keys still work in a box.
		expect(key({ key: 'F1' }, input)).toBe('help.help');
	});

	it('runs through the registry, so Close level does nothing without a level', () => {
		const close = vi.fn();
		const handlers = { 'file.close': close };
		const id = key({ key: 'w', ctrlKey: true })!;
		expect(runCommand(id, snapshot({}, handlers))).toBe(false);
		expect(runCommand(id, snapshot({ hasLevel: true }, handlers))).toBe(true);
		expect(close).toHaveBeenCalledOnce();
	});

	describe('the selection keys', () => {
		const canvas = document.createElement('canvas');
		canvas.setAttribute('role', 'application');
		const inspector = document.createElement('div');
		inspector.setAttribute('data-inspector-scope', '');
		const stepper = document.createElement('button');
		inspector.append(stepper);
		const field = document.createElement('input');
		inspector.append(field);
		const elsewhere = document.createElement('button');
		document.body.append(canvas, inspector, elsewhere);

		it('maps Delete and Backspace to Delete on the canvas and in the Inspector only', () => {
			for (const name of ['Delete', 'Backspace']) {
				expect(key({ key: name }, canvas)).toBe('edit.delete');
				expect(key({ key: name }, stepper)).toBe('edit.delete');
				expect(key({ key: name }, elsewhere)).toBeNull();
				expect(key({ key: name }, null)).toBeNull();
			}
		});

		it('never takes Delete or Backspace or F in a box the person types in', () => {
			for (const name of ['Delete', 'Backspace', 'f']) {
				expect(key({ key: name }, field)).toBeNull();
			}
		});

		it('maps F to Flip where Delete works, and the arrows to the nudges on the canvas only', () => {
			expect(key({ key: 'f' }, canvas)).toBe('selection.flip');
			expect(key({ key: 'f', ctrlKey: true }, canvas)).toBeNull();
			expect(key({ key: 'ArrowLeft' }, canvas)).toBe('selection.nudge.left');
			expect(key({ key: 'ArrowRight' }, canvas)).toBe('selection.nudge.right');
			expect(key({ key: 'ArrowUp' }, canvas)).toBe('selection.nudge.up');
			expect(key({ key: 'ArrowDown' }, canvas)).toBe('selection.nudge.down');
			expect(key({ key: 'ArrowLeft' }, stepper)).toBeNull();
			expect(key({ key: 'ArrowLeft', shiftKey: true }, canvas)).toBeNull();
		});

		it('maps Ctrl+J to Show in script anywhere', () => {
			expect(key({ key: 'j', ctrlKey: true }, elsewhere)).toBe('selection.showInScript');
			expect(key({ key: 'j', ctrlKey: true }, field)).toBe('selection.showInScript');
		});

		it('runs only while the selection allows it, and says why when it does not', () => {
			const handlers = { 'edit.delete': vi.fn(), 'selection.flip': vi.fn() };
			const editor = { hasLevel: true, editorOpen: true };
			expect(runCommand('edit.delete', snapshot(editor, handlers))).toBe(false);
			const item = {
				kind: 'item' as const,
				editable: true,
				canFlip: false,
				canDelete: true,
				hasLine: true,
				reason: null,
			};
			expect(runCommand('edit.delete', snapshot({ ...editor, selection: item }, handlers))).toBe(
				true,
			);
			expect(runCommand('selection.flip', snapshot({ ...editor, selection: item }, handlers))).toBe(
				false,
			);
			const def = allCommands(NO_FACTS).find((command) => command.id === 'edit.delete')!;
			expect(
				def.reason?.({ ...NO_FACTS, selection: { ...item, kind: 'start', canDelete: false } }),
			).toBe('inspector.deleteStart');
			expect(def.reason?.(NO_FACTS)).toBe('selection.needsThing');
		});
	});
});
