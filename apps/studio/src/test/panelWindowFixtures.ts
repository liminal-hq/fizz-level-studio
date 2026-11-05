// A panel window client for the editor's tests: it keeps a list of open windows and lets a test close one
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { PanelPlaced } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlaced';
import type { WindowPlacement } from '@liminal-hq/fizz-studio-protocol/generated/WindowPlacement';
import { vi } from 'vitest';
import type { PanelWindowClient } from '../services/panelWindowClient';

export interface FakePanelWindows {
	client: PanelWindowClient;
	/** The labels of the windows open now. */
	open: Set<string>;
	/** Closes a window as the app does (its X, or the app), announcing it to the listeners. */
	close(label: string): void;
	/** Reports a window's place as the app does when it opens, moves or resizes. */
	place(label: string, placement: WindowPlacement, positioned?: boolean): void;
	/** Where `tearOff` opens a window when the saved place is `null`, and what it applied otherwise. */
	opened: Array<{ panel: string; asked: WindowPlacement | null }>;
}

const DEFAULT_PLACE: WindowPlacement = { x: 100, y: 120, w: 520, h: 720 };

export function fakePanelWindows(initiallyOpen: string[] = []): FakePanelWindows {
	const open = new Set(initiallyOpen);
	const listeners = new Set<(label: string) => void>();
	const placed = new Set<(placed: PanelPlaced) => void>();
	const opened: FakePanelWindows['opened'] = [];
	const client: PanelWindowClient = {
		open: vi.fn(async () => [...open]),
		tearOff: vi.fn(async (panel: string, asked?: WindowPlacement | null) => {
			open.add(`panel-${panel}-1`);
			opened.push({ panel, asked: asked ?? null });
			return {
				label: `panel-${panel}-1`,
				placement: asked ?? DEFAULT_PLACE,
				positioned: true,
			};
		}),
		dockBack: vi.fn(async (panel: string) => {
			const label = `panel-${panel}-1`;
			if (open.delete(label)) for (const listener of [...listeners]) listener(label);
		}),
		onClosed(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onPlaced(listener) {
			placed.add(listener);
			return () => placed.delete(listener);
		},
	};
	return {
		client,
		open,
		opened,
		place(label, placement, positioned = true) {
			for (const listener of [...placed]) listener({ label, placement, positioned });
		},
		close(label) {
			if (open.delete(label)) for (const listener of [...listeners]) listener(label);
		},
	};
}
