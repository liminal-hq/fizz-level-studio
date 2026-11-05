// Tests for the Appearance settings editor: loading, save-on-change, per-field errors, stale retries
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Settings } from '@liminal-hq/fizz-studio-protocol/generated/Settings';
import type { SettingsPatch } from '@liminal-hq/fizz-studio-protocol/generated/SettingsPatch';
import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsClient } from '../services/settingsClient';
import { useAppearanceSettings } from './useAppearanceSettings';

const BASE: Settings = {
	colour_mode: 'system',
	accent: { kind: 'system' },
	glass: 'system',
	larger_controls: false,
	locale: 'en-CA',
	recent_worlds: [],
	layout: {},
};

function snapshot(revision: number, over: Partial<Settings> = {}): SettingsSnapshot {
	return { revision, settings: { ...BASE, ...over } };
}

/** A client over one in-memory document; `update` can be told to refuse. */
function fakeClient(refuse?: (patch: SettingsPatch, basedOn: number) => unknown) {
	let current = snapshot(0);
	let heard: (snapshot: SettingsSnapshot) => void = () => {};
	const stop = vi.fn();
	const client: SettingsClient = {
		get: vi.fn(async () => current),
		update: vi.fn(async (patch, basedOn) => {
			const refusal = refuse?.(patch, basedOn);
			if (refusal) throw refusal;
			current = {
				revision: current.revision + 1,
				settings: { ...current.settings, ...(patch as Partial<Settings>) },
			};
			return current;
		}),
		onChanged: (listener) => {
			heard = listener;
			return stop;
		},
	};
	return {
		client,
		stop,
		hear: (next: SettingsSnapshot) => {
			current = next;
			heard(next);
		},
	};
}

describe('useAppearanceSettings', () => {
	it('loads the values in force', async () => {
		const { client } = fakeClient();
		const { result } = renderHook(() => useAppearanceSettings(client));
		expect(result.current.values).toBeNull();
		await waitFor(() => expect(result.current.values).not.toBeNull());
		expect(result.current.values).toEqual({
			colour_mode: 'system',
			accent: { kind: 'system' },
			glass: 'system',
		});
	});

	it('saves a change at once against the revision it last saw', async () => {
		const { client } = fakeClient();
		const { result } = renderHook(() => useAppearanceSettings(client));
		await waitFor(() => expect(result.current.values).not.toBeNull());
		await act(() => result.current.change('glass', { glass: 'off' }));
		expect(client.update).toHaveBeenCalledWith({ glass: 'off' }, 0);
		expect(result.current.values?.glass).toBe('off');
		expect(result.current.errors).toEqual({});
	});

	it('shows a bad hex against the hex field and leaves the values alone', async () => {
		const { client } = fakeClient(() => ({
			kind: 'invalid-field',
			field: 'accent-hex',
			message: 'no',
		}));
		const { result } = renderHook(() => useAppearanceSettings(client));
		await waitFor(() => expect(result.current.values).not.toBeNull());
		await act(() =>
			result.current.change('accentHex', { accent: { kind: 'custom', hex: 'nope' } }),
		);
		expect(result.current.errors.accentHex).toMatch(/six lowercase hex digits/);
		expect(result.current.values?.accent).toEqual({ kind: 'system' });
		await act(() => result.current.change('glass', { glass: 'on' }));
		expect(result.current.errors.accentHex).toMatch(/six lowercase/);
	});

	it('clears a field’s error when that field is changed again', async () => {
		let fail = true;
		const { client } = fakeClient(() => (fail ? { kind: 'storage', message: 'disk' } : null));
		const { result } = renderHook(() => useAppearanceSettings(client));
		await waitFor(() => expect(result.current.values).not.toBeNull());
		await act(() => result.current.change('glass', { glass: 'off' }));
		expect(result.current.errors.glass).toBe('The change could not be saved.');
		fail = false;
		await act(() => result.current.change('glass', { glass: 'off' }));
		expect(result.current.errors.glass).toBeUndefined();
	});

	it('reads again and retries once when the revision was stale', async () => {
		let refusals = 1;
		const { client } = fakeClient(() =>
			refusals-- > 0 ? { kind: 'stale', based_on: 0, current: 3 } : null,
		);
		const { result } = renderHook(() => useAppearanceSettings(client));
		await waitFor(() => expect(result.current.values).not.toBeNull());
		await act(() => result.current.change('colourMode', { colour_mode: 'dark' }));
		expect(client.update).toHaveBeenCalledTimes(2);
		expect(result.current.values?.colour_mode).toBe('dark');
		expect(result.current.errors).toEqual({});
	});

	it('follows a change made in another window and stops listening on unmount', async () => {
		const fake = fakeClient();
		const { result, unmount } = renderHook(() => useAppearanceSettings(fake.client));
		await waitFor(() => expect(result.current.values).not.toBeNull());
		act(() => fake.hear(snapshot(4, { accent: { kind: 'afterglow-purple' } })));
		expect(result.current.values?.accent).toEqual({ kind: 'afterglow-purple' });
		act(() => fake.hear(snapshot(2, { accent: { kind: 'studio' } })));
		expect(result.current.values?.accent).toEqual({ kind: 'afterglow-purple' });
		unmount();
		expect(fake.stop).toHaveBeenCalled();
	});

	it('resets the page’s settings to the defaults', async () => {
		const { client } = fakeClient();
		const { result } = renderHook(() => useAppearanceSettings(client));
		await waitFor(() => expect(result.current.values).not.toBeNull());
		await act(() => result.current.change('glass', { glass: 'off' }));
		await act(() => result.current.reset());
		expect(client.update).toHaveBeenLastCalledWith(
			{ colour_mode: 'system', accent: { kind: 'system' }, glass: 'system' },
			1,
		);
		expect(result.current.values?.glass).toBe('system');
	});

	it('reports settings that cannot be read', async () => {
		const client: SettingsClient = {
			get: async () => {
				throw new Error('no plugin');
			},
			update: async () => snapshot(1),
			onChanged: () => () => {},
		};
		const { result } = renderHook(() => useAppearanceSettings(client));
		await waitFor(() => expect(result.current.unavailable).toBe(true));
	});
});
