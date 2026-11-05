// Tests for the root component
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
});
