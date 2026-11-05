// Tests for the panel window client and the plugin status questions
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, listen } = vi.hoisted(() => ({
	invoke: vi.fn<(command: string, args?: unknown) => Promise<unknown>>(),
	listen: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen }));

const statuses = vi.hoisted(() => ({
	appearance: vi.fn(),
	manager: vi.fn(),
	effects: vi.fn(),
	tearoff: vi.fn(),
}));
vi.mock('@liminal-hq/plugin-system-appearance', () => ({ getStatus: statuses.appearance }));
vi.mock('@liminal-hq/plugin-window-manager', () => ({ getStatus: statuses.manager }));
vi.mock('@liminal-hq/plugin-window-effects', () => ({ getStatus: statuses.effects }));
vi.mock('@liminal-hq/plugin-window-tearoff', () => ({ getStatus: statuses.tearoff }));

import { panelLabel, panelWindowClient, panelWindowId } from './panelWindowClient';
import { pluginStatuses } from './pluginStatus';

beforeEach(() => {
	invoke.mockReset();
	listen.mockReset();
});

describe('panelWindowClient', () => {
	it('names the first window of a panel', () => {
		expect(panelWindowId('script')).toEqual({ kind: 'panel', panel: 'script', n: 1 });
		expect(panelLabel('script')).toBe('panel-script-1');
	});

	it('opens and closes the panel window through the app commands', async () => {
		invoke.mockResolvedValue(undefined);
		await panelWindowClient.tearOff('script');
		expect(invoke).toHaveBeenCalledWith('open_window', {
			id: { kind: 'panel', panel: 'script', n: 1 },
		});
		await panelWindowClient.dockBack('script');
		expect(invoke).toHaveBeenCalledWith('close_panel', {
			id: { kind: 'panel', panel: 'script', n: 1 },
		});
		invoke.mockResolvedValue(['panel-script-1']);
		expect(await panelWindowClient.open()).toEqual(['panel-script-1']);
	});

	it('hears the close event and stops listening, even if stopped before the listener is ready', async () => {
		const unlisten = vi.fn();
		let handler: (event: { payload: string }) => void = () => {};
		listen.mockImplementation(async (_name: string, h: typeof handler) => {
			handler = h;
			return unlisten;
		});
		const heard: string[] = [];
		const stop = panelWindowClient.onClosed((label) => heard.push(label));
		await Promise.resolve();
		handler({ payload: 'panel-script-1' });
		expect(heard).toEqual(['panel-script-1']);
		expect(listen.mock.calls[0]?.[0]).toBe('panel://closed');
		stop();
		expect(unlisten).toHaveBeenCalled();

		const early = vi.fn();
		listen.mockResolvedValue(early);
		panelWindowClient.onClosed(() => {})();
		await Promise.resolve();
		await Promise.resolve();
		expect(early).toHaveBeenCalled();
	});
});

describe('pluginStatuses', () => {
	it('asks every plugin and reports a failure instead of throwing', async () => {
		statuses.appearance.mockResolvedValue({ available: true });
		statuses.manager.mockResolvedValue({ available: true });
		statuses.effects.mockResolvedValue({ features: [] });
		statuses.tearoff.mockRejectedValue(new Error('not allowed'));
		const answers = await pluginStatuses();
		expect(Object.keys(answers)).toEqual([
			'system-appearance',
			'window-manager',
			'window-effects',
			'window-tearoff',
		]);
		expect(answers['system-appearance']).toEqual({ ok: true, status: { available: true } });
		expect(answers['window-tearoff']).toEqual({ ok: false, error: 'Error: not allowed' });
	});
});
