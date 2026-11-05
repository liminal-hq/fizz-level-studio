// Tests for the recovery client's normalisation over a mocked plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { levelSnapshot } from '../test/levelFixtures';

const plugin = vi.hoisted(() => ({
	listRecovery: vi.fn(),
	restoreRecovery: vi.fn(),
	discardRecovery: vi.fn(),
}));
vi.mock('@liminal-hq/fizz-studio-plugin-worlds', () => plugin);

import { recoveryClient } from './recoveryClient';

beforeEach(() => vi.clearAllMocks());

describe('recoveryClient', () => {
	it('lists entries with saved_at_ms as a bigint', async () => {
		plugin.listRecovery.mockResolvedValue([
			{ id: 'r1', path: '/l/a.fizz', name: 'a.fizz', saved_at_ms: 1_700_000_000_000 },
		]);
		const [entry] = await recoveryClient.list();
		expect(entry?.saved_at_ms).toBe(1_700_000_000_000n);
		expect(entry?.path).toBe('/l/a.fizz');
	});

	it('restores a snapshot with both revisions as bigints', async () => {
		plugin.restoreRecovery.mockResolvedValue({
			...levelSnapshot(),
			revision: 3 as unknown as bigint,
			saved_revision: 1 as unknown as bigint,
		});
		const snapshot = await recoveryClient.restore('r1');
		expect(plugin.restoreRecovery).toHaveBeenCalledWith('r1');
		expect(snapshot.revision).toBe(3n);
		expect(snapshot.saved_revision).toBe(1n);
	});

	it('discards by id', async () => {
		plugin.discardRecovery.mockResolvedValue(undefined);
		await recoveryClient.discard('r1');
		expect(plugin.discardRecovery).toHaveBeenCalledWith('r1');
	});
});
