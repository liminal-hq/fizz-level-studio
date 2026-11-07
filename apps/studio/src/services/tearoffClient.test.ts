// Tests for the tear-off client over a fake plugin, and for reading a drag's payload
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
	getStatus: vi.fn(),
	hasFeature: vi.fn((status: { features: string[] }, feature: string) =>
		status.features.includes(feature),
	),
	begin: vi.fn(),
	update: vi.fn(),
	end: vi.fn(),
	hitTest: vi.fn(),
	setDropRegions: vi.fn(),
	beginToplevelDrag: vi.fn(),
	endToplevelDrag: vi.fn(),
	onTimeout: vi.fn(),
	onCursorStale: vi.fn(),
	onToplevelDragStarted: vi.fn(),
	onToplevelDragEnded: vi.fn(),
	onPayloadDropped: vi.fn(),
	onDragHover: vi.fn(),
	onDragLeave: vi.fn(),
}));
vi.mock('@liminal-hq/plugin-window-tearoff', () => plugin);

import { createTauriTearoffClient } from './tauriTearoffClient';
import { NO_TEAROFF, readPanelDragPayload } from './tearoffClient';

beforeEach(() => {
	for (const fn of Object.values(plugin)) if ('mockReset' in fn) fn.mockReset();
	plugin.hasFeature.mockImplementation((status: { features: string[] }, feature: string) =>
		status.features.includes(feature),
	);
});

describe('the tear-off client', () => {
	it('maps the plugin’s status to feature flags and asks once', async () => {
		plugin.getStatus.mockResolvedValue({ features: ['ghost', 'cursor_follow', 'hit_test'] });
		const client = createTauriTearoffClient();
		const first = await client.features();
		expect(first).toEqual({
			ghost: true,
			cursorFollow: true,
			windowPosition: false,
			hitTest: true,
			toplevelDrag: false,
		});
		await client.features();
		expect(plugin.getStatus).toHaveBeenCalledTimes(1);
	});

	it('reports a Wayland system as the compositor’s drag and nothing else', async () => {
		plugin.getStatus.mockResolvedValue({ features: ['toplevel_drag'] });
		expect(await createTauriTearoffClient().features()).toEqual({
			...NO_TEAROFF,
			toplevelDrag: true,
		});
	});

	it('leaves every feature off when the plugin does not answer', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		plugin.getStatus.mockRejectedValue(new Error('no plugin'));
		expect(await createTauriTearoffClient().features()).toEqual(NO_TEAROFF);
		warn.mockRestore();
	});

	it('passes the ghost and the compositor’s drag through to the plugin', async () => {
		plugin.begin.mockResolvedValue({ state: 'following' });
		plugin.beginToplevelDrag.mockResolvedValue({ state: 'started', reason: null });
		plugin.end.mockResolvedValue({ cursor: null, scaleFactor: 1, cursorStale: false, hit: null });
		const client = createTauriTearoffClient();
		const payload = { kind: 'panel', panel: 'script', source: 'header', title: 'Script' } as const;
		expect(await client.begin(payload, { x: 4, y: 5 }, { width: 200, height: 56 })).toBe(
			'following',
		);
		expect(plugin.begin).toHaveBeenCalledWith(payload, { x: 4, y: 5 }, { width: 200, height: 56 });
		await client.end('drop');
		expect(plugin.end).toHaveBeenCalledWith('drop');
		await client.beginToplevelDrag(payload, 'panel-script-1', { x: 4, y: 5 });
		expect(plugin.beginToplevelDrag).toHaveBeenCalledWith(payload, 'panel-script-1', {
			x: 4,
			y: 5,
		});
	});

	it('stops listening at once even before the registration has resolved', async () => {
		const unlisten = vi.fn();
		let resolve: (fn: () => void) => void = () => {};
		plugin.onPayloadDropped.mockReturnValue(new Promise((r) => (resolve = r)));
		const stop = createTauriTearoffClient().onPayloadDropped(() => {});
		stop();
		resolve(unlisten);
		await Promise.resolve();
		await Promise.resolve();
		expect(unlisten).toHaveBeenCalledTimes(1);
	});
});

describe('readPanelDragPayload', () => {
	it('reads a panel drag and defaults what is missing', () => {
		expect(
			readPanelDragPayload({
				kind: 'panel',
				panel: 'script',
				source: 'scriptTab',
				title: 'Script',
			}),
		).toEqual({ kind: 'panel', panel: 'script', source: 'scriptTab', title: 'Script' });
		expect(readPanelDragPayload({ kind: 'panel', panel: 'layers' })).toEqual({
			kind: 'panel',
			panel: 'layers',
			source: 'header',
			title: 'layers',
		});
	});

	it('rejects what is not a panel drag', () => {
		for (const raw of [null, 3, 'x', {}, { kind: 'tab', panel: 'x' }, { kind: 'panel' }]) {
			expect(readPanelDragPayload(raw)).toBeNull();
		}
	});
});
