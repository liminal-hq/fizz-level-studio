// Tests for the dock shell: the zones around the level, their tabs and the buttons in their headers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DockShell, type DockActions } from './DockShell';
import { INITIAL_SESSION, setPanelVisible, setZoneCollapsed, type DockSession } from './dockLayout';
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
	return {
		activate: vi.fn(),
		dockTo: vi.fn(),
		floatPanel: vi.fn(),
		toggleZone: vi.fn(),
		peek: vi.fn(),
		closePeek: vi.fn(),
		pin: vi.fn(),
	};
}

function mount(
	view = visibleWorkspace(defaultWorkspace()),
	a = actions(),
	session: DockSession = INITIAL_SESSION,
) {
	render(
		<DockShell
			view={view}
			window={{ w: 1440, h: 900 }}
			session={session}
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

describe('folded docks', () => {
	const folded = () => {
		let ws = setZoneCollapsed(defaultWorkspace(), 'left', true);
		ws = setZoneCollapsed(ws, 'right', true);
		return visibleWorkspace(ws);
	};

	it('shows a rail of buttons with each panel’s title, and no tabs', () => {
		mount(folded());
		const rail = screen.getByRole('group', { name: 'Right rail' });
		const items = within(rail).getAllByRole('button');
		expect(items.map((b) => b.textContent)).toEqual(['', 'Objects', 'History']);
		expect(within(rail).getByRole('button', { name: 'Unfold the right dock' })).toBeInTheDocument();
		expect(screen.queryByRole('region', { name: 'Right dock' })).toBeNull();
		expect(rail.querySelectorAll('svg').length).toBeGreaterThanOrEqual(3);
	});

	it('gives the rail the rail’s room, and the level the rest', () => {
		mount(folded());
		const shell = screen.getByTestId('level').parentElement!.parentElement!;
		expect(shell.style.getPropertyValue('--fls-dock-left')).toBe('36px');
		expect(shell.style.getPropertyValue('--fls-dock-right')).toBe('36px');
	});

	it('peeks a panel from its rail button and closes it from the same button', async () => {
		const user = userEvent.setup();
		const a = mount(folded());
		await user.click(screen.getByRole('button', { name: 'History' }));
		expect(a.peek).toHaveBeenCalledWith('history');
	});

	it('marks the peeking button expanded and shows the panel with a pin', async () => {
		const user = userEvent.setup();
		const a = mount(folded(), actions(), { ...INITIAL_SESSION, peeking: 'history' });
		const rail = screen.getByRole('group', { name: 'Right rail' });
		expect(within(rail).getByRole('button', { name: 'History' })).toHaveAttribute(
			'aria-expanded',
			'true',
		);
		expect(within(rail).getByRole('button', { name: 'Objects' })).toHaveAttribute(
			'aria-expanded',
			'false',
		);
		const peek = screen.getByRole('region', { name: 'History, peeking' });
		expect(within(peek).getByText('content of history')).toBeInTheDocument();
		await user.click(within(peek).getByRole('button', { name: 'Pin History' }));
		expect(a.pin).toHaveBeenCalledWith('history');
		await user.click(within(rail).getByRole('button', { name: 'History' }));
		expect(a.closePeek).toHaveBeenCalled();
	});

	it('closes a peek on Escape and returns focus to its rail button', async () => {
		const user = userEvent.setup();
		const a = mount(folded(), actions(), { ...INITIAL_SESSION, peeking: 'history' });
		const peek = screen.getByRole('region', { name: 'History, peeking' });
		await vi.waitFor(() => expect(peek).toHaveFocus());
		await user.keyboard('{Escape}');
		expect(a.closePeek).toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'History' })).toHaveFocus();
	});

	it('closes a peek on a click elsewhere but not on the panel or a rail', async () => {
		const user = userEvent.setup();
		const a = mount(folded(), actions(), { ...INITIAL_SESSION, peeking: 'history' });
		await user.click(screen.getByText('content of history'));
		await user.click(screen.getByRole('button', { name: 'Objects' }));
		expect(a.closePeek).not.toHaveBeenCalled();
		await user.click(screen.getByTestId('level'));
		expect(a.closePeek).toHaveBeenCalledTimes(1);
	});

	it('folds an open dock from its header and unfolds a rail', async () => {
		const user = userEvent.setup();
		const a = mount();
		await user.click(screen.getByRole('button', { name: 'Fold the left dock' }));
		expect(a.toggleZone).toHaveBeenCalledWith('left');
	});

	it('unfolds a folded dock from its rail', async () => {
		const user = userEvent.setup();
		const a = mount(folded());
		await user.click(screen.getByRole('button', { name: 'Unfold the left dock' }));
		expect(a.toggleZone).toHaveBeenCalledWith('left');
	});

	it('leaves the rails in place but not usable while the level comes first', () => {
		mount(folded(), actions(), { ...INITIAL_SESSION, levelFirst: true });
		expect(screen.getByRole('button', { name: 'Objects' })).toBeDisabled();
	});
});
