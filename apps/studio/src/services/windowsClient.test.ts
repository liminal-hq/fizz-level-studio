// Tests for the windows client
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({
	invoke: vi.fn<(command: string, args?: unknown) => Promise<void>>(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { openWindow } from './windowsClient';

beforeEach(() => {
	invoke.mockReset();
	invoke.mockResolvedValue(undefined);
});

describe('openWindow', () => {
	it('asks Rust to open the window it names', async () => {
		await openWindow({ kind: 'preferences' });
		expect(invoke).toHaveBeenCalledWith('open_window', { id: { kind: 'preferences' } });
	});

	it('passes a numbered window its number', async () => {
		await openWindow({ kind: 'panel', panel: 'script', n: 1 });
		expect(invoke).toHaveBeenCalledWith('open_window', {
			id: { kind: 'panel', panel: 'script', n: 1 },
		});
	});
});
