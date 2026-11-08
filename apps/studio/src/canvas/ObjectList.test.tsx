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
	const onSelectLine = vi.fn();
	render(<ObjectList view={shown} onSelectCell={onSelectCell} onSelectLine={onSelectLine} />);
	return { onSelectCell, onSelectLine };
}

describe('the objects list', () => {
	it('lists items, spawns, the start and problems in a named list', () => {
		setup();
		const list = screen.getByRole('list', { name: 'Objects' });
		const entries = within(list).getAllByRole('listitem');
		expect(entries.map((entry) => entry.textContent)).toEqual([
			'Ben’s start at 1, 1',
			'Item cheezie at 4, 3',
			'Spawn gloop at 6, 1',
			'Spawn bat at column 9',
			'Line 3, E004: unknown tile',
		]);
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
