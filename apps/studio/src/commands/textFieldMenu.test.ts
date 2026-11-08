// Tests for the text field's context menu: its rows, and what each is dimmed for
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expectEveryItemHasIcon } from '@liminal-hq/fizz-studio-chrome/ContextMenu/expectEveryItemHasIcon';
import type { MenuItem } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import { describe, expect, it } from 'vitest';
import type { TextFieldContextTarget } from './contextTargets';
import { textFieldIdOf, textFieldMenuItems } from './textFieldMenu';

const target = (field: Partial<TextFieldContextTarget['field']> = {}): TextFieldContextTarget => ({
	kind: 'textField',
	field: { hasSelection: true, hasText: true, readOnly: false, ...field },
});
const labels = (items: MenuItem[]) =>
	items.map((item) => (item.type === 'separator' ? '-' : 'label' in item ? item.label : ''));
const row = (items: MenuItem[], label: string) =>
	items.find((item) => 'label' in item && item.label === label);
const dimmed = (items: MenuItem[], label: string) => {
	const found = row(items, label);
	return found && 'disabled' in found && found.disabled === true;
};
const why = (items: MenuItem[], label: string) => {
	const found = row(items, label);
	return found && 'title' in found ? found.title : undefined;
};

describe('textFieldMenuItems', () => {
	it('is Undo and Redo, Cut, Copy and Paste, then Select all', () => {
		const items = textFieldMenuItems(target());
		expect(labels(items)).toEqual(['Undo', 'Redo', '-', 'Cut', 'Copy', 'Paste', '-', 'Select all']);
		expectEveryItemHasIcon(items);
	});

	it('has every row on offer in a field with a selection that can be changed', () => {
		const items = textFieldMenuItems(target());
		for (const label of ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select all']) {
			expect(dimmed(items, label)).toBeFalsy();
		}
	});

	it('dims Cut and Copy, with the reason, while nothing is selected', () => {
		const items = textFieldMenuItems(target({ hasSelection: false }));
		expect(dimmed(items, 'Cut')).toBe(true);
		expect(dimmed(items, 'Copy')).toBe(true);
		expect(why(items, 'Copy')).toBe('Select some text first.');
		expect(dimmed(items, 'Paste')).toBeFalsy();
	});

	it('dims what a read-only field cannot do, and leaves Copy and Select all', () => {
		const items = textFieldMenuItems(target({ readOnly: true }));
		for (const label of ['Undo', 'Redo', 'Cut', 'Paste']) {
			expect(dimmed(items, label)).toBe(true);
			expect(why(items, label)).toBe('This field cannot be changed.');
		}
		expect(dimmed(items, 'Copy')).toBeFalsy();
		expect(dimmed(items, 'Select all')).toBeFalsy();
	});

	it('dims Select all in an empty field', () => {
		const items = textFieldMenuItems(target({ hasText: false, hasSelection: false }));
		expect(dimmed(items, 'Select all')).toBe(true);
		expect(why(items, 'Select all')).toBe('The field is empty.');
	});

	it('shows the keys the field answers to', () => {
		const items = textFieldMenuItems(target());
		const keys = items.flatMap((item) =>
			'shortcut' in item && item.shortcut ? [item.shortcut] : [],
		);
		expect(keys).toEqual(['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+X', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A']);
	});
});

describe('textFieldIdOf', () => {
	it('names the action of a text row and nothing else', () => {
		expect(textFieldIdOf('text.paste')).toBe('paste');
		expect(textFieldIdOf('text.selectAll')).toBe('selectAll');
		expect(textFieldIdOf('edit.undo')).toBeNull();
		expect(textFieldIdOf('text.format')).toBeNull();
	});
});
