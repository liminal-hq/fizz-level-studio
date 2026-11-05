// Tests for the recent levels client, with the settings plugin mocked
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
	clearRecent: vi.fn(),
	getSettings: vi.fn(),
	onSettingsChanged: vi.fn(),
	touchRecent: vi.fn(),
}));
vi.mock('@liminal-hq/fizz-studio-plugin-settings', () => plugin);

import { recentClient } from './recentClient';

const snapshot = (recent: string[]) => ({ revision: 1, settings: { recent_worlds: recent } });

beforeEach(() => {
	for (const fn of Object.values(plugin)) fn.mockReset();
});

describe('recentClient', () => {
	it('reads, touches and clears the recent list', async () => {
		plugin.getSettings.mockResolvedValue(snapshot(['/a.fizz']));
		plugin.touchRecent.mockResolvedValue(snapshot(['/b.fizz', '/a.fizz']));
		plugin.clearRecent.mockResolvedValue(snapshot([]));
		expect(await recentClient.list()).toEqual(['/a.fizz']);
		expect(await recentClient.touch('/b.fizz')).toEqual(['/b.fizz', '/a.fizz']);
		expect(plugin.touchRecent).toHaveBeenCalledWith('/b.fizz');
		expect(await recentClient.clear()).toEqual([]);
	});

	it('relays changes as paths and stops on request', async () => {
		const unlisten = vi.fn();
		let deliver: (value: ReturnType<typeof snapshot>) => void = () => {};
		plugin.onSettingsChanged.mockImplementation(async (listener) => {
			deliver = listener;
			return unlisten;
		});
		const heard = vi.fn();
		const stop = recentClient.onChanged(heard);
		await Promise.resolve();
		deliver(snapshot(['/c.fizz']));
		expect(heard).toHaveBeenCalledWith(['/c.fizz']);
		stop();
		expect(unlisten).toHaveBeenCalled();
	});
});
