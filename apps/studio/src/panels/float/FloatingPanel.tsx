// A panel that floats over the editor: dragged by its header, resized by its corner, collapsible
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
import { t } from '../../i18n/messages';
import styles from './FloatingPanel.module.css';
import { isMeasured, keyDelta, moveRect, resizeRect, type Rect, type Size } from './panelGeometry';
import { snapMoveWithin, snapResize, type Guide } from './snap';

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
	/** Extra controls in the header, such as a Tear off button. */
	actions?: ReactNode;
	children: ReactNode;
}

const UNBOUNDED: Size = { w: 100_000, h: 100_000 };
const NO_NEIGHBOURS: readonly Rect[] = [];

interface Gesture {
	pointer: number;
	x: number;
	y: number;
	start: Rect;
}

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
	actions,
	children,
}: FloatingPanelProps) {
	// Until the area has been laid out it has no edges to keep a panel inside.
	const area = isMeasured(measured) ? measured : UNBOUNDED;
	const gesture = useRef<Gesture | null>(null);
	// Where the panel was when a key gesture began, so Escape can put it back.
	const keyOrigin = useRef<Rect | null>(null);
	const live = useRef(rect);
	live.current = rect;

	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onGuidesRef = useRef(onGuides);
	onGuidesRef.current = onGuides;
	const stopEscape = useRef<(() => void) | null>(null);

	// Escape ends a pointer drag wherever the keyboard focus is, putting the panel back.
	const watchEscape = () => {
		const hear = (event: globalThis.KeyboardEvent) => {
			const g = gesture.current;
			if (event.key !== 'Escape' || !g) return;
			gesture.current = null;
			stopEscape.current?.();
			onGuidesRef.current?.([]);
			onChangeRef.current(g.start, true);
		};
		document.addEventListener('keydown', hear);
		stopEscape.current = () => {
			document.removeEventListener('keydown', hear);
			stopEscape.current = null;
		};
	};
	useEffect(() => () => stopEscape.current?.(), []);

	const begin = (event: PointerEvent<HTMLElement>) => {
		if (event.button !== 0) return;
		watchEscape();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		gesture.current = {
			pointer: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			start: live.current,
		};
	};

	// A pointer drag snaps to the area and the neighbours; the keys place a panel exactly.
	const drag = (start: Rect, dx: number, dy: number, kind: 'move' | 'resize') => {
		if (kind === 'move') {
			const moved = moveRect(start, dx, dy, min, area, collapsed);
			return snapMoveWithin(moved, min, area, neighbours, collapsed);
		}
		const resized = resizeRect(start, dx, dy, min, area);
		const snapped = snapResize(resized, area, neighbours);
		return { rect: resizeRect(snapped.rect, 0, 0, min, area), guides: snapped.guides };
	};

	const follow = (event: PointerEvent<HTMLElement>, kind: 'move' | 'resize') => {
		const g = gesture.current;
		if (!g || g.pointer !== event.pointerId) return;
		const dx = event.clientX - g.x;
		const dy = event.clientY - g.y;
		const { rect: next, guides } = drag(g.start, dx, dy, kind);
		onGuides?.(guides);
		onChange(next, false);
	};

	const end = (event: PointerEvent<HTMLElement>, kind: 'move' | 'resize', cancelled = false) => {
		const g = gesture.current;
		if (!g || g.pointer !== event.pointerId) return;
		gesture.current = null;
		stopEscape.current?.();
		event.currentTarget.releasePointerCapture?.(event.pointerId);
		onGuides?.([]);
		if (cancelled) {
			onChange(g.start, true);
			return;
		}
		const dx = event.clientX - g.x;
		const dy = event.clientY - g.y;
		onChange(drag(g.start, dx, dy, kind).rect, true);
	};

	const escapeDrag = (event: KeyboardEvent<HTMLElement>): boolean => {
		if (event.key !== 'Escape') return false;
		const g = gesture.current;
		const origin = g ? g.start : keyOrigin.current;
		if (!origin) return false;
		gesture.current = null;
		keyOrigin.current = null;
		event.preventDefault();
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
			data-panel={id}
			aria-labelledby={titleId}
			onPointerDownCapture={onRaise}
			onFocusCapture={onRaise}
		>
			<header
				className={styles.header}
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
				<h2 id={titleId} className={styles.title}>
					{title}
				</h2>
				{subtitle && <span className={styles.subtitle}>{subtitle}</span>}
				<span className={styles.spacer} />
				{actions}
				<button
					type="button"
					className={styles.chevron}
					aria-expanded={!collapsed}
					aria-label={t(label, { title })}
					title={t(label, { title })}
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
			</header>
			<div className={styles.body}>{children}</div>
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
