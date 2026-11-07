// Tests for the Transparency page: its rows, saving each change, the live preview, the window group's availability and the reset
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Settings } from '@liminal-hq/fizz-studio-protocol/generated/Settings';
import type { SettingsPatch } from '@liminal-hq/fizz-studio-protocol/generated/SettingsPatch';
import type { SettingsSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/SettingsSnapshot';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsClient } from '../services/settingsClient';
import type { WindowEffectsAvailability } from '../services/windowEffectsClient';
import { TRANSPARENCY_DEFAULTS } from '../theme/transparency';

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
	transparency: TRANSPARENCY_DEFAULTS,
	larger_controls: false,
	locale: 'en-CA',
	recent_worlds: [],
	layout: {},
	ui: { menu_bar: false, toolbar: 'classic', ribbon_folded: false },
	dock: { active: '', workspaces: {} },
};

const EVERYTHING: WindowEffectsAvailability = { seeThrough: true, blur: true };

function setup(
	options: {
		over?: Partial<Settings>;
		effects?: WindowEffectsAvailability;
		reduced?: boolean;
		refuse?: (patch: SettingsPatch) => unknown;
	} = {},
) {
	let current: SettingsSnapshot = { revision: 0, settings: { ...BASE, ...options.over } };
	const client: SettingsClient = {
		get: vi.fn(async () => current),
		update: vi.fn(async (patch: SettingsPatch) => {
			const refusal = options.refuse?.(patch);
			if (refusal) throw refusal;
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
			accent: null,
			reducedTransparency: options.reduced ?? false,
			contrast: 'normal' as const,
		}),
	};
	const scheme = { system: async () => 'dark' as const };
	const effects = { availability: async () => options.effects ?? EVERYTHING };
	render(<PreferencesScreen client={client} accent={accent} scheme={scheme} effects={effects} />);
	return client;
}

async function openTransparency(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole('button', { name: 'Transparency' }));
	await screen.findByRole('heading', { name: 'Transparency', level: 2 });
}

/** The transparency patch of the last update. */
function lastTransparency(client: SettingsClient) {
	const calls = vi.mocked(client.update).mock.calls;
	return calls[calls.length - 1]![0].transparency;
}

const slider = (name: string) => screen.getByRole('slider', { name });

describe('the Transparency page', () => {
	it('is listed with an icon and shows every row in its two groups', async () => {
		const user = userEvent.setup();
		setup();
		const entry = await screen.findByRole('button', { name: 'Transparency' });
		expect(entry.querySelector('svg')).not.toBeNull();
		await openTransparency(user);
		expect(screen.getByRole('heading', { name: 'Panels and menus' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Window' })).toBeInTheDocument();
		for (const name of ['Blur', 'Saturation', 'Panel opacity', 'Menu opacity']) {
			expect(slider(name)).toBeInTheDocument();
		}
		expect(slider('Blur')).toHaveValue('16');
		expect(slider('Saturation')).toHaveValue('120');
		expect(slider('Panel opacity')).toHaveValue('88');
		expect(slider('Menu opacity')).toHaveValue('96');
		const switches: [string, boolean][] = [
			['Docked panels', true],
			['Floating panels', true],
			['Menus', false],
			['Dialogs', false],
			['Title bar', false],
			['Transparent window', false],
			['Solid when unfocused', true],
		];
		for (const [name, on] of switches) {
			expect(screen.getByRole('switch', { name })).toHaveAttribute('aria-checked', String(on));
		}
		expect(screen.getByRole('radiogroup', { name: 'Desktop blur' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Low' })).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
		expect(screen.getByRole('img', { name: 'Transparency preview' })).toBeInTheDocument();
	});

	it('dims the menu opacity while menus are solid, and the window rows while the window is', async () => {
		const user = userEvent.setup();
		setup();
		await openTransparency(user);
		expect(slider('Menu opacity')).toBeDisabled();
		expect(screen.getByRole('switch', { name: 'Solid when unfocused' })).toBeDisabled();
		expect(screen.getByRole('radio', { name: 'Low' })).toBeDisabled();
	});

	it('saves a switch with the rest of the group as it was', async () => {
		const user = userEvent.setup();
		const client = setup();
		await openTransparency(user);
		await user.click(screen.getByRole('switch', { name: 'Menus' }));
		await waitFor(() =>
			expect(client.update).toHaveBeenCalledWith(
				{ transparency: { ...TRANSPARENCY_DEFAULTS, menus: true } },
				0,
			),
		);
		await waitFor(() => expect(slider('Menu opacity')).not.toBeDisabled());
		await user.click(screen.getByRole('switch', { name: 'Docked panels' }));
		await waitFor(() =>
			expect(lastTransparency(client)).toEqual({
				...TRANSPARENCY_DEFAULTS,
				menus: true,
				docks: false,
			}),
		);
	});

	it('previews a slider while it is dragged and saves it when it is let go', async () => {
		const user = userEvent.setup();
		const client = setup();
		await openTransparency(user);
		const preview = screen.getByTestId('transparency-preview');
		expect(preview.style.getPropertyValue('--fls-preview-blur')).toBe('16px');
		fireEvent.input(slider('Blur'), { target: { value: '30' } });
		expect(preview.style.getPropertyValue('--fls-preview-blur')).toBe('30px');
		expect(client.update).not.toHaveBeenCalled();
		fireEvent.input(slider('Saturation'), { target: { value: '180' } });
		expect(preview.style.getPropertyValue('--fls-preview-saturation')).toBe('180%');
		fireEvent.input(slider('Panel opacity'), { target: { value: '50' } });
		expect(preview.style.getPropertyValue('--fls-preview-alpha')).toBe('0.5');
		// The native change event is the release.
		slider('Blur').dispatchEvent(new Event('change', { bubbles: false }));
		await waitFor(() => expect(lastTransparency(client)?.blur).toBe(30));
	});

	it('follows the surface switches in the preview, and draws it solid while glass is off', async () => {
		const user = userEvent.setup();
		setup({ over: { transparency: { ...TRANSPARENCY_DEFAULTS, menus: true, docks: false } } });
		await openTransparency(user);
		expect(screen.getByTestId('preview-menu')).toHaveAttribute('data-glass', 'on');
		expect(screen.getByTestId('preview-dock')).toHaveAttribute('data-glass', 'off');
		expect(screen.getByTestId('preview-floating')).toHaveAttribute('data-glass', 'on');
		expect(screen.queryByText(/so every surface is drawn solid/)).toBeNull();
	});

	it('says everything is solid when the master switch is off', async () => {
		const user = userEvent.setup();
		setup({ over: { glass: 'off' } });
		await openTransparency(user);
		expect(screen.getByText(/so every surface is drawn solid/)).toBeInTheDocument();
		expect(screen.getByTestId('preview-floating')).toHaveAttribute('data-glass', 'off');
		expect(
			screen.getByTestId('transparency-preview').style.getPropertyValue('--fls-preview-blur'),
		).toBe('0px');
	});

	it('turns the window on and picks its blur', async () => {
		const user = userEvent.setup();
		const client = setup();
		await openTransparency(user);
		await user.click(screen.getByRole('switch', { name: 'Transparent window' }));
		await waitFor(() => expect(lastTransparency(client)?.window_enabled).toBe(true));
		await waitFor(() => expect(screen.getByRole('radio', { name: 'High' })).not.toBeDisabled());
		await user.click(screen.getByRole('radio', { name: 'High' }));
		await waitFor(() => expect(lastTransparency(client)?.window_blur).toBe('high'));
		await user.click(screen.getByRole('switch', { name: 'Solid when unfocused' }));
		await waitFor(() => expect(lastTransparency(client)?.solid_when_unfocused).toBe(false));
	});

	it('leaves the blur out where nothing can blur, and dims the window where it cannot be see-through', async () => {
		const user = userEvent.setup();
		setup({ effects: { seeThrough: true, blur: false } });
		await openTransparency(user);
		expect(screen.queryByRole('radiogroup', { name: 'Desktop blur' })).toBeNull();
		expect(screen.getByText(/cannot blur behind windows/)).toBeInTheDocument();
	});

	it('says why the window cannot be see-through', async () => {
		const user = userEvent.setup();
		setup({ effects: { seeThrough: false, blur: false } });
		await openTransparency(user);
		expect(screen.getByRole('switch', { name: 'Transparent window' })).toBeDisabled();
		expect(
			await screen.findByText(/This system cannot draw see-through windows\./),
		).toBeInTheDocument();
	});

	it('shows a refused value beside its slider', async () => {
		const user = userEvent.setup();
		setup({
			refuse: (patch) =>
				patch.transparency
					? { kind: 'invalid-field', field: 'transparency-blur', message: 'bad' }
					: null,
		});
		await openTransparency(user);
		fireEvent.input(slider('Blur'), { target: { value: '12' } });
		slider('Blur').dispatchEvent(new Event('change'));
		const message = await screen.findByText('That value is outside the range this setting allows.');
		expect(message).toHaveAttribute('role', 'alert');
	});

	it('resets the group to its defaults', async () => {
		const user = userEvent.setup();
		const client = setup({
			over: { transparency: { ...TRANSPARENCY_DEFAULTS, blur: 4, dialogs: true } },
		});
		await openTransparency(user);
		const reset = screen.getByRole('button', { name: 'Reset to defaults' });
		expect(reset).not.toBeDisabled();
		await user.click(reset);
		await waitFor(() =>
			expect(client.update).toHaveBeenLastCalledWith({ transparency: TRANSPARENCY_DEFAULTS }, 0),
		);
		await waitFor(() => expect(slider('Blur')).toHaveValue('16'));
	});
});
