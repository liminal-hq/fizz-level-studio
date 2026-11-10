// The drag controller: moves a panel by the pointer, between docks, tab strips and the level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A drag starts on a pointer press on a tab or a docked panel's header, and becomes a drag once
// the pointer has moved past a small threshold (so a click is still a click). From then on it
// follows the pointer on the document (the pointer is captured, and HTML5 drag and drop is not
// used), asks `locate` what is under it and reports it for the highlights and the ghost. Letting
// go over a target calls `onDrop`; Escape, a cancelled pointer or letting go over nothing puts
// everything back (nothing has moved until the drop). A floating panel moves itself, so it only
// reports where its pointer is (`hoverFloat`) and asks whether the drop docked it (`dropFloat`).
//
// `onLeaveWindow` is called once each time the pointer leaves the window while a drag is active.
// It may return a `WindowExit`, which takes the drag over while the pointer is outside: it hears the
// pointer move, the release (a drop outside every window of the page) and a cancel (Escape, a
// cancelled pointer, or the pointer coming back in, when the drag is the page's own again). That is
// how a panel is torn off into a window of its own by dragging (`panels/windows/tearDrag.ts`). A
// callback that returns nothing leaves a release outside the window to cancel the drag, as before.
// An exit that hands the drag to the compositor, which then sends this page no more pointer events,
// calls `info.finish()` so the controller stops waiting for a release that will never come.

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from 'react';
import { CONTEXT_BUSY } from '../../app/contextBusy';
import type { DropTarget, Point } from './dockDrop';

/** What was pressed: a rail entry or a tab, a panel's header grip, or a tab in the Script panel's header. */
export type DragSource = 'tab' | 'header' | 'scriptTab';

export interface DockDragState {
	id: string;
	point: Point;
	/** What a drop here would do; null over nothing. */
	target: DropTarget | null;
	/** A floating panel draws itself, so it needs no ghost. */
	ghost: boolean;
}

export interface LeaveWindowInfo {
	id: string;
	point: Point;
	source: DragSource;
	/** Where the press was, in the page. */
	start: Point;
	/** Where inside the pressed element it was held, in logical pixels from its top-left. */
	grab: Point;
	/** Ends the page's drag without a drop or a cancel, for an exit that handed the drag on. */
	finish: () => void;
}

/** What takes a drag over while the pointer is outside the window. */
export interface WindowExit {
	/** The pointer moved, outside the window still (page coordinates, which may be negative). */
	move?: (point: Point) => void;
	/** The pointer was let go outside the window. */
	drop: (point: Point) => void;
	/** The drag was cancelled, or the pointer came back into the window. */
	cancel: () => void;
}

export interface DockDragOptions {
	locate: (point: Point, id: string) => DropTarget | null;
	onDrop: (id: string, target: DropTarget, point: Point) => void;
	/** A drag was cancelled (Escape, a cancelled pointer, or a drop over nothing). */
	onCancel?: (id: string) => void;
	/** Called when the pointer leaves the window mid-drag; the exit it returns takes the drag over (see the note at the top). */
	onLeaveWindow?: (info: LeaveWindowInfo) => WindowExit | void;
	/** How far the pointer moves before a press becomes a drag, in pixels. */
	threshold?: number;
}

export interface DockDrag {
	state: DockDragState | null;
	/** Starts watching a press on a tab or a docked panel's header. */
	begin: (event: ReactPointerEvent<HTMLElement>, id: string, source: DragSource) => void;
	/** A floating panel's pointer moved (or, with null, its drag ended or was cancelled). */
	hoverFloat: (id: string, point: Point | null) => void;
	/** A floating panel was let go at `point`: true when that docked it. */
	dropFloat: (id: string, point: Point) => boolean;
}

export const DRAG_THRESHOLD = 4;

interface Press {
	id: string;
	source: DragSource;
	pointer: number;
	start: Point;
	active: boolean;
	outside: boolean;
	exit: WindowExit | null;
	grab: Point;
	target: Element;
}

/** Capturing can throw for a pointer the browser does not know (a synthetic one); the drag still works. */
function capture(target: Element, pointer: number, on: boolean): void {
	try {
		if (on) target.setPointerCapture?.(pointer);
		else target.releasePointerCapture?.(pointer);
	} catch {
		// Nothing to capture or release.
	}
}

/** Where in `target` a press at (`x`, `y`) was, from its top-left. */
function grabAt(target: Element, x: number, y: number): Point {
	const rect = target.getBoundingClientRect();
	return { x: Math.max(0, x - rect.left), y: Math.max(0, y - rect.top) };
}

function outsideWindow(p: Point): boolean {
	return p.x < 0 || p.y < 0 || p.x > window.innerWidth || p.y > window.innerHeight;
}

export function useDockDrag(options: DockDragOptions): DockDrag {
	const [state, setState] = useState<DockDragState | null>(null);
	const opts = useRef(options);
	opts.current = options;
	const press = useRef<Press | null>(null);
	const stop = useRef<(() => void) | null>(null);

	const finish = useCallback(() => {
		const p = press.current;
		press.current = null;
		stop.current?.();
		stop.current = null;
		setState(null);
		return p;
	}, []);

	const begin = useCallback(
		(event: ReactPointerEvent<HTMLElement>, id: string, source: DragSource) => {
			if (event.button !== 0 || press.current) return;
			const target = event.currentTarget;
			capture(target, event.pointerId, true);
			const current: Press = {
				id,
				source,
				pointer: event.pointerId,
				start: { x: event.clientX, y: event.clientY },
				active: false,
				outside: false,
				exit: null,
				grab: grabAt(target, event.clientX, event.clientY),
				target,
			};
			press.current = current;

			const move = (e: PointerEvent) => {
				if (press.current !== current || e.pointerId !== current.pointer) return;
				const point = { x: e.clientX, y: e.clientY };
				if (!current.active) {
					const far = Math.hypot(point.x - current.start.x, point.y - current.start.y);
					if (far < (opts.current.threshold ?? DRAG_THRESHOLD)) return;
					current.active = true;
				}
				const out = outsideWindow(point);
				if (out && !current.outside) {
					current.exit =
						opts.current.onLeaveWindow?.({
							id,
							point,
							source,
							start: current.start,
							grab: current.grab,
							finish,
						}) ?? null;
				} else if (!out && current.outside) {
					// Back inside: the page's own drag again, and the exit lets go of the pointer.
					current.exit?.cancel();
					current.exit = null;
				}
				current.outside = out;
				if (out) current.exit?.move?.(point);
				setState({ id, point, target: out ? null : opts.current.locate(point, id), ghost: true });
			};

			const cancel = () => {
				const was = finish();
				was?.exit?.cancel();
				if (was?.active) opts.current.onCancel?.(id);
			};

			const up = (e: PointerEvent) => {
				if (press.current !== current || e.pointerId !== current.pointer) return;
				capture(target, e.pointerId, false);
				const point = { x: e.clientX, y: e.clientY };
				const was = finish();
				if (!was?.active) return;
				// The click that follows a drag must not activate whatever the pointer ended on.
				const swallow = (click: Event) => {
					click.stopPropagation();
					click.preventDefault();
				};
				document.addEventListener('click', swallow, true);
				setTimeout(() => document.removeEventListener('click', swallow, true), 0);
				if (outsideWindow(point) && was.exit) {
					was.exit.drop(point);
					return;
				}
				const where = outsideWindow(point) ? null : opts.current.locate(point, id);
				if (where) opts.current.onDrop(id, where, point);
				else opts.current.onCancel?.(id);
			};

			const aborted = (e: PointerEvent) => {
				if (e.pointerId === current.pointer) cancel();
			};

			const key = (e: KeyboardEvent) => {
				if (e.key !== 'Escape' || !current.active) return;
				e.preventDefault();
				e.stopPropagation();
				capture(target, current.pointer, false);
				cancel();
			};

			// The drag is ours alone: the webview must not start a text selection or a native drag and
			// drop of the page's text (its drag image is a window of its own, drawn over the desktop)
			// while the pointer moves, whatever was under the press or already selected.
			const refuse = (e: Event) => e.preventDefault();
			window.getSelection?.()?.removeAllRanges();
			// While the drag runs no context menu opens (the host reads this mark).
			document.documentElement.setAttribute(CONTEXT_BUSY, '');
			document.addEventListener('dragstart', refuse, true);
			document.addEventListener('selectstart', refuse, true);
			document.addEventListener('pointermove', move);
			document.addEventListener('pointerup', up);
			document.addEventListener('pointercancel', aborted);
			document.addEventListener('keydown', key, true);
			stop.current = () => {
				document.documentElement.removeAttribute(CONTEXT_BUSY);
				document.removeEventListener('dragstart', refuse, true);
				document.removeEventListener('selectstart', refuse, true);
				document.removeEventListener('pointermove', move);
				document.removeEventListener('pointerup', up);
				document.removeEventListener('pointercancel', aborted);
				document.removeEventListener('keydown', key, true);
			};
		},
		[finish],
	);

	useEffect(
		() => () => {
			stop.current?.();
			press.current?.exit?.cancel();
		},
		[],
	);

	const hoverFloat = useCallback((id: string, point: Point | null) => {
		if (!point) {
			setState((old) => (old === null ? old : null));
			return;
		}
		const found = opts.current.locate(point, id);
		const target = found && found.kind === 'zone' ? found : null;
		setState({ id, point, target, ghost: false });
	}, []);

	const dropFloat = useCallback((id: string, point: Point): boolean => {
		setState(null);
		const target = opts.current.locate(point, id);
		if (!target || target.kind !== 'zone') return false;
		opts.current.onDrop(id, target, point);
		return true;
	}, []);

	return { state, begin, hoverFloat, dropFloat };
}
