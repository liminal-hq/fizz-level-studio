// Tests for the Layers panel: its rows, the eye, choosing a layer and the empty states
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { levelSections } from '../../test/levelFixtures';
import { LayersPanel, type LayersPanelProps } from './LayersPanel';

function setup(props: Partial<LayersPanelProps> = {}) {
	const handlers = { onToggleHidden: vi.fn(), onShowAll: vi.fn(), onReveal: vi.fn() };
	render(
		<LayersPanel sections={levelSections()} hidden={[]} target="fizz1" {...handlers} {...props} />,
	);
	return handlers;
}

describe('the Layers panel', () => {
	it('lists each layer with its name, its note and its count', () => {
		setup();
		const list = screen.getByRole('list', { name: 'Layers' });
		const rows = within(list).getAllByRole('listitem');
		expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual([
			'Terrain',
			'Blocks',
			'Markers',
			'Treats',
			'Enemies',
		]);
		expect(within(rows[3]!).getByText('Items to collect')).toBeVisible();
		expect(within(rows[3]!).getByText('4')).toBeVisible();
	});

	it('hides a thing layer from its eye, which says whether it is hidden', async () => {
		const user = userEvent.setup();
		const { onToggleHidden } = setup({ hidden: ['enemies'] });
		const treats = screen.getByRole('button', { name: 'Hide Treats on the canvas' });
		expect(treats).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: 'Hide Enemies on the canvas' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await user.click(treats);
		expect(onToggleHidden).toHaveBeenCalledWith('treats');
	});

	it('holds back the eye of a tile layer and says why', () => {
		setup();
		const terrain = screen.getByRole('button', { name: 'Hide Terrain on the canvas' });
		expect(terrain).toBeDisabled();
		expect(terrain).toHaveAttribute('title', 'Coming with tile layers');
	});

	it('shows the first line of a layer in the script when its name is chosen', async () => {
		const user = userEvent.setup();
		const { onReveal } = setup();
		await user.click(screen.getByRole('button', { name: /^Treats/ }));
		expect(onReveal).toHaveBeenCalledWith(15);
	});

	it('shows every layer again from Show all, which waits for something to be hidden', async () => {
		const user = userEvent.setup();
		const { onShowAll } = setup({ hidden: ['treats'] });
		await user.click(screen.getByRole('button', { name: 'Show all' }));
		expect(onShowAll).toHaveBeenCalledOnce();
	});

	it('disables Show all while nothing is hidden', () => {
		setup();
		expect(screen.getByRole('button', { name: 'Show all' })).toBeDisabled();
	});

	it('says that hiding is only for the person', () => {
		setup();
		expect(screen.getByText(/Claude always sees the whole level/)).toBeVisible();
	});

	it('explains a level with no layers', () => {
		setup({ sections: [] });
		expect(screen.getByText('This level has no layers yet.')).toBeVisible();
	});

	it('says layers are not there yet for a Fizz 2 level', () => {
		setup({ sections: [], target: 'fizz2' });
		expect(screen.getByText('Layers are not available for Fizz 2 levels yet.')).toBeVisible();
	});
});
