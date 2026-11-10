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
import { flushPendingWrites } from '../../services/pendingWrites';
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
		expect(dockedIn(result.current.workspace, 'right')).toEqual([
			'inspector',
			'objects',
			'history',
		]);
		expect(result.current.shown.script).toBe(true);
	});

	it('names the workspaces and switches to another, saving the choice', async () => {
		const client = fakeDockClient(defaultDock());
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		expect(result.current.workspaceNames).toEqual(['Paint', 'Review', 'Script']);
		expect(result.current.active).toBe('Paint');
		act(() => result.current.switchWorkspace('Script'));
		expect(result.current.active).toBe('Script');
		act(() => result.current.switchWorkspace('Nowhere'));
		expect(result.current.active).toBe('Script');
		await act(async () => {
			await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10);
		});
		expect(vi.mocked(client.save).mock.calls.at(-1)![0].active).toBe('Script');
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

	it('writes a waiting change at once when the window flushes before closing', async () => {
		const client = fakeDockClient();
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		act(() => result.current.dockTo('history', 'bottom'));
		expect(client.save).not.toHaveBeenCalled();
		await act(async () => {
			await flushPendingWrites();
		});
		expect(client.save).toHaveBeenCalledTimes(1);
		// Nothing is left for the pause to write, and a flush with nothing waiting writes nothing.
		await act(async () => {
			await flushPendingWrites();
			await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10);
		});
		expect(client.save).toHaveBeenCalledTimes(1);
	});

	it('docks, floats, hides and shows panels', async () => {
		const client = fakeDockClient();
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		act(() => result.current.floatPanel('palette'));
		expect(result.current.floating.palette.visible).toBe(true);
		expect(dockedIn(result.current.workspace, 'left')).toEqual(['layers']);
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
		expect(dockedIn(result.current.workspace, 'left')).toEqual(['palette', 'layers']);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10);
		});
		const saved = vi.mocked(client.save).mock.calls.at(-1)![0];
		expect(dockedIn(saved.workspaces[saved.active]!, 'left')).toEqual(['palette', 'layers']);
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

	it('keeps the tool picker place per workspace and writes it with the dock', async () => {
		const dock = defaultDock();
		dock.workspaces.Script!.tool_picker = { x: 300, y: 50 };
		const client = fakeDockClient(dock);
		const { result } = renderHook(() => useDockLayout(client, windowSize, area));
		await waitFor(() => expect(result.current.loaded).toBe(true));
		expect(result.current.toolPicker).toBeNull();
		act(() => result.current.placeToolPicker({ x: 120.6, y: 44.2 }));
		expect(result.current.toolPicker).toEqual({ x: 121, y: 44 });
		await act(async () => {
			await flushPendingWrites();
		});
		expect(client.save).toHaveBeenCalledTimes(1);
		const saved = vi.mocked(client.save).mock.calls[0]![0];
		expect(saved.workspaces.Paint!.tool_picker).toEqual({ x: 121, y: 44 });
		expect(saved.workspaces.Script!.tool_picker).toEqual({ x: 300, y: 50 });
		// The same place again writes nothing new.
		act(() => result.current.placeToolPicker({ x: 121, y: 44 }));
		await act(async () => {
			await flushPendingWrites();
		});
		expect(client.save).toHaveBeenCalledTimes(1);
	});

	it('reads back a saved tool picker place, and resetting the workspace forgets it', async () => {
		const first = fakeDockClient();
		const one = renderHook(() => useDockLayout(first, windowSize, area));
		await waitFor(() => expect(one.result.current.loaded).toBe(true));
		act(() => one.result.current.placeToolPicker({ x: 410, y: 96 }));
		await act(async () => {
			await flushPendingWrites();
		});
		const written = vi.mocked(first.save).mock.calls[0]![0];
		one.unmount();
		const again = renderHook(() => useDockLayout(fakeDockClient(written), windowSize, area));
		await waitFor(() => expect(again.result.current.toolPicker).toEqual({ x: 410, y: 96 }));
		act(() => again.result.current.reset());
		expect(again.result.current.toolPicker).toBeNull();
	});

	it('docks a panel back where it left through a save and a restart, per workspace', async () => {
		const first = fakeDockClient(defaultDock());
		const one = renderHook(() => useDockLayout(first, windowSize, area));
		await waitFor(() => expect(one.result.current.loaded).toBe(true));
		// Paint: Objects (between Inspector and History) and Layers (after Palette) leave.
		act(() => one.result.current.activate('objects'));
		act(() => one.result.current.floatPanel('objects'));
		act(() => one.result.current.floatPanel('layers'));
		act(() => one.result.current.switchWorkspace('Script'));
		// Script: History goes to its own window, away, with the right dock as it is there.
		act(() => one.result.current.sendToWindow('history'));
		await act(async () => {
			await flushPendingWrites();
		});
		const written = vi.mocked(first.save).mock.calls.at(-1)![0];
		one.unmount();

		const again = renderHook(() => useDockLayout(fakeDockClient(written), windowSize, area));
		await waitFor(() => expect(again.result.current.active).toBe('Script'));
		expect(again.result.current.workspace.panels.history!.home_spot).toMatchObject({
			zone: 'right',
			after: 'objects',
			before: null,
		});
		act(() => again.result.current.bringBack('history'));
		expect(dockedIn(again.result.current.workspace, 'right')).toEqual([
			'inspector',
			'objects',
			'history',
		]);
		act(() => again.result.current.switchWorkspace('Paint'));
		const paint = again.result.current.workspace;
		expect(dockedIn(paint, 'left')).toEqual(['palette']);
		expect(paint.panels.objects!.home_spot).toMatchObject({
			after: 'inspector',
			before: 'history',
			active: true,
		});
		act(() => again.result.current.dockTo('objects', 'right'));
		act(() => again.result.current.dockTo('layers', 'left'));
		expect(dockedIn(again.result.current.workspace, 'right')).toEqual([
			'inspector',
			'objects',
			'history',
		]);
		expect(dockedIn(again.result.current.workspace, 'left')).toEqual(['palette', 'layers']);
		expect(again.result.current.workspace.zones.right.groups[0]!.active).toBe('objects');
	});
});
