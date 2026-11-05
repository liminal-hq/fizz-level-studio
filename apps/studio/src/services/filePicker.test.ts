// Tests for the file picker, with the dialog plugin mocked
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialog = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => dialog);

import { pickLevelFile } from './filePicker';

beforeEach(() => dialog.open.mockReset());

describe('pickLevelFile', () => {
	it('filters to .fizz files and returns the chosen path', async () => {
		dialog.open.mockResolvedValue('/levels/a.fizz');
		expect(await pickLevelFile({ title: 'Open', filterName: 'Fizz level' })).toBe('/levels/a.fizz');
		expect(dialog.open).toHaveBeenCalledWith({
			title: 'Open',
			multiple: false,
			directory: false,
			filters: [{ name: 'Fizz level', extensions: ['fizz'] }],
		});
	});

	it('returns null when the dialog is cancelled', async () => {
		dialog.open.mockResolvedValue(null);
		expect(await pickLevelFile({ title: 'Open', filterName: 'Fizz level' })).toBeNull();
	});
});
