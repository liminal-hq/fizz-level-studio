// Tests for the dock hook: loading, repairing, saving after a pause and the moves
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { DockSettings } from '@liminal-hq/fizz-studio-protocol/generated/DockSettings';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDockClient } from '../../test/dockFixtures';
import { SAVE_DELAY_MS } from '../float/usePanelLayout';
import { dockedIn, defaultDock } from './dockModel';
import { FALLBACK_WINDOW, useDockLayout } from './useDockLayout';

const windowSize = { w: 1440, h: 900 };
const area = { w: 1300, h: 700 };

beforeEach(() => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
	vi.useRealTimers();
});

describe('useDockLayout', () => {
	it('starts from the default arrangement', () => {
		const { result } = renderHook(() => useDockLayout(fakeDockClient(), windowSize, area));
		expect(dockedIn(result.current.workspace, 'right')).toEqual(['objects', 'history']);
		expect(result.current.shown.script).toBe(true);
	});

	it('takes the saved dock when it arrives and repairs it', async () => {
		const dock = defaultDock();
		const ws = dock.workspaces[dock.active]!;
		ws.zones.left.size = 99_999;
		const { result } = renderHook(() => useDockLayout(fakeDockClient(dock), windowSize, area));
		await waitFor(() => expect(result.current.workspace.zones.left.size).toBeLessThan(99_999));
		expect(result.current.workspace.zones.left.size).toBe(432);
	});

	it('measures the caps against a fallback window until the window has a size', () => {
		const { result } = renderHook(() => useDockLayout(fakeDockClient(), { w: 0, h: 0 }, area));
		expect(result.current.window).toEqual(FALLBACK_WINDOW);
	});

	it('writes a change after a pause and not before', async () => {
		const client = fakeDockClient();
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		act(() => result.current.dockTo('history', 'bottom'));
		expect(client.save).not.toHaveBeenCalled();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10);
		});
		expect(client.save).toHaveBeenCalledTimes(1);
		const saved = vi.mocked(client.save).mock.calls[0]![0];
		expect(dockedIn(saved.workspaces[saved.active]!, 'bottom')).toContain('history');
	});

	it('docks, floats, hides and shows panels', async () => {
		const client = fakeDockClient();
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		act(() => result.current.floatPanel('palette'));
		expect(result.current.floating.palette.visible).toBe(true);
		expect(dockedIn(result.current.workspace, 'left')).toEqual([]);
		act(() => result.current.dockTo('palette', 'right'));
		expect(dockedIn(result.current.view, 'right')).toContain('palette');
		act(() => result.current.setVisible('palette', false));
		expect(dockedIn(result.current.view, 'right')).not.toContain('palette');
		expect(dockedIn(result.current.workspace, 'right')).toContain('palette');
		expect(result.current.shown.palette).toBe(false);
		act(() => result.current.setVisible('palette', true));
		expect(result.current.workspace.zones.right.groups.at(-1)!.active).toBe('palette');
	});

	it('resizes a zone within its cap and resets it to the default size', () => {
		const { result } = renderHook(() => useDockLayout(fakeDockClient(), windowSize, area));
		act(() => result.current.resizeZone('left', 5000));
		expect(result.current.workspace.zones.left.size).toBe(432);
		act(() => result.current.resizeZone('left', 10));
		expect(result.current.workspace.zones.left.size).toBe(160);
		act(() => result.current.resetZoneSize('left'));
		expect(result.current.workspace.zones.left.size).toBe(196);
	});

	it('puts the default back on reset and saves it', async () => {
		const client = fakeDockClient();
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		act(() => result.current.dockTo('palette', 'bottom'));
		act(() => result.current.reset());
		expect(dockedIn(result.current.workspace, 'left')).toEqual(['palette']);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10);
		});
		const saved = vi.mocked(client.save).mock.calls.at(-1)![0];
		expect(dockedIn(saved.workspaces[saved.active]!, 'left')).toEqual(['palette']);
	});

	it('keeps what the person moved when the saved dock arrives late', async () => {
		let release: (() => void) | undefined;
		const client = fakeDockClient();
		client.get = vi.fn(
			() =>
				new Promise<DockSettings>((resolve) => {
					release = () => resolve(defaultDock());
				}),
		);
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		act(() => result.current.dockTo('palette', 'bottom'));
		await act(async () => release?.());
		expect(dockedIn(result.current.workspace, 'bottom')).toContain('palette');
	});
});
