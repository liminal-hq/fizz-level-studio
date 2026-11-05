// Tests for the launch client, with Tauri's invoke and listen mocked
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ invoke: vi.fn() }));
const events = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => core);
vi.mock('@tauri-apps/api/event', () => events);

import { getLaunchPaths, onOpenRequest, OPEN_REQUEST_EVENT } from './launchClient';

beforeEach(() => {
	core.invoke.mockReset();
	events.listen.mockReset();
});

describe('getLaunchPaths', () => {
	it('invokes the app command', async () => {
		core.invoke.mockResolvedValue(['/a.fizz']);
		expect(await getLaunchPaths()).toEqual(['/a.fizz']);
		expect(core.invoke).toHaveBeenCalledWith('app_launch_paths');
	});
});

describe('onOpenRequest', () => {
	it('passes the paths from the event payload', async () => {
		let handler: (event: { payload: { paths: string[] } }) => void = () => {};
		events.listen.mockImplementation(async (_name, fn) => {
			handler = fn;
			return () => {};
		});
		const heard = vi.fn();
		onOpenRequest(heard);
		await Promise.resolve();
		expect(events.listen.mock.calls[0]![0]).toBe(OPEN_REQUEST_EVENT);
		handler({ payload: { paths: ['/b.fizz', '/c.fizz'] } });
		expect(heard).toHaveBeenCalledWith(['/b.fizz', '/c.fizz']);
	});

	it('stops listening, even when asked before the listener is ready', async () => {
		const unlisten = vi.fn();
		events.listen.mockResolvedValue(unlisten);
		onOpenRequest(() => {})();
		await Promise.resolve();
		await Promise.resolve();
		expect(unlisten).toHaveBeenCalled();
	});
});
