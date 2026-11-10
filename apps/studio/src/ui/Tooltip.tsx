// The in-app tooltip: one component every icon-only control opts into with a single wrapper
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	cloneElement,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useSyncExternalStore,
	type FocusEvent,
	type PointerEvent,
	type ReactElement,
	type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';
import { keyParts, placeTooltip } from './tooltipModel';
import { tooltipLayer } from './tooltipLayer';
import { activeTooltip, dismissTooltip, requestTooltip, subscribeTooltip } from './tooltipStore';

export interface TooltipProps {
	/** What the control is called: the tooltip's first line. */
	label: string;
	/** The control's shortcut as text (`Ctrl+S`), drawn as keycaps. */
	keys?: string | undefined;
	/** Why the control cannot be used now, or a hint under the label. */
	reason?: string | undefined;
	/** The one control the tooltip hangs from; it keeps its own `aria-label`. */
	children: ReactElement;
}

interface TriggerProps {
	'aria-describedby'?: string;
	onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
	onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
	onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
	onFocus?: (event: FocusEvent<HTMLElement>) => void;
	onBlur?: (event: FocusEvent<HTMLElement>) => void;
}

/** Keyboard focus shows a tooltip; focus a pointer press gave does not (it is hidden by the press anyway). */
function focusVisible(element: HTMLElement): boolean {
	try {
		return element.matches(':focus-visible');
	} catch {
		return true;
	}
}

/**
 * Wraps one control so it shows a tooltip: after a short rest of the pointer (at once when moving
 * from a neighbour) or on keyboard focus; it hides on leaving, blur, Escape, a press and any scroll,
 * and when the control is removed. Touch never shows it. While shown, the control is described by
 * the tooltip (`aria-describedby`), and keeps its `aria-label`. Only one tooltip shows in a window.
 * A control that uses this must not also carry a native `title`.
 */
export function Tooltip({ label, keys, reason, children }: TooltipProps) {
	const id = useId();
	const shown = useSyncExternalStore(subscribeTooltip, () => activeTooltip()?.id === id);
	const anchor = useSyncExternalStore(subscribeTooltip, () =>
		activeTooltip()?.id === id ? activeTooltip()!.anchor : null,
	);
	const child = children as ReactElement<TriggerProps>;
	const props = child.props;

	const open = useCallback(
		(element: HTMLElement, immediate: boolean) =>
			requestTooltip({ id, anchor: element }, immediate),
		[id],
	);

	useEffect(() => () => dismissTooltip(id), [id]);

	// While shown: Escape, a scroll anywhere, and the anchor leaving the page close it.
	useEffect(() => {
		if (!anchor) return;
		const close = () => dismissTooltip(id);
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		document.addEventListener('keydown', onKey, true);
		document.addEventListener('scroll', close, true);
		window.addEventListener('blur', close);
		const watcher = new MutationObserver(() => {
			if (!anchor.isConnected) close();
		});
		watcher.observe(document.body, { childList: true, subtree: true });
		return () => {
			document.removeEventListener('keydown', onKey, true);
			document.removeEventListener('scroll', close, true);
			window.removeEventListener('blur', close);
			watcher.disconnect();
		};
	}, [anchor, id]);

	const trigger = cloneElement(child, {
		...(shown ? { 'aria-describedby': id } : {}),
		onPointerEnter: (event: PointerEvent<HTMLElement>) => {
			props.onPointerEnter?.(event);
			if (event.pointerType !== 'touch') open(event.currentTarget, false);
		},
		onPointerLeave: (event: PointerEvent<HTMLElement>) => {
			props.onPointerLeave?.(event);
			dismissTooltip(id);
		},
		onPointerDown: (event: PointerEvent<HTMLElement>) => {
			props.onPointerDown?.(event);
			dismissTooltip(id);
		},
		onFocus: (event: FocusEvent<HTMLElement>) => {
			props.onFocus?.(event);
			if (focusVisible(event.currentTarget)) open(event.currentTarget, true);
		},
		onBlur: (event: FocusEvent<HTMLElement>) => {
			props.onBlur?.(event);
			dismissTooltip(id);
		},
	});

	return (
		<>
			{trigger}
			{shown && anchor && (
				<TooltipSurface id={id} anchor={anchor} label={label} keys={keys} reason={reason} />
			)}
		</>
	);
}

interface SurfaceProps {
	id: string;
	anchor: HTMLElement;
	label: string;
	keys: string | undefined;
	reason: string | undefined;
}

/** The tooltip itself, drawn in the tooltip layer and placed against its anchor before it paints. */
function TooltipSurface({ id, anchor, label, keys, reason }: SurfaceProps): ReactNode {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const rect = anchor.getBoundingClientRect();
		const placed = placeTooltip(
			{ left: rect.left, top: rect.top, width: rect.width, height: rect.height },
			{ width: element.offsetWidth, height: element.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
		);
		element.style.left = `${placed.left}px`;
		element.style.top = `${placed.top}px`;
		element.dataset.side = placed.side;
	});
	return createPortal(
		<div ref={ref} id={id} role="tooltip" className={styles.tooltip} data-fls-tooltip="">
			<span className={styles.name}>
				{label}
				{keys && (
					<span className={styles.keys}>
						{keyParts(keys).map((part, index) => (
							<kbd key={index} className={styles.key}>
								{part}
							</kbd>
						))}
					</span>
				)}
			</span>
			{reason && <span className={styles.reason}>{reason}</span>}
		</div>,
		tooltipLayer(),
	);
}
