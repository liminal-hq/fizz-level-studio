// Tests for the window title client
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({
	invoke: vi.fn<(command: string, args?: unknown) => Promise<void>>(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { setWindowTitle } from './windowTitleClient';

beforeEach(() => {
	invoke.mockReset();
	invoke.mockResolvedValue(undefined);
});

describe('setWindowTitle', () => {
	it('sends the title to Rust, which names the window itself', async () => {
		await setWindowTitle('Crater Fields •');
		expect(invoke).toHaveBeenCalledWith('set_window_title', { title: 'Crater Fields •' });
	});
});
