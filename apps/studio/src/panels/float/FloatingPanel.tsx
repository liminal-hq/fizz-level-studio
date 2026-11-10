// A panel that floats over the editor: dragged by its header, resized from any edge, collapsible
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	useEffect,
	useRef,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
} from 'react';
import { useSurfaceMenu } from '../../app/useSurfaceMenu';
import { t } from '../../i18n/messages';
import { Tooltip } from '../../ui/Tooltip';
import styles from './FloatingPanel.module.css';
import {
	isMeasured,
	keyDelta,
	moveRect,
	resizeRect,
	resizeRectFrom,
	type Rect,
	type ResizeHandle,
	type Size,
} from './panelGeometry';
import type { PanelId } from './panelSpecs';
import { snapMoveWithin, snapResize, type Guide } from './snap';
import type { LeaveWindowInfo, WindowExit } from '../dock/useDockDrag';

export interface FloatingPanelProps {
	/** A stable name, such as `script`; it keys the panel's saved place. */
	id: string;
	title: string;
	/** A short note beside the title, such as the active kind in the palette. */
	subtitle?: string;
	rect: Rect;
	collapsed: boolean;
	/** Stacking order: the highest panel is in front. */
	z: number;
	/** The smallest size the panel may be resized to. */
	min: Size;
	/** The size of the area the panel floats in; it never leaves it. */
	area: Size;
	/** The panel moved or was resized. `final` is true when the gesture ended. */
	onChange: (rect: Rect, final: boolean) => void;
	onToggleCollapsed: () => void;
	/** The panel was grabbed or focused and should come to the front. */
	onRaise: () => void;
	/** The other panels' rectangles as they show, which this panel's edges snap to. */
	neighbours?: readonly Rect[];
	/** The guide lines for the edges a drag is locked to; empty when the drag ends. */
	onGuides?: (guides: Guide[]) => void;
	/**
	 * Where the pointer is while the header moves the panel (null when the move ends or is
	 * cancelled), so the docks can light up under it.
	 */
	onDockHover?: (point: { x: number; y: number } | null) => void;
	/** The header was let go at this point: return true when that docked the panel (it is then not placed). */
	onDockDrop?: (point: { x: number; y: number }) => boolean;
	/**
	 * The header's pointer left the window mid-move (called once per exit). The exit it returns
	 * takes the drag over while the pointer is outside, as for a docked panel's drag
	 * (`useDockDrag`'s `onLeaveWindow`), which is how the panel is torn off into a window. A
	 * callback that returns nothing leaves the move as the panel's own.
	 */
	onLeaveWindow?: (info: LeaveWindowInfo) => WindowExit | void;
	/** The panel fills the workspace: its header offers only `actions`, and it cannot be moved. */
	maximised?: boolean;
	/** Another panel is maximised: this one stays mounted, hidden. */
	suppressed?: boolean;
	/** Extra controls in the header, such as Maximise and the ⋮ menu. */
	actions?: ReactNode;
	/** Shown in the header in place of the title text, such as the Script's tab strip. */
	headerExtra?: ReactNode;
	children: ReactNode;
}

const UNBOUNDED: Size = { w: 100_000, h: 100_000 };
const NO_NEIGHBOURS: readonly Rect[] = [];

interface Gesture {
	pointer: number;
	x: number;
	y: number;
	start: Rect;
	handle: ResizeHandle;
	/** Where in the header the press was, in logical pixels from its top-left. */
	grab: { x: number; y: number };
	/** Whether the pointer is outside the window (a move only). */
	outside: boolean;
	/** What took the drag over while the pointer was outside. */
	exit: WindowExit | null;
}

function outsideWindow(x: number, y: number): boolean {
	return x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight;
}

/** The handles that only a pointer uses; the corner grip is the one a keyboard reaches. */
const POINTER_HANDLES: readonly ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'sw'];

/**
 * A positioned window inside an editor area. It is controlled: the caller keeps the rectangle and
 * the collapsed flag and receives every change, so the layout can be saved and reset elsewhere.
 * Pointer drags capture the pointer, Escape cancels one, and the grips also answer the arrow keys
 * (Shift for larger steps) so the panel can be placed without a mouse.
 */
export function FloatingPanel({
	id,
	title,
	subtitle,
	rect,
	collapsed,
	z,
	min,
	area: measured,
	onChange,
	onToggleCollapsed,
	onRaise,
	neighbours = NO_NEIGHBOURS,
	onGuides,
	onDockHover,
	onDockDrop,
	onLeaveWindow,
	maximised = false,
	suppressed = false,
	actions,
	headerExtra,
	children,
}: FloatingPanelProps) {
	// Until the area has been laid out it has no edges to keep a panel inside.
	const area = isMeasured(measured) ? measured : UNBOUNDED;
	const gesture = useRef<Gesture | null>(null);
	// A right-click, the Menu key or Shift+F10 on the header opens the panel's menu.
	const headerMenu = useSurfaceMenu<HTMLElement>(() => ({
		kind: 'panel',
		panel: id as PanelId,
		where: 'header',
	}));
	// Where the panel was when a key gesture began, so Escape can put it back.
	const keyOrigin = useRef<Rect | null>(null);
	const live = useRef(rect);
	live.current = rect;

	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onGuidesRef = useRef(onGuides);
	onGuidesRef.current = onGuides;
	const onDockHoverRef = useRef(onDockHover);
	onDockHoverRef.current = onDockHover;
	const onLeaveRef = useRef(onLeaveWindow);
	onLeaveRef.current = onLeaveWindow;
	const stopEscape = useRef<(() => void) | null>(null);

	// Escape ends a pointer drag wherever the keyboard focus is, putting the panel back.
	const watchEscape = () => {
		const hear = (event: globalThis.KeyboardEvent) => {
			const g = gesture.current;
			if (event.key !== 'Escape' || !g) return;
			gesture.current = null;
			stopEscape.current?.();
			g.exit?.cancel();
			onGuidesRef.current?.([]);
			onDockHoverRef.current?.(null);
			onChangeRef.current(g.start, true);
		};
		document.addEventListener('keydown', hear);
		stopEscape.current = () => {
			document.removeEventListener('keydown', hear);
			stopEscape.current = null;
		};
	};
	// The exit is not cancelled here: a panel that is torn off leaves the floating layer mid-drag (it
	// is recorded as away as soon as its window opens), which unmounts this component while the
	// compositor is dragging that window. The exit's own route ends the drag, or cancels it.
	useEffect(() => () => stopEscape.current?.(), []);

	const begin = (event: PointerEvent<HTMLElement>, handle: ResizeHandle = 'se') => {
		if (event.button !== 0 || maximised) return;
		watchEscape();
		const box = event.currentTarget.getBoundingClientRect();
		gesture.current = {
			pointer: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			start: live.current,
			handle,
			grab: { x: Math.max(0, event.clientX - box.left), y: Math.max(0, event.clientY - box.top) },
			outside: false,
			exit: null,
		};
		// Capture keeps the drag going outside the handle; it throws for a pointer that is no
		// longer active, and the gesture still works from the events the handle receives.
		try {
			event.currentTarget.setPointerCapture?.(event.pointerId);
		} catch {
			// Ignored: see above.
		}
	};

	// A pointer drag snaps to the area and the neighbours; the keys place a panel exactly.
	const drag = (g: Gesture, dx: number, dy: number, kind: 'move' | 'resize') => {
		const { start, handle } = g;
		if (kind === 'move') {
			const moved = moveRect(start, dx, dy, min, area, collapsed);
			return snapMoveWithin(moved, min, area, neighbours, collapsed);
		}
		const resized = resizeRectFrom(start, handle, dx, dy, min, area);
		const snapped = snapResize(resized, area, neighbours, handle);
		return {
			rect: resizeRectFrom(snapped.rect, handle, 0, 0, min, area),
			guides: snapped.guides,
		};
	};

	const follow = (event: PointerEvent<HTMLElement>, kind: 'move' | 'resize') => {
		const g = gesture.current;
		if (!g || g.pointer !== event.pointerId) return;
		const dx = event.clientX - g.x;
		const dy = event.clientY - g.y;
		const { rect: next, guides } = drag(g, dx, dy, kind);
		onGuides?.(guides);
		if (kind === 'move') {
			const point = { x: event.clientX, y: event.clientY };
			const out = outsideWindow(point.x, point.y);
			if (out && !g.outside) {
				// Past the window's edge: a window exit may take the drag over (tearing the panel off).
				g.exit =
					onLeaveRef.current?.({
						id,
						point,
						source: 'header',
						start: { x: g.x, y: g.y },
						grab: g.grab,
						// An exit that handed the drag to the compositor ends this one with the panel put back.
						finish: () => {
							if (gesture.current !== g) return;
							gesture.current = null;
							stopEscape.current?.();
							onGuidesRef.current?.([]);
							onDockHoverRef.current?.(null);
							onChangeRef.current(g.start, true);
						},
					}) ?? null;
			} else if (!out && g.outside) {
				// Back inside: the panel's own drag again.
				g.exit?.cancel();
				g.exit = null;
			}
			g.outside = out;
			if (out) g.exit?.move?.(point);
			onDockHover?.(out ? null : point);
		}
		onChange(next, false);
	};

	const end = (event: PointerEvent<HTMLElement>, kind: 'move' | 'resize', cancelled = false) => {
		const g = gesture.current;
		if (!g || g.pointer !== event.pointerId) return;
		gesture.current = null;
		stopEscape.current?.();
		try {
			event.currentTarget.releasePointerCapture?.(event.pointerId);
		} catch {
			// The pointer is already gone.
		}
		onGuides?.([]);
		if (kind === 'move') onDockHover?.(null);
		if (cancelled) {
			g.exit?.cancel();
			onChange(g.start, true);
			return;
		}
		if (kind === 'move' && g.outside && g.exit) {
			// Let go outside the window: the exit places it (a window opens there), so the panel
			// stays where it was pressed for the way back.
			onChange(g.start, true);
			g.exit.drop({ x: event.clientX, y: event.clientY });
			return;
		}
		if (kind === 'move' && onDockDrop?.({ x: event.clientX, y: event.clientY })) return;
		const dx = event.clientX - g.x;
		const dy = event.clientY - g.y;
		onChange(drag(g, dx, dy, kind).rect, true);
	};

	const escapeDrag = (event: KeyboardEvent<HTMLElement>): boolean => {
		if (event.key !== 'Escape') return false;
		const g = gesture.current;
		const origin = g ? g.start : keyOrigin.current;
		if (!origin) return false;
		gesture.current = null;
		keyOrigin.current = null;
		g?.exit?.cancel();
		event.preventDefault();
		onDockHover?.(null);
		onChange(origin, true);
		return true;
	};

	const onGripKey = (event: KeyboardEvent<HTMLElement>, kind: 'move' | 'resize') => {
		if (escapeDrag(event)) return;
		const delta = keyDelta(event.key, event.shiftKey);
		if (!delta) return;
		event.preventDefault();
		keyOrigin.current ??= live.current;
		const current = live.current;
		onChange(
			kind === 'move'
				? moveRect(current, delta.dx, delta.dy, min, area, collapsed)
				: resizeRect(current, delta.dx, delta.dy, min, area),
			true,
		);
	};

	const style = {
		'--fls-float-x': `${rect.x}px`,
		'--fls-float-y': `${rect.y}px`,
		'--fls-float-w': `${rect.w}px`,
		'--fls-float-h': `${rect.h}px`,
		'--fls-float-z': z,
	} as CSSProperties;

	const titleId = `float-${id}-title`;
	const label = collapsed ? 'float.expand' : 'float.collapse';

	return (
		<section
			className={styles.panel}
			style={style}
			data-collapsed={collapsed || undefined}
			data-panel-maximised={maximised ? '' : undefined}
			data-suppressed={suppressed ? '' : undefined}
			data-panel={id}
			aria-labelledby={titleId}
			onPointerDownCapture={onRaise}
			onFocusCapture={onRaise}
		>
			<div className={styles.frame}>
				<header
					className={styles.header}
					{...headerMenu}
					onPointerDown={(event) => {
						const button = (event.target as HTMLElement).closest('button');
						if (button && !button.hasAttribute('data-grip')) return;
						begin(event);
					}}
					onPointerMove={(event) => follow(event, 'move')}
					onPointerUp={(event) => end(event, 'move')}
					onPointerCancel={(event) => end(event, 'move', true)}
				>
					<button
						type="button"
						className={styles.grip}
						data-grip=""
						aria-label={t('float.move', { title })}
						onKeyDown={(event) => onGripKey(event, 'move')}
						onBlur={() => (keyOrigin.current = null)}
					>
						<svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
							<circle cx="3" cy="3" r="1.2" />
							<circle cx="9" cy="3" r="1.2" />
							<circle cx="3" cy="6" r="1.2" />
							<circle cx="9" cy="6" r="1.2" />
							<circle cx="3" cy="9" r="1.2" />
							<circle cx="9" cy="9" r="1.2" />
						</svg>
					</button>
					<h2 id={titleId} className={headerExtra ? styles.hiddenTitle : styles.title}>
						{title}
					</h2>
					{subtitle && !headerExtra && <span className={styles.subtitle}>{subtitle}</span>}
					{headerExtra ?? <span className={styles.spacer} />}
					{actions}
					<Tooltip label={t(label, { title })}>
						<button
							type="button"
							className={styles.chevron}
							aria-expanded={!collapsed}
							aria-label={t(label, { title })}
							onClick={onToggleCollapsed}
						>
							<svg
								aria-hidden="true"
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
							>
								<path d={collapsed ? 'M4 6l4 4 4-4' : 'M4 10l4-4 4 4'} />
							</svg>
						</button>
					</Tooltip>
				</header>
				<div className={styles.body} id={`panel-body-${id}`}>
					{children}
				</div>
			</div>
			{!collapsed &&
				!maximised &&
				POINTER_HANDLES.map((handle) => (
					<div
						key={handle}
						className={`${styles.edge} ${styles[`edge-${handle}`]}`}
						data-resize-handle={handle}
						aria-hidden="true"
						onPointerDown={(event) => begin(event, handle)}
						onPointerMove={(event) => follow(event, 'resize')}
						onPointerUp={(event) => end(event, 'resize')}
						onPointerCancel={(event) => end(event, 'resize', true)}
					/>
				))}
			{!collapsed && (
				<button
					type="button"
					className={styles.resize}
					aria-label={t('float.resize', { title })}
					onPointerDown={begin}
					onPointerMove={(event) => follow(event, 'resize')}
					onPointerUp={(event) => end(event, 'resize')}
					onPointerCancel={(event) => end(event, 'resize', true)}
					onKeyDown={(event) => onGripKey(event, 'resize')}
					onBlur={() => (keyOrigin.current = null)}
				/>
			)}
		</section>
	);
}
