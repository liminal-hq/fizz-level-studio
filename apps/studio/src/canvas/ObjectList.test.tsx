// Tests for the objects list: its entries, choosing one and the empty level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { levelView } from '../test/levelFixtures';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { ObjectList } from './ObjectList';

const view = levelView(12, 8, {
	items: [{ kind: 'cheezie', x: 4, y: 3, generator: null, line: 9 }],
	spawns: [
		{ kind: 'gloop', x: 6, y: 1, dir: null, ride: false, on_ground: false, line: 12 },
		{ kind: 'bat', x: 9, y: null, dir: null, ride: false, on_ground: true, line: 13 },
	],
	diagnostics: [{ line: 3, code: 'E004', message: 'unknown tile' }],
});

function setup(shown: LevelView = view) {
	const onSelectCell = vi.fn();
	const onSelectThing = vi.fn();
	const onSelectLine = vi.fn();
	render(
		<ObjectList
			view={shown}
			onSelectCell={onSelectCell}
			onSelectThing={onSelectThing}
			onSelectLine={onSelectLine}
		/>,
	);
	return { onSelectCell, onSelectThing, onSelectLine };
}

describe('the objects list', () => {
	it('lists items, spawns, the start and problems in a named list', () => {
		setup();
		const list = screen.getByRole('list', { name: 'Objects' });
		const entries = within(list).getAllByRole('listitem');
		expect(entries.map((entry) => entry.textContent)).toEqual([
			'Ben’s start at 1, 1line 2',
			'Item cheezie at 4, 3line 9',
			'Spawn gloop at 6, 1line 12',
			'Spawn bat at column 9line 13',
			'Line 3, E004: unknown tile',
		]);
	});

	it('shows the script line at the end of each row, outside the button that names it', () => {
		setup();
		const row = screen.getByRole('button', { name: 'Item cheezie at 4, 3' }).closest('li')!;
		expect(within(row).getByText('line 9')).toBeInTheDocument();
		expect(within(row).getByRole('button')).toHaveAccessibleName('Item cheezie at 4, 3');
	});

	it('narrows the list by a thing’s name, kind, or line, and says so when nothing matches', async () => {
		const user = userEvent.setup();
		setup();
		const filter = screen.getByRole('searchbox', { name: 'Filter things' });
		const names = () =>
			within(screen.getByRole('list', { name: 'Objects' }))
				.getAllByRole('listitem')
				.map((row) => within(row).queryByRole('button')?.textContent ?? row.textContent);
		await user.type(filter, 'gloop');
		expect(names()).toEqual(['Spawn gloop at 6, 1']);
		await user.clear(filter);
		await user.type(filter, 'enemy');
		expect(names()).toEqual(['Spawn gloop at 6, 1', 'Spawn bat at column 9']);
		await user.clear(filter);
		await user.type(filter, 'treat');
		expect(names()).toEqual(['Item cheezie at 4, 3']);
		await user.clear(filter);
		await user.type(filter, 'line 13');
		expect(names()).toEqual(['Spawn bat at column 9']);
		await user.clear(filter);
		await user.type(filter, 'E004');
		expect(names()).toEqual(['Line 3, E004: unknown tile']);
		await user.clear(filter);
		await user.type(filter, 'zzz');
		expect(screen.getByText('Nothing matches “zzz”')).toBeInTheDocument();
	});

	it('clears the filter with Escape while it has focus, and keeps Escape for the filter', async () => {
		const user = userEvent.setup();
		setup();
		const filter = screen.getByRole('searchbox', { name: 'Filter things' });
		await user.type(filter, 'bat');
		await user.keyboard('{Escape}');
		expect(filter).toHaveValue('');
		expect(screen.getAllByRole('listitem')).toHaveLength(5);
	});

	it('marks the selected thing’s row and no other', () => {
		const onSelectCell = vi.fn();
		render(
			<ObjectList
				view={view}
				onSelectCell={onSelectCell}
				selected={{
					kind: 'enemy',
					name: 'bat',
					x: 9,
					y: 1,
					layer: 'objects',
					index: 1,
					line: 13,
				}}
			/>,
		);
		expect(screen.getByRole('button', { name: 'Spawn bat at column 9' })).toHaveAttribute(
			'aria-current',
			'true',
		);
		expect(screen.getByRole('button', { name: 'Spawn gloop at 6, 1' })).not.toHaveAttribute(
			'aria-current',
		);
		expect(screen.getByRole('button', { name: 'Item cheezie at 4, 3' })).not.toHaveAttribute(
			'aria-current',
		);
	});

	it('hands the cell of an entry to the caller when it is chosen from the keyboard', async () => {
		const user = userEvent.setup();
		const { onSelectCell } = setup();
		await user.click(screen.getByRole('button', { name: 'Item cheezie at 4, 3' }));
		expect(onSelectCell).toHaveBeenLastCalledWith({ x: 4, y: 3 });
		const spawn = screen.getByRole('button', { name: 'Spawn gloop at 6, 1' });
		spawn.focus();
		await user.keyboard('{Enter}');
		expect(onSelectCell).toHaveBeenLastCalledWith({ x: 6, y: 1 });
		// A spawn with no row rests on the ground in its column (the floor is row 0).
		await user.click(screen.getByRole('button', { name: 'Spawn bat at column 9' }));
		expect(onSelectCell).toHaveBeenLastCalledWith({ x: 9, y: 1 });
	});

	it('selects the thing chosen, with its place in the level’s lists and its line', async () => {
		const user = userEvent.setup();
		const { onSelectThing } = setup();
		await user.click(screen.getByRole('button', { name: 'Item cheezie at 4, 3' }));
		expect(onSelectThing).toHaveBeenLastCalledWith({
			kind: 'item',
			name: 'cheezie',
			x: 4,
			y: 3,
			layer: 'objects',
			index: 0,
			line: 9,
		});
		await user.click(screen.getByRole('button', { name: 'Spawn bat at column 9' }));
		expect(onSelectThing).toHaveBeenLastCalledWith({
			kind: 'enemy',
			name: 'bat',
			x: 9,
			y: 1,
			layer: 'objects',
			index: 1,
			line: 13,
		});
		await user.click(screen.getByRole('button', { name: 'Ben’s start at 1, 1' }));
		expect(onSelectThing).toHaveBeenLastCalledWith({
			kind: 'start',
			name: 'start',
			x: 1,
			y: 1,
			layer: 'objects',
			index: 0,
			line: 2,
		});
	});

	it('hands a chosen problem to the caller as its line', async () => {
		const user = userEvent.setup();
		const { onSelectLine } = setup();
		await user.click(screen.getByRole('button', { name: /E004/ }));
		expect(onSelectLine).toHaveBeenCalledWith(3);
	});

	it('says so when the level has nothing in it', () => {
		setup(levelView(4, 4, { start: null }));
		expect(screen.getByText('Nothing placed yet')).toBeInTheDocument();
	});
});
