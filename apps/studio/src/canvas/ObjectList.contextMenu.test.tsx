// Tests for the Objects list's right-click: it selects the row's thing unless it is selected, then opens its menu
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenuContext, type ContextMenuApi } from '../app/useContextMenu';
import { levelView } from '../test/levelFixtures';
import type { Thing } from '../tools/tool';
import { ObjectList } from './ObjectList';

const view = levelView(12, 8, {
	items: [{ kind: 'cheezie', x: 4, y: 3, generator: null, line: 9 }],
	spawns: [{ kind: 'gloop', x: 6, y: 1, dir: null, ride: false, on_ground: false, line: 12 }],
});

function setup(selected: Thing | null = null) {
	const menu: ContextMenuApi = { open: vi.fn(), update: vi.fn(), close: vi.fn() };
	const onSelectCell = vi.fn();
	const onSelectThing = vi.fn();
	render(
		<ContextMenuContext.Provider value={menu}>
			<ObjectList
				view={view}
				onSelectCell={onSelectCell}
				onSelectThing={onSelectThing}
				selected={selected}
			/>
		</ContextMenuContext.Provider>,
	);
	return { menu, onSelectCell, onSelectThing };
}

const gloop: Thing = {
	kind: 'enemy',
	name: 'gloop',
	x: 6,
	y: 1,
	layer: 'objects',
	index: 0,
	line: 12,
};

describe('the Objects list context menu', () => {
	it('selects the row’s thing, not moving the cursor, then opens its menu at the pointer', () => {
		const { menu, onSelectCell, onSelectThing } = setup();
		const row = screen.getByRole('button', { name: /gloop/i });
		const event = createEvent.contextMenu(row, { clientX: 30, clientY: 40 });
		fireEvent(row, event);
		expect(event.defaultPrevented).toBe(true);
		expect(onSelectThing).toHaveBeenCalledWith(gloop);
		expect(onSelectCell).not.toHaveBeenCalled();
		expect(menu.open).toHaveBeenCalledWith(
			{ kind: 'objectRow', thing: gloop },
			{ x: 30, y: 40 },
			expect.objectContaining({ keyboard: false, returnFocusTo: row }),
		);
	});

	it('leaves the selection alone when the row is already selected', () => {
		const { menu, onSelectThing } = setup(gloop);
		fireEvent.contextMenu(screen.getByRole('button', { name: /gloop/i }));
		expect(onSelectThing).not.toHaveBeenCalled();
		expect(menu.open).toHaveBeenCalledTimes(1);
	});

	it('opens at the row’s button from the Menu key and Shift+F10, with the keyboard flag', () => {
		const { menu, onSelectThing } = setup();
		const row = screen.getByRole('button', { name: /cheezie/i });
		fireEvent.keyDown(row, { key: 'ContextMenu' });
		fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
		expect(menu.open).toHaveBeenCalledTimes(2);
		expect(menu.open).toHaveBeenLastCalledWith(
			expect.objectContaining({ kind: 'objectRow' }),
			row,
			{ keyboard: true, returnFocusTo: row },
		);
		expect(onSelectThing).toHaveBeenCalledTimes(2);
	});

	it('opens no menu on a problem row, which is not a thing', () => {
		const { menu } = setup();
		expect(menu.open).not.toHaveBeenCalled();
	});
});
