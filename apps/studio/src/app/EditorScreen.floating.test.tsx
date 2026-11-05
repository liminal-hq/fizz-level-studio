// Tests for the editor's floating panels: they float over the canvas and keep their place
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fallbackLayout } from '../panels/float/panelSpecs';
import type { LayoutClient } from '../services/layoutClient';
import { levelSnapshot } from '../test/levelFixtures';
import { FakeLevelClient } from '../worlds/fakeLevelClient';
import { EditorScreen } from './EditorScreen';

function mount(layouts?: Partial<LayoutClient>) {
	const snapshot = levelSnapshot();
	const client = new FakeLevelClient(snapshot);
	const layoutClient: LayoutClient = {
		get: vi.fn(async () => fallbackLayout()),
		save: vi.fn(async (_kind, layout) => layout),
		reset: vi.fn(async () => fallbackLayout()),
		...layouts,
	};
	render(<EditorScreen snapshot={snapshot} client={client} layouts={layoutClient} />);
	return { layoutClient };
}

describe('the editor’s floating panels', () => {
	it('shows each panel as a named region over the canvas', async () => {
		mount();
		for (const name of ['Palette', 'Objects', 'History', 'Proposals', 'Script']) {
			expect(await screen.findByRole('region', { name })).toBeInTheDocument();
		}
		expect(screen.getByRole('application')).toBeInTheDocument();
	});

	it('names the active brush beside the palette’s title', async () => {
		mount();
		const palette = await screen.findByRole('region', { name: 'Palette' });
		expect(within(palette).getByText('grass')).toBeInTheDocument();
	});

	it('collapses a panel to its header and opens it again', async () => {
		const user = userEvent.setup();
		mount();
		const history = await screen.findByRole('region', { name: 'History' });
		await user.click(within(history).getByRole('button', { name: 'Collapse History' }));
		expect(history).toHaveAttribute('data-collapsed');
		await user.click(within(history).getByRole('button', { name: 'Expand History' }));
		expect(history).not.toHaveAttribute('data-collapsed');
	});

	it('brings a grabbed panel in front', async () => {
		mount();
		const palette = await screen.findByRole('region', { name: 'Palette' });
		const z = () => Number(palette.style.getPropertyValue('--fls-float-z'));
		const before = z();
		fireEvent.pointerDown(palette, { button: 0 });
		expect(z()).toBeGreaterThan(before);
	});

	it('moves a panel with the keyboard and saves its place', async () => {
		const user = userEvent.setup();
		const { layoutClient } = mount();
		const history = await screen.findByRole('region', { name: 'History' });
		const start = Number(history.style.getPropertyValue('--fls-float-x').replace('px', ''));
		within(history).getByRole('button', { name: 'Move History' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(history.style.getPropertyValue('--fls-float-x')).toBe(`${start + 8}px`);
		await waitFor(() => expect(layoutClient.save).toHaveBeenCalled(), { timeout: 2000 });
		const saved = vi.mocked(layoutClient.save).mock.calls.at(-1)![1];
		expect(saved.panels.history!.x).toBe(start + 8);
	});

	it('puts the panels back with Ctrl+Shift+0', async () => {
		const user = userEvent.setup();
		const { layoutClient } = mount();
		const history = await screen.findByRole('region', { name: 'History' });
		const start = history.style.getPropertyValue('--fls-float-x');
		within(history).getByRole('button', { name: 'Move History' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(history.style.getPropertyValue('--fls-float-x')).not.toBe(start);
		await user.keyboard('{Control>}{Shift>}0{/Shift}{/Control}');
		await waitFor(() => expect(history.style.getPropertyValue('--fls-float-x')).toBe(start));
		expect(layoutClient.reset).toHaveBeenCalledWith('main');
	});

	it('does not show a panel that is hidden in the saved layout', async () => {
		const layout = fallbackLayout();
		layout.panels.proposals!.visible = false;
		mount({ get: async () => layout });
		await screen.findByRole('region', { name: 'Script' });
		await waitFor(() => expect(screen.queryByRole('region', { name: 'Proposals' })).toBeNull());
	});
});
