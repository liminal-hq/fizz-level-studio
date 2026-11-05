// Tests for the real new-level client and the open-request emitter, with the plugin mocked
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { levelSnapshot } from '../test/levelFixtures';

const plugin = vi.hoisted(() => ({ createLevel: vi.fn() }));
vi.mock('@liminal-hq/fizz-studio-plugin-worlds', () => plugin);
const emitTo = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@tauri-apps/api/event', () => ({ emitTo, listen: vi.fn() }));

import { requestOpen } from '../services/openRequestClient';
import { newLevelClient } from './newLevelClient';

beforeEach(() => {
	plugin.createLevel.mockReset();
	emitTo.mockClear();
});

describe('newLevelClient', () => {
	it('sends the request and returns the snapshot with bigint revisions', async () => {
		plugin.createLevel.mockResolvedValue({
			...levelSnapshot(),
			revision: 4 as unknown as bigint,
			saved_revision: 4 as unknown as bigint,
		});
		const request = {
			name: 'Hill',
			id: 'hill',
			width: 8,
			height: 8,
			ground: null,
			theme: null,
			target: 'fizz2' as const,
			folder: '/w',
		};
		const snapshot = await newLevelClient.create(request);
		expect(plugin.createLevel).toHaveBeenCalledWith(request);
		expect(snapshot.revision).toBe(4n);
		expect(snapshot.saved_revision).toBe(4n);
	});

	it('lets a refusal through', async () => {
		plugin.createLevel.mockRejectedValue({ kind: 'invalid', message: 'exists' });
		await expect(newLevelClient.create({} as never)).rejects.toEqual({
			kind: 'invalid',
			message: 'exists',
		});
	});
});

describe('requestOpen', () => {
	it('emits the open-request event to the first main window', async () => {
		await requestOpen('/w/hill.fizz');
		expect(emitTo).toHaveBeenCalledWith('main-1', 'app://open-request', {
			paths: ['/w/hill.fizz'],
		});
	});
});
