// Tests for the Layers panel's right-click: it changes nothing, and opens the layer's menu
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenuContext, type ContextMenuApi } from '../../app/useContextMenu';
import { levelSections } from '../../test/levelFixtures';
import { LayersPanel } from './LayersPanel';

function setup(sections = levelSections()) {
	const menu: ContextMenuApi = { open: vi.fn(), update: vi.fn(), close: vi.fn() };
	const handlers = {
		onToggleHidden: vi.fn(),
		onShowAll: vi.fn(),
		onToggleLocked: vi.fn(),
		onUnlockAll: vi.fn(),
		onReveal: vi.fn(),
	};
	render(
		<ContextMenuContext.Provider value={menu}>
			<LayersPanel sections={sections} hidden={[]} locked={[]} target="fizz1" {...handlers} />
		</ContextMenuContext.Provider>,
	);
	return { menu, handlers };
}

describe('the Layers panel context menu', () => {
	it('opens the layer’s menu at the pointer and changes nothing', () => {
		const { menu, handlers } = setup();
		const row = screen.getByRole('button', { name: /^Treats/ });
		const event = createEvent.contextMenu(row, { clientX: 12, clientY: 34 });
		fireEvent(row, event);
		expect(event.defaultPrevented).toBe(true);
		expect(menu.open).toHaveBeenCalledWith(
			{ kind: 'layerRow', layer: 'treats' },
			{ x: 12, y: 34 },
			expect.objectContaining({ returnFocusTo: row }),
		);
		for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
	});

	it('opens on the eye and the padlock too, since they are part of the row', () => {
		const { menu } = setup();
		fireEvent.contextMenu(screen.getByRole('button', { name: 'Hide Terrain on the canvas' }));
		fireEvent.contextMenu(screen.getByRole('button', { name: 'Lock Blocks' }));
		expect(menu.open).toHaveBeenNthCalledWith(
			1,
			{ kind: 'layerRow', layer: 'terrain' },
			expect.anything(),
			expect.anything(),
		);
		expect(menu.open).toHaveBeenNthCalledWith(
			2,
			{ kind: 'layerRow', layer: 'blocks' },
			expect.anything(),
			expect.anything(),
		);
	});

	it('opens at the focused button from the Menu key and Shift+F10, with the keyboard flag', () => {
		const { menu } = setup();
		const lock = screen.getByRole('button', { name: 'Lock Enemies' });
		fireEvent.keyDown(lock, { key: 'ContextMenu' });
		fireEvent.keyDown(lock, { key: 'F10', shiftKey: true });
		expect(menu.open).toHaveBeenCalledTimes(2);
		expect(menu.open).toHaveBeenLastCalledWith({ kind: 'layerRow', layer: 'enemies' }, lock, {
			keyboard: true,
			returnFocusTo: lock,
		});
	});

	it('has no rows to open a menu on a level with no layers', () => {
		const { menu } = setup([]);
		expect(screen.queryByRole('list', { name: 'Layers' })).toBeNull();
		expect(menu.open).not.toHaveBeenCalled();
	});
});
