// Tests for the layout hook: loading, saving after a pause, raising, hiding and resetting
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { PanelLayout } from '@liminal-hq/fizz-studio-protocol/generated/PanelLayout';
import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutClient } from '../../services/layoutClient';
import { fallbackLayout } from './panelSpecs';
import { SAVE_DELAY_MS, neighboursOf, usePanelLayout } from './usePanelLayout';

function fakeClient(saved: PanelLayout = fallbackLayout()) {
	const client: LayoutClient = {
		get: vi.fn(async () => saved),
		save: vi.fn(async (_kind: string, layout: PanelLayout) => layout),
		reset: vi.fn(async () => fallbackLayout()),
	};
	return client;
}

const area = { w: 1280, h: 700 };

beforeEach(() => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
	vi.useRealTimers();
});

describe('usePanelLayout', () => {
	it('starts from the built-in arrangement and takes the saved one when it arrives', async () => {
		const saved = fallbackLayout();
		saved.panels.script!.x = 300;
		const client = fakeClient(saved);
		const { result } = renderHook(() => usePanelLayout(client, area));
		expect(result.current.panels.palette.rect).toMatchObject({ x: 76, y: 8, w: 252, h: 300 });
		await waitFor(() => expect(result.current.panels.script.rect.x).toBe(300));
		expect(client.get).toHaveBeenCalledWith('main');
	});

	it('keeps a panel inside the area it floats in without changing what is saved', async () => {
		const client = fakeClient();
		const { result } = renderHook(() => usePanelLayout(client, { w: 600, h: 400 }));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		const script = result.current.panels.script.rect;
		expect(script.x + script.w).toBeLessThanOrEqual(600);
		expect(script.y + script.h).toBeLessThanOrEqual(400);
		expect(client.save).not.toHaveBeenCalled();
	});

	it('saves once, a moment after the last change', async () => {
		const client = fakeClient();
		const { result } = renderHook(() => usePanelLayout(client, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		act(() => result.current.change('palette', { x: 10, y: 20, w: 252, h: 300 }));
		act(() => result.current.change('palette', { x: 30, y: 40, w: 252, h: 300 }));
		expect(client.save).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(SAVE_DELAY_MS + 1);
		});
		expect(client.save).toHaveBeenCalledTimes(1);
		const [kind, layout] = vi.mocked(client.save).mock.calls[0]!;
		expect(kind).toBe('main');
		expect(layout.panels.palette).toMatchObject({ x: 30, y: 40 });
	});

	it('writes a pending change when the editor goes away', async () => {
		const client = fakeClient();
		const { result, unmount } = renderHook(() => usePanelLayout(client, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		act(() => result.current.toggleCollapsed('history'));
		unmount();
		expect(client.save).toHaveBeenCalledTimes(1);
	});

	it('brings a raised panel in front of the rest, and only changes when it must', async () => {
		const client = fakeClient();
		const { result } = renderHook(() => usePanelLayout(client, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		const top = result.current.panels.script.z;
		act(() => result.current.raise('script'));
		expect(result.current.panels.script.z).toBe(top);
		act(() => result.current.raise('palette'));
		expect(result.current.panels.palette.z).toBeGreaterThan(top);
	});

	it('hides and shows a panel, and keeps its place meanwhile', async () => {
		const client = fakeClient();
		const { result } = renderHook(() => usePanelLayout(client, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		const before = result.current.panels.objects.rect;
		act(() => result.current.setVisible('objects', false));
		expect(result.current.panels.objects.visible).toBe(false);
		act(() => result.current.setVisible('objects', true));
		expect(result.current.panels.objects).toMatchObject({ visible: true, rect: before });
	});

	it('resets to the defaults Rust gives, from the menu or Ctrl+Shift+0', async () => {
		const client = fakeClient();
		const { result } = renderHook(() => usePanelLayout(client, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		act(() => result.current.change('palette', { x: 500, y: 500, w: 252, h: 200 }));
		fireEvent.keyDown(window, { key: '0', code: 'Digit0', ctrlKey: true, shiftKey: true });
		await waitFor(() => expect(result.current.panels.palette.rect.x).toBe(76));
		expect(client.reset).toHaveBeenCalledWith('main');
		// The change that was waiting to be saved is dropped with the reset.
		act(() => {
			vi.advanceTimersByTime(SAVE_DELAY_MS + 1);
		});
		expect(client.save).not.toHaveBeenCalled();
	});

	it('works from the built-in arrangement when the settings cannot answer', async () => {
		const client = fakeClient();
		client.get = vi.fn(async () => {
			throw new Error('no plugin');
		});
		client.save = vi.fn(async () => {
			throw new Error('no plugin');
		});
		const { result } = renderHook(() => usePanelLayout(client, area));
		act(() => result.current.change('palette', { x: 5, y: 5, w: 252, h: 300 }));
		act(() => {
			vi.advanceTimersByTime(SAVE_DELAY_MS + 1);
		});
		expect(result.current.panels.palette.rect.x).toBe(5);
	});
});

describe('neighboursOf', () => {
	it('lists the other visible panels as they show, a collapsed one only its header tall', async () => {
		const client = fakeClient();
		const { result } = renderHook(() => usePanelLayout(client, area));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		const others = neighboursOf('script', result.current.panels);
		expect(others).toHaveLength(4);
		expect(others.some((r) => r.h === 46)).toBe(true);
		act(() => result.current.setVisible('palette', false));
		expect(neighboursOf('script', result.current.panels)).toHaveLength(3);
	});
});
