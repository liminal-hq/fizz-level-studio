// Tests for the title bar's text and the native window title that follows it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const setWindowTitle = vi.hoisted(() => vi.fn(async (_title: string) => {}));
vi.mock('../services/windowTitleClient', () => ({ setWindowTitle }));

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

import { AppWindowChrome } from './AppWindowChrome';
import { AppTitleBar, type AppTitleBarProps } from './AppTitleBar';

function show(props: AppTitleBarProps) {
	return render(
		<AppWindowChrome>
			<AppTitleBar {...props} />
		</AppWindowChrome>,
	);
}

describe('the title bar', () => {
	it('reads Start with no document, and the native title says the same', () => {
		show({});
		expect(screen.getByText('Start')).toBeInTheDocument();
		expect(setWindowTitle).toHaveBeenLastCalledWith('Start');
	});

	it('reads just the document name, with a bullet after it while it has unsaved changes', () => {
		const { rerender } = show({ documentName: 'Crater Fields' });
		expect(screen.getByText('Crater Fields')).toBeInTheDocument();
		expect(setWindowTitle).toHaveBeenLastCalledWith('Crater Fields');
		rerender(
			<AppWindowChrome>
				<AppTitleBar documentName="Crater Fields" dirty />
			</AppWindowChrome>,
		);
		expect(screen.getByText('Crater Fields •')).toBeInTheDocument();
		expect(setWindowTitle).toHaveBeenLastCalledWith('Crater Fields •');
		expect(document.title).toBe('Crater Fields •');
	});

	it('gives a dialog window its own name as the native title', () => {
		show({ titleId: 'window.preferences.title' });
		expect(setWindowTitle).toHaveBeenLastCalledWith('Preferences');
	});
});
