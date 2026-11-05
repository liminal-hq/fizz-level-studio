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

import { App } from './App';

describe('App', () => {
	it('names the window it is running in', () => {
		render(<App windowLabel="main-1" />);
		expect(screen.getByRole('heading', { name: 'Fizz Level Studio' })).toBeInTheDocument();
		expect(screen.getByTestId('window-label')).toHaveTextContent('main-1');
	});

	it('draws the window controls in the title bar', () => {
		render(<App windowLabel="main-1" />);
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
	});

	describe('under the pseudo-locale', () => {
		afterEach(() => {
			resetActiveLocale();
		});

		it('marks the heading, the title bar title and the window controls', async () => {
			await activateLocale({ requested: 'en-XA', developer: true });
			render(<App windowLabel="main-1" />);
			expect(screen.getByRole('heading')).toHaveTextContent(/^\[Ƒîžž.*\]$/);
			expect(screen.getAllByText(/^\[Ƒîžž.*\]$/)).toHaveLength(2);
			expect(screen.queryByText('Fizz Level Studio')).toBeNull();
			expect(screen.getByRole('button', { name: /^\[Çĺöšé.*\]$/ })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /^\[Ḿîñîḿîšé.*\]$/ })).toBeInTheDocument();
			expect(screen.getByRole('group', { name: /^\[Ŵîñďöŵ/ })).toBeInTheDocument();
		});
	});
});
