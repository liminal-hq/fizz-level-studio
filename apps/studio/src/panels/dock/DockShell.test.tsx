// Tests for the dock shell: the zones around the level, their tabs and the buttons in their headers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
		resizeZone: vi.fn(),
		resetZoneSize: vi.fn(),
		reorder: vi.fn(),
		maximise: vi.fn(),
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

describe('resizing a dock', () => {
	const handle = (name: string) => screen.getByRole('separator', { name });

	it('gives each open dock a separator with its size and limits', () => {
		mount();
		const left = handle('Resize the left dock');
		expect(left).toHaveAttribute('aria-valuenow', '196');
		expect(left).toHaveAttribute('aria-valuemin', '160');
		expect(left).toHaveAttribute('aria-valuemax', '432');
		expect(left).toHaveAttribute('aria-orientation', 'vertical');
		const bottom = handle('Resize the bottom dock');
		expect(bottom).toHaveAttribute('aria-orientation', 'horizontal');
		expect(bottom).toHaveAttribute('aria-valuemin', '96');
		expect(bottom).toHaveAttribute('aria-valuemax', '270');
	});

	it('has no handle on a folded dock', () => {
		mount(visibleWorkspace(setZoneCollapsed(defaultWorkspace(), 'left', true)));
		expect(screen.queryByRole('separator', { name: 'Resize the left dock' })).toBeNull();
	});

	it('steps with the arrow keys the way the dock grows, and in larger steps with Shift', async () => {
		const user = userEvent.setup();
		const a = mount();
		handle('Resize the left dock').focus();
		await user.keyboard('{ArrowRight}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('left', 204);
		await user.keyboard('{ArrowLeft}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('left', 188);
		await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('left', 228);
		handle('Resize the right dock').focus();
		await user.keyboard('{ArrowLeft}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('right', 272);
		handle('Resize the bottom dock').focus();
		await user.keyboard('{ArrowUp}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('bottom', 188);
		await user.keyboard('{Home}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('bottom', 96);
		await user.keyboard('{End}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('bottom', 270);
	});

	it('follows a pointer drag, shows the size while it lasts and ends with the last size', () => {
		const a = mount();
		const left = handle('Resize the left dock');
		fireEvent.pointerDown(left, { button: 0, clientX: 200, clientY: 10, pointerId: 1 });
		expect(screen.getByText('196 px')).toBeInTheDocument();
		fireEvent.pointerMove(left, { clientX: 250, clientY: 10, pointerId: 1 });
		expect(a.resizeZone).toHaveBeenLastCalledWith('left', 246);
		fireEvent.pointerUp(left, { clientX: 260, clientY: 10, pointerId: 1 });
		expect(a.resizeZone).toHaveBeenLastCalledWith('left', 256);
		expect(screen.queryByText('196 px')).toBeNull();
	});

	it('grows the right and bottom docks the other way', () => {
		const a = mount();
		const right = handle('Resize the right dock');
		fireEvent.pointerDown(right, { button: 0, clientX: 500, clientY: 10, pointerId: 1 });
		fireEvent.pointerMove(right, { clientX: 450, clientY: 10, pointerId: 1 });
		expect(a.resizeZone).toHaveBeenLastCalledWith('right', 314);
		fireEvent.pointerUp(right, { clientX: 450, clientY: 10, pointerId: 1 });
		const bottom = handle('Resize the bottom dock');
		fireEvent.pointerDown(bottom, { button: 0, clientX: 10, clientY: 600, pointerId: 2 });
		fireEvent.pointerMove(bottom, { clientX: 10, clientY: 560, pointerId: 2 });
		expect(a.resizeZone).toHaveBeenLastCalledWith('bottom', 220);
	});

	it('puts the size back when the drag is cancelled with Escape', async () => {
		const user = userEvent.setup();
		const a = mount();
		const left = handle('Resize the left dock');
		fireEvent.pointerDown(left, { button: 0, clientX: 200, clientY: 10, pointerId: 1 });
		fireEvent.pointerMove(left, { clientX: 260, clientY: 10, pointerId: 1 });
		await user.keyboard('{Escape}');
		expect(a.resizeZone).toHaveBeenLastCalledWith('left', 196);
	});

	it('resets the size on a double-click', async () => {
		const user = userEvent.setup();
		const a = mount();
		await user.dblClick(handle('Resize the right dock'));
		expect(a.resetZoneSize).toHaveBeenCalledWith('right');
	});

	it('shows the readout while the keys are used on the handle and hides it when it loses the focus', async () => {
		const user = userEvent.setup();
		mount();
		handle('Resize the left dock').focus();
		expect(screen.queryByText('196 px')).toBeNull();
		await user.keyboard('{ArrowRight}');
		expect(screen.getByText('196 px')).toBeInTheDocument();
		act(() => handle('Resize the left dock').blur());
		expect(screen.queryByText('196 px')).toBeNull();
	});
});
