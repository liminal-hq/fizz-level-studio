// The level canvas: draws a LevelView, turns pointer and key events into tool events in cells
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../i18n/messages';
import type { Cell, PointerPhase, Rect } from '../tools/tool';
import { drawLevel, readCanvasColours, type DrawContext } from './drawLevel';
import styles from './LevelCanvas.module.css';
import { ObjectList } from './ObjectList';
import { resolveTileColours } from './tileColours';
import { wheelAction } from './wheel';
import {
	DEFAULT_ZOOM,
	MAX_ZOOM,
	MIN_ZOOM,
	clampScroll,
	clampZoom,
	moveCursor,
	pixelToCell,
	revealCell,
	zoomAt,
	type Size,
	type Viewport,
} from './viewport';

export interface LevelCanvasProps {
	view: LevelView;
	/** The cell the keyboard cursor is on. */
	cursor: Cell;
	onCursorChange: (cell: Cell) => void;
	/** A pointer or key press, as the current tool should see it, in cell coordinates. */
	onToolEvent: (phase: PointerPhase, cell: Cell) => void;
	/** Cells a stroke in progress covers, drawn as a wash. */
	preview?: readonly Cell[];
	/** Select's rectangle, drawn as an outline. */
	selection?: Rect | null;
	/** Called when a problem in the objects list is chosen. */
	onSelectLine?: (line: number) => void;
}

const NO_CELLS: readonly Cell[] = [];
const FALLBACK_SIZE: Size = { width: 640, height: 384 };

/** The canvas is not themed: the colours come from the `--fls-tile-*` and `--fls-canvas-*` tokens. */
export function LevelCanvas({
	view,
	cursor,
	onCursorChange,
	onToolEvent,
	preview = NO_CELLS,
	selection = null,
	onSelectLine,
}: LevelCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const pressed = useRef(false);
	const [size, setSize] = useState<Size>(FALLBACK_SIZE);
	const [camera, setCamera] = useState<Viewport>({ zoom: DEFAULT_ZOOM, scrollX: 0, scrollY: 0 });

	// The scroll is re-clamped on every render, so a level that shrinks never leaves it off the edge.
	const viewport = useMemo<Viewport>(
		() => ({ ...camera, ...clampScroll(camera, size, view) }),
		[camera, size, view],
	);

	useEffect(() => {
		const frame = frameRef.current;
		if (!frame || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => {
			const width = Math.floor(frame.clientWidth);
			const height = Math.floor(frame.clientHeight);
			if (width > 0 && height > 0) setSize({ width, height });
		});
		observer.observe(frame);
		return () => observer.disconnect();
	}, []);

	// The wheel zooms about the pointer, and pans when it moves sideways (see `wheelAction`). It is a
	// native listener because a React wheel handler is passive and cannot stop the page scrolling.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const action = wheelAction(event);
			if (action.kind === 'none') return;
			const rect = canvas.getBoundingClientRect();
			const px = event.clientX - rect.left;
			const py = event.clientY - rect.top;
			setCamera((current) => {
				if (action.kind === 'pan') {
					const scrolled = {
						...current,
						scrollX: current.scrollX + action.dx,
						scrollY: current.scrollY + action.dy,
					};
					return { ...scrolled, ...clampScroll(scrolled, size, view) };
				}
				return zoomAt(current, current.zoom + action.step, px, py, size, view);
			});
		};
		canvas.addEventListener('wheel', onWheel, { passive: false });
		return () => canvas.removeEventListener('wheel', onWheel);
	}, [size, view]);

	// Colours are read from the tokens once per palette, then reused by every redraw.
	const colourCache = useRef<{ key: string; colours: string[] } | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		// Assigning the size reallocates the bitmap, so it only happens when the size changes.
		const wide = Math.round(size.width * ratio);
		const high = Math.round(size.height * ratio);
		if (canvas.width !== wide) canvas.width = wide;
		if (canvas.height !== high) canvas.height = high;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		const style = getComputedStyle(canvas);
		const read = (token: string) => style.getPropertyValue(token);
		const key = view.palette.join('\n');
		if (colourCache.current?.key !== key) {
			colourCache.current = { key, colours: resolveTileColours(view.palette, read) };
		}
		drawLevel(ctx as DrawContext, view, {
			viewport,
			window: size,
			tileColours: colourCache.current.colours,
			colours: readCanvasColours(read),
			cursor,
			selection,
			preview,
		});
	}, [view, viewport, size, cursor, selection, preview]);

	const cellAt = (event: PointerEvent<HTMLCanvasElement>): Cell => {
		const rect = event.currentTarget.getBoundingClientRect();
		return pixelToCell(event.clientX - rect.left, event.clientY - rect.top, viewport, view);
	};

	const inside = (cell: Cell) =>
		cell.x >= 0 && cell.y >= 0 && cell.x < view.width && cell.y < view.height;

	const moveTo = (cell: Cell) => {
		onCursorChange(cell);
		setCamera(revealCell(viewport, cell, size, view));
	};

	const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
		if (event.button !== 0) return;
		event.currentTarget.focus();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		pressed.current = true;
		const cell = cellAt(event);
		if (inside(cell)) onCursorChange(cell);
		onToolEvent('down', cell);
	};

	const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
		const cell = cellAt(event);
		if (inside(cell) && (cell.x !== cursor.x || cell.y !== cursor.y)) onCursorChange(cell);
		if (pressed.current) onToolEvent('move', cell);
	};

	const onPointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
		if (!pressed.current) return;
		pressed.current = false;
		onToolEvent('up', cellAt(event));
	};

	const zoomBy = (step: number) => {
		const centre = { x: size.width / 2, y: size.height / 2 };
		setCamera(zoomAt(viewport, viewport.zoom + step, centre.x, centre.y, size, view));
	};

	const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const { key } = event;
		if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
			moveTo(moveCursor(cursor, key, view));
		} else if (key === 'Home' || key === 'End') {
			moveTo(moveCursor(cursor, key, view));
		} else if (key === ' ' || key === 'Enter') {
			onToolEvent('down', cursor);
			onToolEvent('up', cursor);
		} else if (key === '+' || key === '=') {
			zoomBy(1);
		} else if (key === '-' || key === '_') {
			zoomBy(-1);
		} else {
			return;
		}
		event.preventDefault();
	};

	const word = view.palette[view.cells[cursor.y * view.width + cursor.x] ?? 0] ?? '';

	return (
		<div className={styles.root}>
			<div className={styles.stage}>
				<div className={styles.frame} ref={frameRef}>
					<canvas
						ref={canvasRef}
						className={styles.canvas}
						tabIndex={0}
						role="application"
						aria-label={t('canvas.label', {
							name: view.name,
							width: view.width,
							height: view.height,
						})}
						onKeyDown={onKeyDown}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerEnd}
						onPointerCancel={onPointerEnd}
					/>
				</div>
				<div className={styles.bar}>
					<span className={styles.status} role="status">
						{t('canvas.cell', { x: cursor.x, y: cursor.y, tile: word })}
					</span>
					<div className={styles.zoom} role="group" aria-label={t('canvas.zoomGroup')}>
						<button
							type="button"
							className={styles.button}
							disabled={viewport.zoom <= MIN_ZOOM}
							onClick={() => zoomBy(-1)}
						>
							{t('canvas.zoomOut')}
						</button>
						<span>{t('canvas.zoomLevel', { zoom: clampZoom(viewport.zoom) })}</span>
						<button
							type="button"
							className={styles.button}
							disabled={viewport.zoom >= MAX_ZOOM}
							onClick={() => zoomBy(1)}
						>
							{t('canvas.zoomIn')}
						</button>
					</div>
				</div>
			</div>
			<ObjectList view={view} onSelectCell={moveTo} onSelectLine={onSelectLine} />
		</div>
	);
}
