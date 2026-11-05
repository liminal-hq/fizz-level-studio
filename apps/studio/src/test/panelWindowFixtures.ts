// A panel window client for the editor's tests: it keeps a list of open windows and lets a test close one
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { vi } from 'vitest';
import type { PanelWindowClient } from '../services/panelWindowClient';

export interface FakePanelWindows {
	client: PanelWindowClient;
	/** The labels of the windows open now. */
	open: Set<string>;
	/** Closes a window as the app does (its X, or the app), announcing it to the listeners. */
	close(label: string): void;
}

export function fakePanelWindows(initiallyOpen: string[] = []): FakePanelWindows {
	const open = new Set(initiallyOpen);
	const listeners = new Set<(label: string) => void>();
	const client: PanelWindowClient = {
		open: vi.fn(async () => [...open]),
		tearOff: vi.fn(async (panel: string) => void open.add(`panel-${panel}-1`)),
		dockBack: vi.fn(async (panel: string) => {
			const label = `panel-${panel}-1`;
			if (open.delete(label)) for (const listener of [...listeners]) listener(label);
		}),
		onClosed(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
	return {
		client,
		open,
		close(label) {
			if (open.delete(label)) for (const listener of [...listeners]) listener(label);
		},
	};
}
