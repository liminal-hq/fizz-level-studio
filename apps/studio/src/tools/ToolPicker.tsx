// The floating tool picker: a glass pill of tool keys over the map, moved by its grip
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The pill floats over the top-left of the map until it is moved. Dragging the grip, or the arrow
// keys on it, moves it anywhere inside the map, and the place is reported once the move ends, for
// the workspace to keep. It is drawn one margin inside the map whatever the map's size now, so a
// smaller window or a wider dock never pushes it off. Only the pill's own box takes the pointer.

import type { ToolPickerPlacement } from '@liminal-hq/fizz-studio-protocol/generated/ToolPickerPlacement';
import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type RefObject,
	useLayoutEffect,
} from 'react';
import { TOOL_ICONS } from '../icons/AppIcons';
import { t, type MessageId } from '../i18n/messages';
import { keyDelta, type Size } from '../panels/float/panelGeometry';
import { DEFAULT_PICKER, clampPicker } from './pickerPlace';
import { TOOL_KEYS } from './shortcuts';
import { TOOL_IDS, type ToolId } from './tool';
import { Tooltip } from '../ui/Tooltip';
import styles from './ToolPicker.module.css';

export const TOOL_LABELS: Record<ToolId, MessageId> = {
	paint: 'tools.paint',
	erase: 'tools.erase',
	pick: 'tools.pick',
	select: 'tools.select',
	stamp: 'tools.stamp',
	inspect: 'tools.inspect',
};

export interface ToolPickerProps {
	tool: ToolId;
	onTool: (id: ToolId) => void;
	/** The map the picker floats over, 0 × 0 until it is measured. */
	map: Size;
	/** Where it was moved to, or null for the top-left corner. */
	place: ToolPickerPlacement | null;
	/** Called once a move ends, with the place it ended at. */
	onPlace: (at: ToolPickerPlacement) => void;
}

interface Gesture {
	pointer: number;
	x: number;
	y: number;
	start: ToolPickerPlacement;
}

/** The pill's own size, border included, 0 × 0 until it is laid out. */
function usePillSize(ref: RefObject<HTMLElement | null>): Size {
	const [size, setSize] = useState<Size>({ w: 0, h: 0 });
	useEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const w = Math.ceil(element.offsetWidth);
			const h = Math.ceil(element.offsetHeight);
			setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	// Read again after every commit as well: the observer only hears the element it was given, and
	// a size it never reported (a node replaced after it attached, a layout that settled later)
	// must not stay in the clamp. Setting the same size is a no-op, so this cannot loop.
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const w = Math.ceil(element.offsetWidth);
		const h = Math.ceil(element.offsetHeight);
		setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
	});
	return size;
}

/**
 * The size of the box the pill is placed in, read from the DOM and followed as it changes, so a
 * clamp never rests on a size that was true some layouts ago. `fallback` stands in until the box is
 * laid out, and in a test DOM, which has no layout.
 */
function useBoundsSize(ref: RefObject<HTMLElement | null>, fallback: Size): Size {
	const [size, setSize] = useState<Size>({ w: 0, h: 0 });
	useEffect(() => {
		const parent = ref.current?.offsetParent;
		if (!(parent instanceof HTMLElement) || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const w = Math.floor(parent.clientWidth);
			const h = Math.floor(parent.clientHeight);
			setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(parent);
		return () => observer.disconnect();
	}, [ref]);
	useLayoutEffect(() => {
		const parent = ref.current?.offsetParent;
		if (!(parent instanceof HTMLElement)) return;
		const w = Math.floor(parent.clientWidth);
		const h = Math.floor(parent.clientHeight);
		setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
	});
	return size.w > 0 && size.h > 0 ? size : fallback;
}

export function ToolPicker({ tool, onTool, map: mapProp, place, onPlace }: ToolPickerProps) {
	const pillRef = useRef<HTMLDivElement>(null);
	const pill = usePillSize(pillRef);
	const map = useBoundsSize(pillRef, mapProp);
	const gesture = useRef<Gesture | null>(null);
	const [moving, setMoving] = useState<ToolPickerPlacement | null>(null);
	const at = clampPicker(moving ?? place ?? DEFAULT_PICKER, pill, map);
	const live = useRef(at);
	live.current = at;
	const stopEscape = useRef<(() => void) | null>(null);

	// Escape ends a pointer drag wherever the keyboard focus is, leaving the picker where it was.
	const watchEscape = () => {
		const hear = (event: globalThis.KeyboardEvent) => {
			if (event.key !== 'Escape' || !gesture.current) return;
			event.preventDefault();
			gesture.current = null;
			stopEscape.current?.();
			setMoving(null);
		};
		document.addEventListener('keydown', hear);
		stopEscape.current = () => {
			document.removeEventListener('keydown', hear);
			stopEscape.current = null;
		};
	};
	useEffect(() => () => stopEscape.current?.(), []);

	const begin = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.button !== 0) return;
		gesture.current = {
			pointer: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			start: live.current,
		};
		watchEscape();
		// Capture keeps the drag going outside the grip; it throws for a pointer that is no longer
		// active, and the drag still works from the events the grip receives.
		try {
			event.currentTarget.setPointerCapture?.(event.pointerId);
		} catch {
			// Ignored: see above.
		}
	};

	const follow = (event: PointerEvent<HTMLButtonElement>) => {
		const g = gesture.current;
		if (!g || g.pointer !== event.pointerId) return;
		setMoving({ x: g.start.x + event.clientX - g.x, y: g.start.y + event.clientY - g.y });
	};

	const end = (event: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
		const g = gesture.current;
		if (!g || g.pointer !== event.pointerId) return;
		gesture.current = null;
		stopEscape.current?.();
		try {
			event.currentTarget.releasePointerCapture?.(event.pointerId);
		} catch {
			// The pointer is already gone.
		}
		setMoving(null);
		if (cancelled) return;
		const ended = clampPicker(
			{ x: g.start.x + event.clientX - g.x, y: g.start.y + event.clientY - g.y },
			pill,
			map,
		);
		if (ended.x !== g.start.x || ended.y !== g.start.y) onPlace(ended);
	};

	const onGripKey = (event: KeyboardEvent<HTMLButtonElement>) => {
		const delta = keyDelta(event.key, event.shiftKey);
		if (!delta) return;
		event.preventDefault();
		event.stopPropagation();
		const current = live.current;
		const next = clampPicker({ x: current.x + delta.dx, y: current.y + delta.dy }, pill, map);
		if (next.x !== current.x || next.y !== current.y) onPlace(next);
	};

	const style = {
		'--fls-picker-x': `${at.x}px`,
		'--fls-picker-y': `${at.y}px`,
	} as CSSProperties;

	return (
		<div
			ref={pillRef}
			className={styles.picker}
			role="group"
			aria-label={t('tools.group')}
			data-tool-picker=""
			data-moving={moving ? '' : undefined}
			style={style}
		>
			<Tooltip label={t('tools.move')}>
				<button
					type="button"
					className={styles.grip}
					data-grip=""
					aria-label={t('tools.move')}
					onPointerDown={begin}
					onPointerMove={follow}
					onPointerUp={(event) => end(event, false)}
					onPointerCancel={(event) => end(event, true)}
					onKeyDown={onGripKey}
				>
					<svg aria-hidden="true" width="8" height="16" viewBox="0 0 8 16" fill="currentColor">
						<circle cx="2" cy="3" r="1.2" />
						<circle cx="6" cy="3" r="1.2" />
						<circle cx="2" cy="8" r="1.2" />
						<circle cx="6" cy="8" r="1.2" />
						<circle cx="2" cy="13" r="1.2" />
						<circle cx="6" cy="13" r="1.2" />
					</svg>
				</button>
			</Tooltip>
			{TOOL_IDS.map((id) => {
				const Icon = TOOL_ICONS[id];
				const name = t(TOOL_LABELS[id]);
				const key = TOOL_KEYS[id].toUpperCase();
				return (
					<Tooltip key={id} label={name} keys={key}>
						<button
							type="button"
							className={styles.key}
							aria-label={name}
							aria-pressed={tool === id}
							aria-keyshortcuts={key}
							data-tool={id}
							onClick={() => onTool(id)}
						>
							<Icon size={18} />
						</button>
					</Tooltip>
				);
			})}
		</div>
	);
}
