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
// Extension point: `onLeaveWindow` is called once each time the pointer leaves the window while a
// drag is active, with the panel and the pointer's last position. It does nothing yet; the step
// that tears a panel off into its own window passes a callback here and takes the drag over.

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from 'react';
import type { DropTarget, Point } from './dockDrop';

export type DragSource = 'tab' | 'header';

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
}

export interface DockDragOptions {
	locate: (point: Point, id: string) => DropTarget | null;
	onDrop: (id: string, target: DropTarget, point: Point) => void;
	/** A drag was cancelled (Escape, a cancelled pointer, or a drop over nothing). */
	onCancel?: (id: string) => void;
	/** The extension point for tearing a panel off: see the note at the top of the file. */
	onLeaveWindow?: (info: LeaveWindowInfo) => void;
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
	target: Element;
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
			target.setPointerCapture?.(event.pointerId);
			const current: Press = {
				id,
				source,
				pointer: event.pointerId,
				start: { x: event.clientX, y: event.clientY },
				active: false,
				outside: false,
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
					opts.current.onLeaveWindow?.({ id, point, source });
				}
				current.outside = out;
				setState({ id, point, target: out ? null : opts.current.locate(point, id), ghost: true });
			};

			const cancel = () => {
				const was = finish();
				if (was?.active) opts.current.onCancel?.(id);
			};

			const up = (e: PointerEvent) => {
				if (press.current !== current || e.pointerId !== current.pointer) return;
				target.releasePointerCapture?.(e.pointerId);
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
				target.releasePointerCapture?.(current.pointer);
				cancel();
			};

			document.addEventListener('pointermove', move);
			document.addEventListener('pointerup', up);
			document.addEventListener('pointercancel', aborted);
			document.addEventListener('keydown', key, true);
			stop.current = () => {
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
