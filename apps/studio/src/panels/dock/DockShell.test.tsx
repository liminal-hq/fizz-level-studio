// Tests for the dock shell: the zones around the level, their tabs and the buttons in their headers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DockShell, type DockActions } from './DockShell';
import { setPanelVisible } from './dockLayout';
import { defaultWorkspace } from './dockModel';
import { visibleWorkspace } from './dockView';

const titles: Record<string, string> = {
	palette: 'Palette',
	objects: 'Objects',
	history: 'History',
	proposals: 'Proposals',
	script: 'Script',
};

function actions(): DockActions {
	return { activate: vi.fn(), dockTo: vi.fn(), floatPanel: vi.fn() };
}

function mount(view = visibleWorkspace(defaultWorkspace()), a = actions()) {
	render(
		<DockShell
			view={view}
			window={{ w: 1440, h: 900 }}
			titleOf={(id) => titles[id]!}
			renderPanel={(id) => <p>{`content of ${id}`}</p>}
			actions={a}
		>
			<div data-testid="level" />
		</DockShell>,
	);
	return a;
}

describe('DockShell', () => {
	it('draws the three docks around the level', () => {
		mount();
		for (const name of ['Left dock', 'Right dock', 'Bottom dock']) {
			expect(screen.getByRole('region', { name })).toBeInTheDocument();
		}
		expect(screen.getByTestId('level')).toBeInTheDocument();
	});

	it('shows only the showing tab of each group, with its tab strip', () => {
		mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByText('content of objects')).toBeInTheDocument();
		expect(within(right).queryByText('content of history')).toBeNull();
		const tabs = within(right).getAllByRole('tab');
		expect(tabs.map((tab) => tab.textContent)).toEqual(['Objects', 'History']);
		expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
		expect(within(right).getByRole('tabpanel')).toHaveAccessibleName('Objects');
	});

	it('asks to show a tab when it is chosen, by click and by arrow key', async () => {
		const user = userEvent.setup();
		const a = mount();
		await user.click(screen.getByRole('tab', { name: 'History' }));
		expect(a.activate).toHaveBeenCalledWith('history');
		screen.getByRole('tab', { name: 'Objects' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(a.activate).toHaveBeenLastCalledWith('history');
		await user.keyboard('{ArrowLeft}');
		expect(a.activate).toHaveBeenLastCalledWith('history');
	});

	it('moves the showing panel with the header buttons', async () => {
		const user = userEvent.setup();
		const a = mount();
		const left = screen.getByRole('region', { name: 'Left dock' });
		await user.click(within(left).getByRole('button', { name: 'Dock Palette right' }));
		expect(a.dockTo).toHaveBeenCalledWith('palette', 'right');
		await user.click(within(left).getByRole('button', { name: 'Dock Palette bottom' }));
		expect(a.dockTo).toHaveBeenCalledWith('palette', 'bottom');
		await user.click(within(left).getByRole('button', { name: 'Float Palette' }));
		expect(a.floatPanel).toHaveBeenCalledWith('palette');
		expect(within(left).queryByRole('button', { name: 'Dock Palette left' })).toBeNull();
	});

	it('names the showing panel in the buttons of a group with several tabs', () => {
		mount();
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(within(bottom).getByRole('button', { name: 'Float Script' })).toBeInTheDocument();
	});

	it('takes no room for a dock with nothing showing, and leaves the level that room', () => {
		const ws = setPanelVisible(defaultWorkspace(), 'palette', false);
		mount(visibleWorkspace(ws));
		expect(screen.queryByRole('region', { name: 'Left dock' })).toBeNull();
		const shell = screen.getByTestId('level').parentElement!.parentElement!;
		expect(shell.style.getPropertyValue('--fls-dock-left')).toBe('0px');
	});

	it('sizes the docks from the model, held to their caps', () => {
		const ws = defaultWorkspace();
		ws.zones.right.size = 5000;
		mount(visibleWorkspace(ws));
		const shell = screen.getByTestId('level').parentElement!.parentElement!;
		expect(shell.style.getPropertyValue('--fls-dock-right')).toBe('432px');
		expect(shell.style.getPropertyValue('--fls-dock-left')).toBe('196px');
		expect(shell.style.getPropertyValue('--fls-dock-bottom')).toBe('180px');
	});
});
