// Tests for the Preferences window: the Appearance page shows the values, saves changes and reports errors
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Settings } from '@liminal-hq/fizz-studio-protocol/generated/Settings';
import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsClient } from '../services/settingsClient';

// The chrome follows the real window; in a test there is none, so it gets a quiet stand-in.
vi.mock('@tauri-apps/api/window', () => {
	const win = {
		minimize: async () => {},
		toggleMaximize: async () => {},
		close: async () => {},
		startDragging: async () => {},
		setAlwaysOnTop: async () => {},
		isAlwaysOnTop: async () => false,
		isMaximized: async () => false,
		onResized: async () => () => {},
		isFocused: async () => true,
		onFocusChanged: async () => () => {},
	};
	return { getCurrentWindow: () => win };
});

import { PreferencesScreen } from './PreferencesScreen';

const BASE: Settings = {
	colour_mode: 'system',
	accent: { kind: 'system' },
	glass: 'system',
	larger_controls: false,
	locale: 'en-CA',
	recent_worlds: [],
	layout: {},
};

function setup(over: Partial<Settings> = {}, refuseHex = false) {
	let current: SettingsSnapshot = { revision: 0, settings: { ...BASE, ...over } };
	const client: SettingsClient = {
		get: vi.fn(async () => current),
		update: vi.fn(async (patch) => {
			if (
				refuseHex &&
				patch.accent?.kind === 'custom' &&
				!/^#[0-9a-f]{6}$/.test(patch.accent.hex)
			) {
				throw { kind: 'invalid-field', field: 'accent-hex', message: 'bad' };
			}
			current = {
				revision: current.revision + 1,
				settings: { ...current.settings, ...(patch as Partial<Settings>) },
			};
			return current;
		}),
		onChanged: () => () => {},
	};
	const accent = {
		accentAvailable: async () => true,
		hints: async () => ({
			accent: '#3584e4',
			reducedTransparency: false,
			contrast: 'normal' as const,
		}),
	};
	const scheme = { system: async () => 'dark' as const };
	render(<PreferencesScreen client={client} accent={accent} scheme={scheme} />);
	return client;
}

describe('PreferencesScreen', () => {
	it('shows the Appearance page with the saved values', async () => {
		setup({ colour_mode: 'dark', glass: 'off', accent: { kind: 'afterglow-orange' } });
		expect(
			await screen.findByRole('heading', { name: 'Appearance', level: 2 }),
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Colours' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Effects' })).toBeInTheDocument();
		const mode = screen.getByRole('radiogroup', { name: 'Colour mode' });
		expect(mode.querySelector('[aria-checked="true"]')).toHaveTextContent('Dark');
		expect(
			screen
				.getByRole('radiogroup', { name: 'Glass panels' })
				.querySelector('[aria-checked="true"]'),
		).toHaveTextContent('Off');
		expect(screen.getByRole('combobox', { name: 'Accent' })).toHaveValue('afterglow-orange');
		expect(screen.getByText(/Off draws solid panels/)).toBeInTheDocument();
	});

	it('saves a change when a choice is made', async () => {
		const user = userEvent.setup();
		const client = setup();
		await screen.findByRole('heading', { name: 'Appearance', level: 2 });
		await user.click(screen.getByRole('radio', { name: 'Light' }));
		await waitFor(() => expect(client.update).toHaveBeenCalledWith({ colour_mode: 'light' }, 0));
		await user.selectOptions(screen.getByRole('combobox', { name: 'Accent' }), 'afterglow-purple');
		await waitFor(() =>
			expect(client.update).toHaveBeenLastCalledWith({ accent: { kind: 'afterglow-purple' } }, 1),
		);
	});

	it('shows the hex field for a custom accent and an error for a bad code', async () => {
		const user = userEvent.setup();
		setup({ accent: { kind: 'custom', hex: '#123abc' } }, true);
		const field = await screen.findByRole('textbox', { name: 'Custom accent code' });
		expect(field).toHaveValue('#123abc');
		await user.clear(field);
		await user.type(field, 'banana{Enter}');
		const message = await screen.findByText(/six lowercase hex digits, such as #00e5ff/);
		expect(message).toHaveAttribute('role', 'alert');
		expect(field).toHaveAttribute('aria-invalid', 'true');
		expect(field.getAttribute('aria-describedby')).toContain(message.id);
	});

	it('lowercases a typed hex code before saving it', async () => {
		const user = userEvent.setup();
		const client = setup({ accent: { kind: 'custom', hex: '#123abc' } });
		const field = await screen.findByRole('textbox', { name: 'Custom accent code' });
		await user.clear(field);
		await user.type(field, ' #ABCDEF {Enter}');
		await waitFor(() =>
			expect(client.update).toHaveBeenCalledWith({ accent: { kind: 'custom', hex: '#abcdef' } }, 0),
		);
	});

	it('explains the contrast result for the chosen accent', async () => {
		setup({ accent: { kind: 'afterglow-purple' } });
		await screen.findByRole('group', { name: 'Preview' });
		expect(screen.getByText(/Key label #[0-9a-f]{6}, contrast \d+\.\d to 1\./)).toBeInTheDocument();
	});

	it('says when the key was darkened to stay readable', async () => {
		// A mid-tone green is too light for white and too dark for near-black ink.
		setup({ accent: { kind: 'custom', hex: '#2a8a4a' } });
		await screen.findByRole('group', { name: 'Preview' });
		expect(screen.getByText(/The key was darkened to stay readable\./)).toBeInTheDocument();
	});

	it('puts the page back to its defaults', async () => {
		const user = userEvent.setup();
		const client = setup({ colour_mode: 'dark', glass: 'on', accent: { kind: 'studio' } });
		await screen.findByRole('heading', { name: 'Appearance', level: 2 });
		await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
		await waitFor(() =>
			expect(client.update).toHaveBeenCalledWith(
				{ colour_mode: 'system', accent: { kind: 'system' }, glass: 'system' },
				0,
			),
		);
		await waitFor(() =>
			expect(screen.getByRole('combobox', { name: 'Accent' })).toHaveValue('system'),
		);
	});
});
