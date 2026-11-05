// The draggable edge between the level and a dock, with a readout of the size while it moves
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t, type MessageId } from '../../i18n/messages';
import { KEY_STEP, KEY_STEP_LARGE } from '../float/panelGeometry';
import styles from './DockResizeHandle.module.css';

export interface DockResizeHandleProps {
	zone: ZoneId;
	/** The dock's size now, in pixels. */
	size: number;
	/** The smallest and largest the dock may be (its minimum and its cap). */
	min: number;
	max: number;
	/** Asks for a new size; the model holds it to the limits. */
	onResize: (size: number) => void;
	/** Double-click: back to the default size. */
	onReset: () => void;
}

const LABELS: Record<ZoneId, MessageId> = {
	left: 'dock.resize.left',
	right: 'dock.resize.right',
	bottom: 'dock.resize.bottom',
};

/** How far a pointer move along the axis grows the dock: towards the level for the side docks. */
function growth(zone: ZoneId, dx: number, dy: number): number {
	return zone === 'left' ? dx : zone === 'right' ? -dx : -dy;
}

/** The dock's growth for an arrow key, or null for any other key. */
function keyGrowth(zone: ZoneId, key: string): number | null {
	if (zone === 'bottom') return key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : null;
	const towards = zone === 'left' ? 'ArrowRight' : 'ArrowLeft';
	const away = zone === 'left' ? 'ArrowLeft' : 'ArrowRight';
	return key === towards ? 1 : key === away ? -1 : null;
}

interface Drag {
	pointer: number;
	x: number;
	y: number;
	start: number;
}

/**
 * An ARIA separator that resizes a dock. A pointer drag captures the pointer and Escape puts the
 * dock back; the arrow keys step it (Shift for larger steps), Home and End go to the limits, and a
 * double-click resets it. The readout shows while the pointer is down or the keys are being used on it.
 */
export function DockResizeHandle({
	zone,
	size,
	min,
	max,
	onResize,
	onReset,
}: DockResizeHandleProps) {
	const drag = useRef<Drag | null>(null);
	const [active, setActive] = useState(false);
	// True once the keys have been used on the handle, until it loses the focus or the pointer takes over.
	const [keys, setKeys] = useState(false);
	const label = t(LABELS[zone]);
	const vertical = zone !== 'bottom';

	const stop = (event: PointerEvent<HTMLElement>) => {
		const g = drag.current;
		if (!g || g.pointer !== event.pointerId) return null;
		drag.current = null;
		setActive(false);
		try {
			event.currentTarget.releasePointerCapture?.(event.pointerId);
		} catch {
			// Nothing was captured.
		}
		return g;
	};

	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === 'Escape' && drag.current) {
			event.preventDefault();
			onResize(drag.current.start);
			drag.current = null;
			setActive(false);
			return;
		}
		if (['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
			setKeys(true);
		}
		if (event.key === 'Home') {
			event.preventDefault();
			return onResize(min);
		}
		if (event.key === 'End') {
			event.preventDefault();
			return onResize(max);
		}
		const sign = keyGrowth(zone, event.key);
		if (sign === null) return;
		event.preventDefault();
		onResize(size + sign * (event.shiftKey ? KEY_STEP_LARGE : KEY_STEP));
	};

	return (
		<div
			className={styles.handle}
			data-zone={zone}
			data-active={active || undefined}
			role="separator"
			tabIndex={0}
			aria-label={label}
			aria-orientation={vertical ? 'vertical' : 'horizontal'}
			aria-valuenow={size}
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuetext={t('dock.size', { size })}
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.currentTarget.focus();
				// A pointer the browser does not know (a synthetic event) cannot be captured; the drag still works.
				try {
					event.currentTarget.setPointerCapture?.(event.pointerId);
				} catch {
					// Nothing to capture.
				}
				drag.current = {
					pointer: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					start: size,
				};
				setKeys(false);
				setActive(true);
			}}
			onPointerMove={(event) => {
				const g = drag.current;
				if (!g || g.pointer !== event.pointerId) return;
				onResize(g.start + growth(zone, event.clientX - g.x, event.clientY - g.y));
			}}
			onPointerUp={(event) => {
				const g = stop(event);
				if (g) onResize(g.start + growth(zone, event.clientX - g.x, event.clientY - g.y));
			}}
			onPointerCancel={(event) => {
				const g = stop(event);
				if (g) onResize(g.start);
			}}
			onDoubleClick={onReset}
			onKeyDown={onKeyDown}
			onBlur={() => setKeys(false)}
		>
			{(active || keys) && (
				<span className={styles.readout} aria-hidden="true">
					{t('dock.size', { size })}
				</span>
			)}
		</div>
	);
}
