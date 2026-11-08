// Tests for the dock shell: the zones over the level, their rails and the buttons in their headers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PEEK_DELAY_MS } from './DockRail';
import { DockShell, PEEK_LEAVE_MS, type DockActions } from './DockShell';
import { dockInsets } from './dockGeometry';
import { INITIAL_SESSION, setPanelVisible, setZoneCollapsed, type DockSession } from './dockLayout';
import { defaultWorkspace } from './dockModel';
import { visibleWorkspace } from './dockView';

const titles: Record<string, string> = {
	palette: 'Palette',
	layers: 'Layers',
	inspector: 'Inspector',
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
		restore: vi.fn(),
	};
}

/** The rows a test panel menu offers, and the function a chosen row reaches. */
const onMenuSelect = vi.fn();
const panelMenu = (id: string) => ({
	items: [
		{ type: 'action' as const, id: `${id}.one`, label: 'Dock left' },
		{ type: 'action' as const, id: `${id}.two`, label: 'Float' },
	],
	onSelect: onMenuSelect,
});

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
			panelMenu={panelMenu}
		>
			<div data-testid="level" />
		</DockShell>,
	);
	return a;
}

function shellOf(): HTMLElement {
	return screen.getByTestId('level').parentElement!.parentElement!;
}

describe('DockShell', () => {
	it('draws the three docks around the level', () => {
		mount();
		for (const name of ['Left dock', 'Right dock', 'Bottom dock']) {
			expect(screen.getByRole('region', { name })).toBeInTheDocument();
		}
		expect(screen.getByTestId('level')).toBeInTheDocument();
	});

	it('names the showing panel once in its header, with no tab strip', () => {
		mount();
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByText('content of inspector')).toBeInTheDocument();
		expect(within(right).queryByText('content of history')).toBeNull();
		expect(screen.queryAllByRole('tab')).toEqual([]);
		expect(within(right).getByRole('heading', { name: 'Inspector' })).toBeInTheDocument();
		expect(within(right).queryByText('History')).toBeNull();
		expect(within(right).queryByRole('region', { name: 'Inspector' })).toBeNull();
	});

	it('gives each header a ⋮ menu button and no dock, float, tear-off or fold buttons', () => {
		mount();
		for (const [zone, title] of [
			['Left dock', 'Palette'],
			['Right dock', 'Inspector'],
			['Bottom dock', 'Script'],
		]) {
			const region = screen.getByRole('region', { name: zone });
			const menu = within(region).getByRole('button', { name: `${title} menu` });
			expect(menu).toHaveAttribute('aria-haspopup', 'menu');
			expect(menu).toHaveAttribute('aria-expanded', 'false');
		}
		const left = screen.getByRole('region', { name: 'Left dock' });
		for (const name of [/^Dock /, /^Float /, /^Tear off /, /^Fold /, /^Unfold /]) {
			expect(within(left).queryByRole('button', { name })).toBeNull();
		}
	});

	it('names the showing panel in the menu button of a group with several panels', () => {
		mount();
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(within(bottom).getByRole('button', { name: 'Script menu' })).toBeInTheDocument();
		expect(within(bottom).queryByRole('button', { name: 'Proposals menu' })).toBeNull();
	});

	it('opens the panel’s menu from its ⋮ button and runs the chosen row', async () => {
		const user = userEvent.setup();
		onMenuSelect.mockClear();
		mount();
		const left = screen.getByRole('region', { name: 'Left dock' });
		const button = within(left).getByRole('button', { name: 'Palette menu' });
		await user.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'true');
		await user.click(screen.getByRole('menuitem', { name: 'Float' }));
		expect(onMenuSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'palette.two' }));
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('opens the menu with Enter, Space or Down, focuses its first row and returns focus on Escape', async () => {
		const user = userEvent.setup();
		mount();
		const button = within(screen.getByRole('region', { name: 'Right dock' })).getByRole('button', {
			name: 'Inspector menu',
		});
		for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
			button.focus();
			await user.keyboard(key);
			expect(await screen.findByRole('menuitem', { name: 'Dock left' })).toHaveFocus();
			await user.keyboard('{Escape}');
			expect(screen.queryByRole('menu')).toBeNull();
			expect(button).toHaveFocus();
		}
	});

	it('takes no room for a dock with nothing showing, not even a rail', () => {
		const ws = setPanelVisible(
			setPanelVisible(defaultWorkspace(), 'palette', false),
			'layers',
			false,
		);
		mount(visibleWorkspace(ws));
		expect(screen.queryByRole('region', { name: 'Left dock' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'Left rail' })).toBeNull();
		const shell = shellOf();
		expect(shell.style.getPropertyValue('--fls-dock-left')).toBe('0px');
		expect(shell.style.getPropertyValue('--fls-rail-left')).toBe('0px');
	});

	it('sizes the docks from the model, held to their caps', () => {
		const ws = defaultWorkspace();
		ws.zones.right.size = 5000;
		mount(visibleWorkspace(ws));
		const shell = shellOf();
		expect(shell.style.getPropertyValue('--fls-dock-right')).toBe('432px');
		expect(shell.style.getPropertyValue('--fls-dock-left')).toBe('196px');
		expect(shell.style.getPropertyValue('--fls-dock-bottom')).toBe('180px');
	});

	it('covers the edges of the level by the insets the canvas is told', () => {
		const ws = setZoneCollapsed(defaultWorkspace(), 'right', true);
		const view = visibleWorkspace(ws);
		mount(view);
		const shell = shellOf();
		const px = (name: string) => Number(shell.style.getPropertyValue(name).replace('px', ''));
		const insets = dockInsets(view, { w: 1440, h: 900 });
		expect(px('--fls-rail-left') + px('--fls-dock-left')).toBe(insets.left);
		// A folded dock still covers the level, at its rail's width.
		expect(px('--fls-rail-right') + px('--fls-dock-right')).toBe(insets.right);
		expect(insets.right).toBe(36);
		expect(px('--fls-rail-bottom') + px('--fls-dock-bottom')).toBe(insets.bottom);
	});

	it('keeps the docks around the level in the tree, so the keyboard meets them in order', () => {
		mount();
		const level = screen.getByTestId('level').parentElement!;
		const before = (a: Element, b: Element) =>
			(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
		const region = (name: string) => screen.getByRole('region', { name });
		expect(before(region('Left dock'), level)).toBe(true);
		expect(before(level, region('Right dock'))).toBe(true);
		expect(before(region('Right dock'), region('Bottom dock'))).toBe(true);
	});
});

describe('the rails', () => {
	const rail = (name: string) => screen.getByRole('group', { name });

	it('draws a rail on the left, the right and the bottom while the docks are open', () => {
		mount();
		for (const name of ['Left rail', 'Right rail', 'Bottom rail']) {
			expect(rail(name)).toBeInTheDocument();
		}
		const shell = shellOf();
		for (const zone of ['left', 'right', 'bottom']) {
			expect(shell.style.getPropertyValue(`--fls-rail-${zone}`)).toBe('36px');
		}
	});

	it('lists every panel of the zone by its title, with its icon', () => {
		mount();
		const right = within(rail('Right rail')).getAllByRole('button');
		expect(right.map((b) => b.textContent)).toEqual(['Inspector', 'Objects', 'History']);
		expect(right.map((b) => b.getAttribute('title'))).toEqual([
			'Inspector, open; choose again to fold',
			'Objects',
			'History',
		]);
		expect(within(rail('Left rail')).getByRole('button', { name: 'Palette' })).toBeInTheDocument();
		const bottom = within(rail('Bottom rail')).getAllByRole('button');
		expect(bottom.map((b) => b.textContent)).toEqual(['Script', 'Proposals']);
		expect(rail('Right rail').querySelectorAll('svg').length).toBe(3);
	});

	it('marks the showing panel of an open dock pressed, and the others not', () => {
		mount();
		const right = rail('Right rail');
		expect(within(right).getByRole('button', { name: 'Inspector' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(within(right).getByRole('button', { name: 'History' })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
	});

	it('follows the showing panel when another is active', () => {
		const ws = defaultWorkspace();
		ws.zones.right.groups[0]!.active = 'history';
		mount(visibleWorkspace(ws));
		expect(
			within(rail('Right rail')).getByRole('button', { name: 'History', pressed: true }),
		).toBeInTheDocument();
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByRole('heading', { name: 'History' })).toBeInTheDocument();
	});

	it('shows a panel that is not showing when its entry is clicked, and leaves the dock open', async () => {
		const user = userEvent.setup();
		const a = mount();
		await user.click(within(rail('Right rail')).getByRole('button', { name: 'History' }));
		expect(a.activate).toHaveBeenCalledWith('history');
		expect(a.toggleZone).not.toHaveBeenCalled();
	});

	it('folds the dock when the showing panel’s entry is clicked', async () => {
		const user = userEvent.setup();
		const a = mount();
		await user.click(within(rail('Left rail')).getByRole('button', { name: 'Palette' }));
		expect(a.toggleZone).toHaveBeenCalledWith('left');
		expect(a.activate).not.toHaveBeenCalled();
		await user.click(within(rail('Bottom rail')).getByRole('button', { name: 'Script' }));
		expect(a.toggleZone).toHaveBeenLastCalledWith('bottom');
	});

	it('moves along a side rail with the up and down keys, and the bottom one with left and right', async () => {
		const user = userEvent.setup();
		mount();
		within(rail('Right rail')).getByRole('button', { name: 'Inspector' }).focus();
		await user.keyboard('{ArrowDown}');
		expect(screen.getByRole('button', { name: 'Objects' })).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(screen.getByRole('button', { name: 'History' })).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(screen.getByRole('button', { name: 'Inspector' })).toHaveFocus();
		within(rail('Bottom rail')).getByRole('button', { name: 'Script' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(screen.getByRole('button', { name: 'Proposals' })).toHaveFocus();
		await user.keyboard('{Home}');
		expect(screen.getByRole('button', { name: 'Script' })).toHaveFocus();
	});

	it('hints that the showing entry folds the dock, and that a folded dock’s entry opens it', () => {
		mount();
		expect(within(rail('Left rail')).getByRole('button', { name: 'Palette' })).toHaveAttribute(
			'title',
			'Palette, open; choose again to fold',
		);
		cleanup();
		mount(visibleWorkspace(setZoneCollapsed(defaultWorkspace(), 'left', true)));
		expect(within(rail('Left rail')).getByRole('button', { name: 'Palette' })).toHaveAttribute(
			'title',
			'Palette, folded; choose to open',
		);
	});

	it('draws a dimmed placeholder after the real entries, which does nothing and is skipped by the arrows', async () => {
		const user = userEvent.setup();
		const a = actions();
		render(
			<DockShell
				view={visibleWorkspace(defaultWorkspace())}
				window={{ w: 1440, h: 900 }}
				session={INITIAL_SESSION}
				titleOf={(id) => titles[id]!}
				renderPanel={(id) => <p>{`content of ${id}`}</p>}
				actions={a}
				railPlaceholders={{
					left: [{ id: 'assets', title: 'Assets', icon: 'assets', reason: 'Coming later' }],
				}}
			>
				<div data-testid="level" />
			</DockShell>,
		);
		const left = rail('Left rail');
		const entry = within(left).getByRole('button', { name: 'Assets' });
		expect(entry).toBeDisabled();
		expect(entry).toHaveAttribute('title', 'Coming later');
		expect(left.lastElementChild).toBe(entry);
		expect(within(rail('Right rail')).queryByRole('button', { name: 'Assets' })).toBeNull();
		await user.click(entry);
		expect(a.activate).not.toHaveBeenCalled();
		expect(a.toggleZone).not.toHaveBeenCalled();
		within(left).getByRole('button', { name: 'Layers' }).focus();
		await user.keyboard('{ArrowDown}');
		// The arrows wrap past the dimmed Assets entry to the first real one.
		expect(within(left).getByRole('button', { name: 'Palette' })).toHaveFocus();
	});

	it('has no fold or unfold button, open or folded: the showing entry is the switch', () => {
		mount();
		expect(screen.queryByRole('button', { name: /^(Fold|Unfold) the/ })).toBeNull();
		cleanup();
		mount(visibleWorkspace(setZoneCollapsed(defaultWorkspace(), 'left', true)));
		expect(screen.queryByRole('button', { name: /^(Fold|Unfold) the/ })).toBeNull();
	});
});

describe('folded docks', () => {
	const folded = () => {
		let ws = setZoneCollapsed(defaultWorkspace(), 'left', true);
		ws = setZoneCollapsed(ws, 'right', true);
		return visibleWorkspace(ws);
	};

	/** Runs `body` with fake timers, putting the real ones back however it ends. */
	const withFakeTimers = (body: () => void) => {
		vi.useFakeTimers();
		try {
			body();
		} finally {
			vi.useRealTimers();
		}
	};

	it('keeps the rail with just its entries, and takes the dock away', () => {
		mount(folded());
		const rail = screen.getByRole('group', { name: 'Right rail' });
		const items = within(rail).getAllByRole('button');
		expect(items.map((b) => b.textContent)).toEqual(['Inspector', 'Objects', 'History']);
		expect(screen.queryByRole('region', { name: 'Right dock' })).toBeNull();
		expect(rail.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
		expect(within(rail).getByRole('button', { name: 'Inspector' })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
	});

	it('gives the rail the rail’s room, and the level the rest', () => {
		mount(folded());
		const shell = shellOf();
		expect(shell.style.getPropertyValue('--fls-dock-left')).toBe('0px');
		expect(shell.style.getPropertyValue('--fls-rail-left')).toBe('36px');
		expect(shell.style.getPropertyValue('--fls-dock-right')).toBe('0px');
		expect(shell.style.getPropertyValue('--fls-rail-right')).toBe('36px');
	});

	it('opens the dock on a panel when its entry is clicked', async () => {
		const user = userEvent.setup();
		const a = mount(folded());
		await user.click(screen.getByRole('button', { name: 'History' }));
		expect(a.activate).toHaveBeenCalledWith('history');
		expect(a.toggleZone).toHaveBeenCalledWith('right');
		expect(a.peek).not.toHaveBeenCalled();
	});

	it('peeks a panel when the pointer rests on its entry', () =>
		withFakeTimers(() => {
			const a = mount(folded());
			fireEvent.pointerEnter(screen.getByRole('button', { name: 'History' }));
			act(() => vi.advanceTimersByTime(PEEK_DELAY_MS - 50));
			expect(a.peek).not.toHaveBeenCalled();
			act(() => vi.advanceTimersByTime(100));
			expect(a.peek).toHaveBeenCalledWith('history');
		}));

	it('does not peek when the pointer only passes over an entry', () =>
		withFakeTimers(() => {
			const a = mount(folded());
			const history = screen.getByRole('button', { name: 'History' });
			fireEvent.pointerEnter(history);
			fireEvent.pointerLeave(history);
			act(() => vi.advanceTimersByTime(PEEK_DELAY_MS * 2));
			expect(a.peek).not.toHaveBeenCalled();
		}));

	it('does not peek from an open dock’s rail', () =>
		withFakeTimers(() => {
			const a = mount();
			fireEvent.pointerEnter(screen.getByRole('button', { name: 'History' }));
			act(() => vi.advanceTimersByTime(PEEK_DELAY_MS * 2));
			expect(a.peek).not.toHaveBeenCalled();
		}));

	it('peeks with the arrow key that points into the level', async () => {
		const user = userEvent.setup();
		const a = mount(folded());
		screen.getByRole('button', { name: 'History' }).focus();
		await user.keyboard('{ArrowLeft}');
		expect(a.peek).toHaveBeenCalledWith('history');
		screen.getByRole('button', { name: 'Palette' }).focus();
		await user.keyboard('{ArrowRight}');
		expect(a.peek).toHaveBeenLastCalledWith('palette');
	});

	it('closes a peek the pointer opened once the pointer has left the rail', () =>
		withFakeTimers(() => {
			const a = mount(folded());
			const history = screen.getByRole('button', { name: 'History' });
			fireEvent.pointerEnter(history);
			act(() => vi.advanceTimersByTime(PEEK_DELAY_MS));
			expect(a.peek).toHaveBeenCalledWith('history');
			fireEvent.pointerLeave(history.closest('[data-rail-slot]')!);
			act(() => vi.advanceTimersByTime(PEEK_LEAVE_MS + 10));
			expect(a.closePeek).toHaveBeenCalledTimes(1);
		}));

	it('marks the peeking entry and shows the panel with a pin', async () => {
		const user = userEvent.setup();
		const a = mount(folded(), actions(), { ...INITIAL_SESSION, peeking: 'history' });
		const rail = screen.getByRole('group', { name: 'Right rail' });
		expect(within(rail).getByRole('button', { name: 'History' })).toHaveAttribute('data-peeking');
		expect(within(rail).getByRole('button', { name: 'Objects' })).not.toHaveAttribute(
			'data-peeking',
		);
		const peek = screen.getByRole('region', { name: 'History, peeking' });
		expect(within(peek).getByText('content of history')).toBeInTheDocument();
		await user.click(within(peek).getByRole('button', { name: 'Pin History' }));
		expect(a.pin).toHaveBeenCalledWith('history');
	});

	it('offers Maximise in the peek header for an expandable panel only', async () => {
		const user = userEvent.setup();
		const a = mount(folded(), actions(), { ...INITIAL_SESSION, peeking: 'history' });
		const peek = screen.getByRole('region', { name: 'History, peeking' });
		expect(within(peek).queryByRole('button', { name: /^Maximise/ })).toBeNull();
		cleanup();
		const b = actions();
		render(
			<DockShell
				view={folded()}
				window={{ w: 1440, h: 900 }}
				session={{ ...INITIAL_SESSION, peeking: 'history' }}
				titleOf={(id) => titles[id]!}
				renderPanel={(id) => <p>{`content of ${id}`}</p>}
				expandable={(id) => id === 'history'}
				actions={b}
			>
				<div data-testid="level" />
			</DockShell>,
		);
		await user.click(screen.getByRole('button', { name: 'Maximise History' }));
		expect(b.maximise).toHaveBeenCalledWith('history');
		expect(a.maximise).not.toHaveBeenCalled();
	});

	it('closes a peek on Escape and returns focus to its rail entry', async () => {
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

	it('keeps every rail in level-first, folded and not usable until it ends', () => {
		mount(visibleWorkspace(defaultWorkspace(), true), actions(), {
			...INITIAL_SESSION,
			levelFirst: true,
		});
		for (const name of ['Left dock', 'Right dock', 'Bottom dock']) {
			expect(screen.queryByRole('region', { name })).toBeNull();
		}
		for (const name of ['Left rail', 'Right rail', 'Bottom rail']) {
			expect(screen.getByRole('group', { name })).toBeInTheDocument();
		}
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

describe('a maximised panel', () => {
	function Counter({ id }: { id: string }) {
		const [n, setN] = useState(0);
		return (
			<button data-counter={id} onClick={() => setN(n + 1)}>
				{`count ${n}`}
			</button>
		);
	}

	const shell = (maximised: string | null) => (
		<DockShell
			view={visibleWorkspace(defaultWorkspace())}
			window={{ w: 1440, h: 900 }}
			session={INITIAL_SESSION}
			titleOf={(id) => titles[id]!}
			renderPanel={(id) => (
				<div data-body={id}>
					<Counter id={id} />
				</div>
			)}
			actions={actions()}
			panelMenu={panelMenu}
			maximised={maximised}
		>
			<div data-testid="level" />
		</DockShell>
	);

	it('stays the same DOM node with its state while it is maximised and restored', async () => {
		const user = userEvent.setup();
		const { rerender } = render(shell(null));
		const body = document.querySelector<HTMLElement>('[data-body="script"]')!;
		const counter = within(body).getByRole('button');
		await user.click(counter);
		await user.click(counter);
		body.scrollTop = 12;
		const groupBefore = body.closest('[data-group-zone]');

		rerender(shell('script'));
		expect(document.querySelector('[data-body="script"]')).toBe(body);
		expect(within(body).getByRole('button')).toBe(counter);
		expect(counter).toHaveTextContent('count 2');
		expect(body.scrollTop).toBe(12);
		expect(body.closest('[data-group-zone]')).toBe(groupBefore);
		expect(groupBefore).toHaveAttribute('data-panel-maximised');
		expect(document.querySelector('[data-has-maximised]')).toBeInTheDocument();
		// The other docks and the level are still mounted, only hidden by the stylesheet.
		expect(screen.getByTestId('level')).toBeInTheDocument();
		expect(document.querySelector('[data-body="palette"]')).toBeInTheDocument();
		// Inside the maximised group the header offers Restore, not the panel's menu.
		expect(
			within(groupBefore as HTMLElement).getByRole('button', { name: 'Restore Script' }),
		).toBeInTheDocument();
		expect(
			within(groupBefore as HTMLElement).queryByRole('heading', { name: 'Script' }),
		).toBeInTheDocument();
		expect(
			within(groupBefore as HTMLElement).queryByRole('button', { name: 'Script menu' }),
		).toBeNull();

		rerender(shell(null));
		expect(document.querySelector('[data-body="script"]')).toBe(body);
		expect(counter).toHaveTextContent('count 2');
		expect(body.scrollTop).toBe(12);
		expect(document.querySelector('[data-panel-maximised]')).toBeNull();
		const bottom = screen.getByRole('region', { name: 'Bottom dock' });
		expect(within(bottom).getByRole('heading', { name: 'Script' })).toBeInTheDocument();
		expect(within(bottom).getByRole('button', { name: 'Script menu' })).toBeInTheDocument();
	});
});
