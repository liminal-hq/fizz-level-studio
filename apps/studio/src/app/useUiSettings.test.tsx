// Tests for the ui settings hook: read, follow, and save against the revision last seen
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Settings } from '@liminal-hq/fizz-studio-protocol/generated/Settings';
import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PREFERENCE_DEFAULTS } from '../preferences/usePreferencesSettings';
import { useUiSettings, type UiSettingsClient } from './useUiSettings';

const settings = (menu_bar: boolean): Settings =>
	({ ...PREFERENCE_DEFAULTS, ui: { menu_bar } }) as unknown as Settings;
const snapshot = (revision: number, menu_bar: boolean): SettingsSnapshot => ({
	revision,
	settings: settings(menu_bar),
});

describe('useUiSettings', () => {
	it('starts from the defaults, then takes the saved values', async () => {
		const client: UiSettingsClient = {
			get: vi.fn(async () => snapshot(3, true)),
			onChanged: vi.fn(() => () => {}),
		};
		const { result } = renderHook(() => useUiSettings(client));
		expect(result.current.ui.menu_bar).toBe(false);
		await waitFor(() => expect(result.current.ui.menu_bar).toBe(true));
		expect(result.current.setUi).toBeUndefined();
	});

	it('saves a change against the revision it saw and shows what came back', async () => {
		const update = vi.fn(async (_patch: unknown, _based: number) => snapshot(4, true));
		const client: UiSettingsClient = {
			get: vi.fn(async () => snapshot(3, false)),
			onChanged: vi.fn(() => () => {}),
			update,
		};
		const { result } = renderHook(() => useUiSettings(client));
		await waitFor(() => expect(client.get).toHaveBeenCalled());
		await waitFor(() => expect(client.onChanged).toHaveBeenCalled());
		act(() => result.current.setUi!({ menu_bar: true }));
		await waitFor(() => expect(result.current.ui.menu_bar).toBe(true));
		expect(update.mock.calls[0]![1]).toBe(3);
	});

	it('reads again and retries once when the revision is stale', async () => {
		const update = vi
			.fn()
			.mockRejectedValueOnce(new Error('stale'))
			.mockResolvedValueOnce(snapshot(6, true));
		const get = vi
			.fn()
			.mockResolvedValueOnce(snapshot(3, false))
			.mockResolvedValueOnce(snapshot(5, false));
		const client: UiSettingsClient = { get, onChanged: vi.fn(() => () => {}), update };
		const { result } = renderHook(() => useUiSettings(client));
		await waitFor(() => expect(client.onChanged).toHaveBeenCalled());
		act(() => result.current.setUi!({ menu_bar: true }));
		await waitFor(() => expect(result.current.ui.menu_bar).toBe(true));
		expect(update.mock.calls.map((call) => call[1])).toEqual([3, 5]);
	});
});
