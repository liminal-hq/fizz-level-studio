// Tests for the guest-js revision rule and the command names it sends
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsSnapshot } from './index';

const invoke = vi.fn();
type Handler = (event: { payload: SettingsSnapshot }) => void;
const handlers: Handler[] = [];

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock('@tauri-apps/api/event', () => ({
	listen: (_name: string, handler: Handler) => {
		handlers.push(handler);
		return Promise.resolve(() => {});
	},
}));

const {
	clearRecent,
	getPanelLayout,
	getSettings,
	newerOnly,
	onSettingsChanged,
	resetPanelLayout,
	savePanelLayout,
	touchRecent,
	updateSettings,
} = await import('./index');

function snapshot(revision: number): SettingsSnapshot {
	return {
		revision,
		settings: {
			colour_mode: 'system',
			larger_controls: false,
			locale: 'en-CA',
			recent_worlds: [],
			layout: {},
		},
	};
}

beforeEach(() => {
	invoke.mockReset();
	handlers.length = 0;
});

describe('newerOnly', () => {
	it('ignores a revision at or below the one already applied', () => {
		const heard: number[] = [];
		const hear = newerOnly(3, (s) => heard.push(s.revision));
		hear(snapshot(2));
		hear(snapshot(3));
		hear(snapshot(4));
		hear(snapshot(4));
		expect(heard).toEqual([4]);
	});

	it('never goes back after a higher revision, even when a lower one arrives late', () => {
		const heard: number[] = [];
		const hear = newerOnly(-1, (s) => heard.push(s.revision));
		hear(snapshot(5));
		hear(snapshot(4));
		hear(snapshot(6));
		hear(snapshot(5));
		expect(heard).toEqual([5, 6]);
	});
});

describe('onSettingsChanged', () => {
	it('hands a listener only newer snapshots, starting from the revision it was given', async () => {
		const heard: number[] = [];
		await onSettingsChanged((s) => heard.push(s.revision), 2);
		for (const revision of [1, 2, 3, 2, 4]) {
			handlers[0]?.({ payload: snapshot(revision) });
		}
		expect(heard).toEqual([3, 4]);
	});

	it('hears everything from the first revision when no starting point is given', async () => {
		const heard: number[] = [];
		await onSettingsChanged((s) => heard.push(s.revision));
		handlers[0]?.({ payload: snapshot(0) });
		expect(heard).toEqual([0]);
	});
});

describe('commands', () => {
	it('send the plugin command names with their arguments', async () => {
		invoke.mockResolvedValue(snapshot(1));
		await getSettings();
		await updateSettings({ larger_controls: true }, 7);
		await touchRecent('/worlds/a');
		await clearRecent();
		expect(invoke.mock.calls).toEqual([
			['plugin:fizz-studio-settings|settings_get', undefined],
			[
				'plugin:fizz-studio-settings|settings_update',
				{ patch: { larger_controls: true }, basedOn: 7 },
			],
			['plugin:fizz-studio-settings|recent_touch', { path: '/worlds/a' }],
			['plugin:fizz-studio-settings|recent_clear', undefined],
		]);
	});
});

describe('the panel layout commands', () => {
	const layout = {
		panels: { script: { x: 1, y: 2, w: 300, h: 200, collapsed: false, visible: true, z: 1 } },
	};

	it('reads, saves and resets a layout by window kind', async () => {
		invoke.mockResolvedValue(layout);
		await expect(getPanelLayout('main')).resolves.toEqual(layout);
		expect(invoke).toHaveBeenLastCalledWith('plugin:fizz-studio-settings|layout_get', {
			kind: 'main',
		});
		await savePanelLayout('main', layout);
		expect(invoke).toHaveBeenLastCalledWith('plugin:fizz-studio-settings|layout_set', {
			kind: 'main',
			layout,
		});
		await resetPanelLayout('main');
		expect(invoke).toHaveBeenLastCalledWith('plugin:fizz-studio-settings|layout_reset', {
			kind: 'main',
		});
	});
});
