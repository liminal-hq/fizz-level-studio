// Tests for the dock client over the settings document
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';
import { describe, expect, it, vi } from 'vitest';
import { defaultDock } from '../panels/dock/dockModel';
import { createDockClient } from './dockClient';
import type { SettingsClient } from './settingsClient';

function snapshot(revision: number): SettingsSnapshot {
	return { revision, settings: { dock: defaultDock() } } as unknown as SettingsSnapshot;
}

function settings(overrides: Partial<SettingsClient> = {}): SettingsClient {
	return {
		get: vi.fn(async () => snapshot(3)),
		update: vi.fn(async (_patch, basedOn) => snapshot(basedOn + 1)),
		onChanged: vi.fn(() => () => {}),
		...overrides,
	};
}

describe('createDockClient', () => {
	it('reads the dock from the settings', async () => {
		const client = createDockClient(settings());
		expect(await client.get()).toEqual(defaultDock());
	});

	it('saves the dock on the revision it last saw, then on the one that came back', async () => {
		const fake = settings();
		const client = createDockClient(fake);
		await client.get();
		await client.save(defaultDock());
		await client.save(defaultDock());
		const updates = vi.mocked(fake.update).mock.calls;
		expect(updates.map((call) => call[1])).toEqual([3, 4]);
		expect(updates[0]![0]).toEqual({ dock: defaultDock() });
	});

	it('reads the revision first when it has not seen one', async () => {
		const fake = settings();
		await createDockClient(fake).save(defaultDock());
		expect(vi.mocked(fake.update).mock.calls[0]![1]).toBe(3);
	});

	it('tries once more on a fresh revision when a save is refused', async () => {
		const update = vi
			.fn<SettingsClient['update']>()
			.mockRejectedValueOnce(new Error('stale'))
			.mockImplementation(async (_patch, basedOn) => snapshot(basedOn + 1));
		const fake = settings({ update });
		await createDockClient(fake).save(defaultDock());
		expect(update).toHaveBeenCalledTimes(2);
	});

	it('gives up after the second refusal', async () => {
		const fake = settings({ update: vi.fn(async () => Promise.reject(new Error('no'))) });
		await expect(createDockClient(fake).save(defaultDock())).rejects.toThrow('no');
	});
});
