// Tests for the New level screen with a fake client: validation, the fixed target, and Create
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FakeNewLevelClient } from '../worlds/fakeNewLevelClient';

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

import { NewLevelScreen } from './NewLevelScreen';

function setup(folder: string | null = '/levels') {
	const client = new FakeNewLevelClient();
	const pickDirectory = vi.fn(async () => folder);
	const openInMain = vi.fn(async () => {});
	const closeWindow = vi.fn(async () => {});
	render(
		<NewLevelScreen
			client={client}
			pickDirectory={pickDirectory}
			openInMain={openInMain}
			closeWindow={closeWindow}
		/>,
	);
	return { client, pickDirectory, openInMain, closeWindow, user: userEvent.setup() };
}

describe('the New level screen', () => {
	it('titles the window New level and offers both targets, Fizz 1 chosen', () => {
		setup();
		expect(screen.getByText('New level', { selector: 'span, h1, div' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Fizz 1 level' })).toBeChecked();
		expect(screen.getByRole('radio', { name: 'Fizz 2 world' })).not.toBeChecked();
		expect(screen.getByText('This cannot be changed after the level is created.')).toBeVisible();
	});

	it('fills the id from the name until the id is edited', async () => {
		const { user } = setup();
		const id = screen.getByLabelText('Id');
		await user.type(screen.getByLabelText('Name'), 'Sugar Hill');
		expect(id).toHaveValue('sugar-hill');
		await user.clear(id);
		await user.type(id, 'sweet');
		await user.type(screen.getByLabelText('Name'), ' Two');
		expect(id).toHaveValue('sweet');
	});

	it('shows the theme choice for Fizz 1 only', async () => {
		const { user } = setup();
		const theme = screen.getByLabelText('Theme');
		expect(theme).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'open-sky' })).toBeInTheDocument();
		await user.click(screen.getByRole('radio', { name: 'Fizz 2 world' }));
		expect(screen.queryByLabelText('Theme')).toBeNull();
	});

	it('shows problems beside their fields and does not create', async () => {
		const { user, client } = setup(null);
		await user.clear(screen.getByLabelText('Width'));
		await user.type(screen.getByLabelText('Width'), '3');
		await user.click(screen.getByRole('button', { name: 'Create' }));
		const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
		expect(alerts).toContain('Enter a name.');
		expect(alerts).toContain('Use lowercase letters, digits, and single hyphens.');
		expect(alerts).toContain('The width must be a whole number from 8 to 1024.');
		expect(alerts).toContain('Choose a folder.');
		expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
		expect(client.requests).toEqual([]);
	});

	it('chooses a folder with the dialog and shows it', async () => {
		const { user, pickDirectory } = setup('/work/levels');
		await user.click(screen.getByRole('button', { name: 'Choose…' }));
		expect(pickDirectory).toHaveBeenCalled();
		expect(screen.getByLabelText('Folder')).toHaveValue('/work/levels');
		expect(screen.getByLabelText('Folder')).toHaveAttribute('readonly');
	});

	it('creates a Fizz 1 level, tells the main window, and closes itself', async () => {
		const { user, client, openInMain, closeWindow } = setup('/work');
		await user.type(screen.getByLabelText('Name'), 'Sugar Hill');
		await user.selectOptions(screen.getByLabelText('Theme'), 'caves');
		await user.click(screen.getByRole('button', { name: 'Choose…' }));
		await user.click(screen.getByRole('button', { name: 'Create' }));
		await waitFor(() => expect(closeWindow).toHaveBeenCalled());
		expect(client.requests).toEqual([
			{
				name: 'Sugar Hill',
				id: 'sugar-hill',
				width: 128,
				height: 32,
				ground: null,
				theme: 'caves',
				target: 'fizz1',
				folder: '/work',
			},
		]);
		expect(openInMain).toHaveBeenCalledWith('/work/sugar-hill.fizz');
	});

	it('sends a Fizz 2 world with no theme, even after a theme was picked', async () => {
		const { user, client, openInMain } = setup('/work');
		await user.type(screen.getByLabelText('Name'), 'Hill');
		await user.selectOptions(screen.getByLabelText('Theme'), 'caves');
		await user.click(screen.getByRole('radio', { name: 'Fizz 2 world' }));
		await user.click(screen.getByRole('button', { name: 'Choose…' }));
		await user.click(screen.getByRole('button', { name: 'Create' }));
		await waitFor(() => expect(openInMain).toHaveBeenCalled());
		expect(client.requests[0]).toMatchObject({ target: 'fizz2', theme: null });
		expect(openInMain).toHaveBeenCalledWith('/work/hill/levels/hill.fizz');
	});

	it('shows a refusal from Rust as an error line and stays open', async () => {
		const { user, client, openInMain, closeWindow } = setup('/work');
		client.refuse = '/work/hill.fizz already exists';
		await user.type(screen.getByLabelText('Name'), 'Hill');
		await user.click(screen.getByRole('button', { name: 'Choose…' }));
		await user.click(screen.getByRole('button', { name: 'Create' }));
		expect(
			await screen.findByText('The level could not be created: /work/hill.fizz already exists'),
		).toBeInTheDocument();
		expect(openInMain).not.toHaveBeenCalled();
		expect(closeWindow).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
	});

	it('closes without creating on Cancel', async () => {
		const { user, client, closeWindow } = setup();
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(closeWindow).toHaveBeenCalled();
		expect(client.requests).toEqual([]);
	});
});
