// Tests for the root component
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetActiveLocale } from '../i18n/active';
import { activateLocale } from '../i18n/loadCatalogue';

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

// The main screen has its own tests; here it only has to be chosen.
vi.mock('./MainScreen', () => ({ MainScreen: () => <p data-testid="main-screen" /> }));

vi.mock('../preferences/PreferencesScreen', () => ({
	PreferencesScreen: () => <p data-testid="preferences-screen" />,
}));

vi.mock('./NewLevelScreen', () => ({ NewLevelScreen: () => <p data-testid="new-level-screen" /> }));

import { App } from './App';

describe('App', () => {
	it('shows the main screen in a main window', () => {
		render(<App windowLabel="main-1" />);
		expect(screen.getByTestId('main-screen')).toBeInTheDocument();
	});

	it.each([['about', 'About Fizz Level Studio', 'About is coming.']])(
		'shows a placeholder in the %s window',
		(label, title, message) => {
			render(<App windowLabel={label} />);
			expect(screen.getByText(title)).toBeInTheDocument();
			expect(screen.getByText(message)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
			expect(screen.queryByTestId('main-screen')).toBeNull();
		},
	);

	it('shows the Preferences screen in the preferences window', () => {
		render(<App windowLabel="preferences" />);
		expect(screen.getByTestId('preferences-screen')).toBeInTheDocument();
	});

	it('shows the New level screen in the new-world window', () => {
		render(<App windowLabel="new-world" />);
		expect(screen.getByTestId('new-level-screen')).toBeInTheDocument();
	});

	it.each(['mystery', 'main-0', 'panel-game-view-1', 'tear-ghost'])(
		'shows nothing for %s',
		(label) => {
			const { container } = render(<App windowLabel={label} />);
			expect(container).toBeEmptyDOMElement();
		},
	);

	it('shows the Script panel with a Dock back button in its own window', () => {
		render(<App windowLabel="panel-script-1" />);
		expect(screen.getByText('The script will appear here.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Dock back' })).toBeInTheDocument();
	});

	describe('under the pseudo-locale', () => {
		afterEach(() => {
			resetActiveLocale();
		});

		it('marks the title bar title, the message and the window controls', async () => {
			await activateLocale({ requested: 'en-XA', developer: true });
			render(<App windowLabel="about" />);
			expect(screen.getAllByText(/^\[.+\]$/)).toHaveLength(2);
			expect(screen.queryByText('About is coming.')).toBeNull();
			expect(screen.getByRole('button', { name: /^\[Çĺöšé.*\]$/ })).toBeInTheDocument();
			expect(screen.getByRole('group', { name: /^\[Ŵîñďöŵ/ })).toBeInTheDocument();
		});
	});
});
