// Tests for dragging panels between docks, onto the level and among tabs, by pointer and by key
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// jsdom has no layout, so the rectangles the hit test reads are stubbed from data attributes.

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingPanel } from '../float/FloatingPanel';
import { DockShell } from './DockShell';
import { floatRectAt, locateDropTarget, type Point } from './dockDrop';
import {
	INITIAL_SESSION,
	activateTab,
	floatPanel,
	reorderTab,
	setZoneCollapsed,
} from './dockLayout';
import { dropOnZone } from './dockDrop';
import { defaultWorkspace } from './dockModel';
import { visibleWorkspace } from './dockView';
import { useDockDrag } from './useDockDrag';

const titles: Record<string, string> = {
	palette: 'Palette',
	objects: 'Objects',
	history: 'History',
	proposals: 'Proposals',
	script: 'Script',
};

function box(l: number, t: number, r: number, b: number): DOMRect {
	return {
		left: l,
		top: t,
		right: r,
		bottom: b,
		x: l,
		y: t,
		width: r - l,
		height: b - t,
	} as DOMRect;
}

/** A 1000 by 700 area: left dock 200 wide, right dock 200 wide, bottom dock 200 tall. */
function stubRects() {
	return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
		this: Element,
	) {
		const el = this as HTMLElement;
		const d = el.dataset;
		if ('root' in d) return box(0, 0, 1000, 700);
		if (d.dropZone === 'left') return box(0, 0, 200, 500);
		if (d.dropZone === 'right') return box(800, 0, 1000, 500);
		if (d.dropZone === 'bottom') return box(0, 500, 1000, 700);
		if (d.groupZone === 'left') return box(0, 0, 200, 500);
		if (d.groupZone === 'right') return box(800, 0, 1000, 500);
		if (d.groupZone === 'bottom') return box(0, 500, 1000, 700);
		if ('strip' in d) {
			const zone = el.closest<HTMLElement>('[data-group-zone]')!.dataset.groupZone;
			if (zone === 'left') return box(0, 0, 200, 40);
			if (zone === 'right') return box(800, 0, 1000, 40);
			return box(0, 500, 1000, 540);
		}
		if (d.tab) {
			const zone = el.closest<HTMLElement>('[data-group-zone]')!.dataset.groupZone;
			const at = [...el.parentElement!.children].indexOf(el);
			const base = zone === 'right' ? 800 : 0;
			const top = zone === 'bottom' ? 505 : 5;
			return box(base + 10 + at * 100, top, base + 100 + at * 100, top + 30);
		}
		return box(0, 0, 0, 0);
	});
}

function Harness({
	initial = defaultWorkspace(),
}: {
	initial?: ReturnType<typeof defaultWorkspace>;
}) {
	const [ws, setWs] = useState(initial);
	const [note, setNote] = useState('');
	const root = useRef<HTMLDivElement>(null);
	const drag = useDockDrag({
		locate: (p: Point, id: string) => (root.current ? locateDropTarget(root.current, p, id) : null),
		onDrop: (id, target, point) => {
			if (target.kind === 'zone') {
				setWs((w) => dropOnZone(w, id, target.zone, target.group, target.index));
			} else {
				const entry = ws.panels[id]!;
				setWs((w) =>
					floatPanel(
						w,
						id,
						floatRectAt(
							point,
							{ x: 0, y: 0 },
							{ w: entry.float.w, h: entry.float.h },
							{ w: 100, h: 60 },
							{ w: 1000, h: 700 },
						),
					),
				);
			}
		},
		onCancel: () => setNote('cancelled'),
	});
	const view = visibleWorkspace(ws);
	return (
		<div data-root="" ref={root}>
			<DockShell
				view={view}
				window={{ w: 1440, h: 900 }}
				session={INITIAL_SESSION}
				titleOf={(id) => titles[id]!}
				renderPanel={(id) => <p>{`content of ${id}`}</p>}
				drag={drag}
				announcement={note}
				actions={{
					activate: (id) => setWs((w) => activateTab(w, id)),
					dockTo: () => {},
					floatPanel: () => {},
					toggleZone: () => {},
					peek: () => {},
					closePeek: () => {},
					pin: () => {},
					resizeZone: () => {},
					resetZoneSize: () => {},
					reorder: (id, index) => setWs((w) => reorderTab(w, id, index)),
				}}
			>
				<div data-testid="level" />
			</DockShell>
			{(['palette', 'objects', 'history', 'proposals', 'script'] as const).map((id) => {
				const entry = ws.panels[id]!;
				if (entry.place !== 'floating') return null;
				return (
					<FloatingPanel
						key={id}
						id={id}
						title={titles[id]!}
						rect={{ x: 300, y: 100, w: 240, h: 160 }}
						collapsed={false}
						z={1}
						min={{ w: 100, h: 60 }}
						area={{ w: 1000, h: 700 }}
						onChange={() => {}}
						onToggleCollapsed={() => {}}
						onRaise={() => {}}
						onDockHover={(p) => drag.hoverFloat(id, p)}
						onDockDrop={(p) => {
							const docked = drag.dropFloat(id, p);
							return docked;
						}}
					>
						<p>{`floating ${id}`}</p>
					</FloatingPanel>
				);
			})}
			<output data-testid="state">{JSON.stringify(ws.zones)}</output>
		</div>
	);
}

const zonesOf = () =>
	JSON.parse(screen.getByTestId('state').textContent!) as ReturnType<
		typeof defaultWorkspace
	>['zones'];

const down = (el: Element, x: number, y: number) =>
	fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: x, clientY: y });
const move = (el: Element | Document, x: number, y: number) =>
	fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y });
const up = (el: Element | Document, x: number, y: number) =>
	fireEvent.pointerUp(el, { pointerId: 1, clientX: x, clientY: y });

let spy: ReturnType<typeof stubRects>;
beforeEach(() => {
	spy = stubRects();
});
afterEach(() => spy.mockRestore());

describe('dragging a docked panel', () => {
	it('docks it in another zone as a tab at the insertion point', () => {
		render(<Harness />);
		const tab = screen.getByRole('tab', { name: 'Palette' });
		down(tab, 20, 20);
		move(tab, 300, 300); // past the threshold, over the level
		expect(document.querySelector('[data-drag-ghost]')).toHaveTextContent('Palette');
		move(tab, 820, 20); // in the right dock's tab strip, left of both tabs
		expect(document.querySelector('[data-drop-zone="right"]')).toHaveAttribute('data-lit');
		expect(document.querySelector('[data-insertion-line]')).toBeInTheDocument();
		up(tab, 820, 20);
		expect(zonesOf().right.groups[0]!.tabs).toEqual(['palette', 'objects', 'history']);
		expect(zonesOf().left.groups).toEqual([]);
		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
	});

	it('drags from the header as well as from a tab', () => {
		render(<Harness />);
		const left = screen.getByRole('region', { name: 'Left dock' });
		const header = left.querySelector('[data-strip]')!;
		down(header, 150, 30);
		move(header, 300, 600);
		up(header, 300, 600); // bottom dock body
		expect(zonesOf().bottom.groups[0]!.tabs).toEqual(['script', 'proposals', 'palette']);
	});

	it('floats it where it is let go on the level', () => {
		render(<Harness />);
		const tab = screen.getByRole('tab', { name: 'Palette' });
		down(tab, 20, 20);
		move(tab, 500, 300);
		up(tab, 500, 300);
		expect(zonesOf().left.groups).toEqual([]);
		expect(screen.getByText('floating palette')).toBeInTheDocument();
	});

	it('cancels with Escape and puts everything back', () => {
		render(<Harness />);
		const before = screen.getByTestId('state').textContent;
		const tab = screen.getByRole('tab', { name: 'Palette' });
		down(tab, 20, 20);
		move(tab, 820, 20);
		fireEvent.keyDown(document.body, { key: 'Escape' });
		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		up(tab, 820, 20);
		expect(screen.getByTestId('state').textContent).toBe(before);
		expect(screen.getByText('cancelled')).toBeInTheDocument();
	});

	it('cancels when let go outside every target', () => {
		render(<Harness />);
		const before = screen.getByTestId('state').textContent;
		const tab = screen.getByRole('tab', { name: 'Palette' });
		down(tab, 20, 20);
		move(tab, 300, 300);
		up(tab, 1500, 300);
		expect(screen.getByTestId('state').textContent).toBe(before);
	});

	it('leaves a click alone: under the threshold nothing is dragged', async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const tab = screen.getByRole('tab', { name: 'History' });
		down(tab, 20, 20);
		move(tab, 22, 21);
		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		up(tab, 22, 21);
		await user.click(tab);
		expect(tab).toHaveAttribute('aria-selected', 'true');
	});

	it('offers a folded dock as a place to drop, and opens it', () => {
		render(<Harness initial={setZoneCollapsed(defaultWorkspace(), 'left', true)} />);
		const tab = screen.getByRole('tab', { name: 'Objects' });
		down(tab, 820, 20);
		move(tab, 100, 100);
		expect(document.querySelector('[data-drop-zone="left"]')).toHaveAttribute('data-lit');
		up(tab, 100, 100);
		expect(zonesOf().left.collapsed).toBe(false);
		expect(zonesOf().left.groups[0]!.tabs).toEqual(['palette', 'objects']);
	});

	it('reorders tabs in a strip', () => {
		render(<Harness />);
		const tab = screen.getByRole('tab', { name: 'Objects' });
		down(tab, 850, 20);
		move(tab, 1000, 20);
		expect(document.querySelector('[data-insertion-line]')).toBeInTheDocument();
		up(tab, 1000, 20);
		expect(zonesOf().right.groups[0]!.tabs).toEqual(['history', 'objects']);
	});
});

describe('dragging a floating panel', () => {
	const floated = () => floatPanel(defaultWorkspace(), 'palette');

	it('docks it when its header is let go over a dock', () => {
		render(<Harness initial={floated()} />);
		const header = screen.getByRole('region', { name: 'Palette' }).querySelector('header')!;
		down(header, 320, 110);
		move(header, 500, 110);
		expect(document.querySelector('[data-drop-zone="bottom"]')).not.toHaveAttribute('data-lit');
		move(header, 400, 600);
		expect(document.querySelector('[data-drop-zone="bottom"]')).toHaveAttribute('data-lit');
		up(header, 400, 600);
		expect(zonesOf().bottom.groups[0]!.tabs).toContain('palette');
	});

	it('stays floating when let go over the level, and Escape clears the highlights', () => {
		render(<Harness initial={floated()} />);
		const header = screen.getByRole('region', { name: 'Palette' }).querySelector('header')!;
		down(header, 320, 110);
		move(header, 400, 110);
		expect(document.querySelector('[data-dragging]')).toBeInTheDocument();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(document.querySelector('[data-dragging]')).toBeNull();
		up(header, 400, 110);
		expect(zonesOf().bottom.groups[0]!.tabs).not.toContain('palette');
	});
});

describe('reordering tabs by keyboard', () => {
	it('moves the focused tab with Alt and the arrows, and announces the place', async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const tab = screen.getByRole('tab', { name: 'Objects' });
		tab.focus();
		await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
		expect(zonesOf().right.groups[0]!.tabs).toEqual(['history', 'objects']);
		const right = screen.getByRole('region', { name: 'Right dock' });
		expect(within(right).getByRole('tab', { name: 'Objects' })).toHaveFocus();
		expect(screen.getByText('Objects moved to position 2 of 2.')).toBeInTheDocument();
		await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
		expect(zonesOf().right.groups[0]!.tabs).toEqual(['objects', 'history']);
		expect(screen.getByText('Objects moved to position 1 of 2.')).toBeInTheDocument();
	});

	it('stops at the ends', async () => {
		const user = userEvent.setup();
		render(<Harness />);
		screen.getByRole('tab', { name: 'Objects' }).focus();
		await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
		expect(zonesOf().right.groups[0]!.tabs).toEqual(['objects', 'history']);
	});
});

describe('the extension point for leaving the window', () => {
	it('calls onLeaveWindow once when the pointer goes past the window edge', () => {
		const onLeaveWindow = vi.fn();
		function Probe() {
			const drag = useDockDrag({ locate: () => null, onDrop: () => {}, onLeaveWindow });
			return <button onPointerDown={(e) => drag.begin(e, 'script', 'header')}>grab</button>;
		}
		render(<Probe />);
		const grab = screen.getByText('grab');
		down(grab, 10, 10);
		act(() => {
			move(grab, 50, 50);
			move(grab, -20, 50);
			move(grab, -40, 50);
		});
		expect(onLeaveWindow).toHaveBeenCalledTimes(1);
		expect(onLeaveWindow.mock.calls[0]![0]).toMatchObject({ id: 'script', source: 'header' });
	});
});
