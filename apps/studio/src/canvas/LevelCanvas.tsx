// The level canvas: draws a LevelView, turns pointer and key events into tool events in cells
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostCell } from '@liminal-hq/fizz-studio-protocol/generated/GhostCell';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
} from 'react';
import { t } from '../i18n/messages';
import type { Cell, PointerPhase, Rect } from '../tools/tool';
import { drawLevel, readCanvasColours, type DrawContext } from './drawLevel';
import styles from './LevelCanvas.module.css';
import { resolveTileColours } from './tileColours';
import { wheelAction } from './wheel';
import {
	DEFAULT_ZOOM,
	MAX_ZOOM,
	MIN_ZOOM,
	clampScroll,
	NO_INSETS,
	clampZoom,
	frameViewport,
	moveCursor,
	pixelToCell,
	revealCell,
	uncoveredRect,
	zoomAt,
	type Insets,
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
	/** `item` draws the preview as ghost discs at the cells an item stroke will write. */
	previewShape?: 'cell' | 'item';
	/** Where a paste would land, drawn dashed. */
	paste?: Rect | null;
	/** Select's rectangle, drawn as an outline. */
	selection?: Rect | null;
	/** The cell of the thing Inspect selected, drawn as an outline and named by `data-inspected`. */
	inspected?: Cell | null;
	/** Called on Escape while the canvas has focus and something is inspected, to clear it. */
	onClearInspected?: () => void;
	/** Claude's pending proposals to draw as ghosts; leave out to draw none. */
	ghosts?: readonly GhostCell[];
	/** Called when the person clicks a cell of the grid. */
	onCellChosen?: (cell: Cell, source: 'grid') => void;
	/**
	 * Asks the canvas to bring a cell into view, such as one chosen in the objects list. A new
	 * `serial` asks again for the same cell.
	 */
	reveal?: { cell: Cell; serial: number } | null;
	/**
	 * Controls that float over the map (the tool picker), given the size of the part of the map
	 * nothing covers so they can keep inside it. They are placed from that part's top-left corner
	 * and clipped to it, so they never reach under a dock or the status line.
	 */
	overlay?: (map: { w: number; h: number }) => ReactNode;
	/**
	 * How far the docks lie over the frame from each edge. The canvas draws under them, but the
	 * camera fits, clamps and centres the level in what they leave, and the status line sits just
	 * inside them.
	 */
	insets?: Insets;
}

const NO_CELLS: readonly Cell[] = [];
const NO_GHOSTS: readonly GhostCell[] = [];
const FALLBACK_SIZE: Size = { width: 640, height: 384 };

/** The canvas is not themed: the colours come from the `--fls-tile-*` and `--fls-canvas-*` tokens. */
export function LevelCanvas({
	view,
	cursor,
	onCursorChange,
	onToolEvent,
	preview = NO_CELLS,
	previewShape = 'cell',
	paste = null,
	selection = null,
	inspected = null,
	onClearInspected,
	ghosts = NO_GHOSTS,
	reveal = null,
	onCellChosen,
	overlay,
	insets = NO_INSETS,
}: LevelCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const barRef = useRef<HTMLDivElement>(null);
	const pressed = useRef(false);
	const [size, setSize] = useState<Size>(FALLBACK_SIZE);
	const [barHigh, setBarHigh] = useState(0);
	const [camera, setCamera] = useState<Viewport>({ zoom: DEFAULT_ZOOM, scrollX: 0, scrollY: 0 });

	// The frame spans everything, docks included; the camera's window is the part the docks and the
	// status line leave uncovered, and its scroll is measured from that part's corner.
	const { top, right, bottom, left } = insets;
	const visible = useMemo(
		() => uncoveredRect(size, { top, right, bottom: bottom + barHigh, left }),
		[size, top, right, bottom, left, barHigh],
	);
	const seen = useMemo<Size>(() => ({ width: visible.width, height: visible.height }), [visible]);

	// The scroll is re-clamped on every render, so a level that shrinks never leaves it off the edge.
	const viewport = useMemo<Viewport>(
		() => ({ ...camera, ...clampScroll(camera, seen, view) }),
		[camera, seen, view],
	);
	// What the whole frame draws and hit-tests with: the camera shifted by the covered margins.
	const drawn = useMemo(() => frameViewport(viewport, visible), [viewport, visible]);

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

	// The status line lies over the bottom of the frame, so its height is covered too.
	useEffect(() => {
		const bar = barRef.current;
		if (!bar || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => setBarHigh(Math.ceil(bar.offsetHeight)));
		observer.observe(bar);
		return () => observer.disconnect();
	}, []);

	// Read again after every commit as well, as the tool picker does: an observer can miss a size
	// that settled after it attached, and a stale one would leave the camera's window wrong. Setting
	// the same size is a no-op, so this cannot loop.
	useLayoutEffect(() => {
		const frame = frameRef.current;
		if (frame) {
			const width = Math.floor(frame.clientWidth);
			const height = Math.floor(frame.clientHeight);
			if (width > 0 && height > 0) {
				setSize((old) => (old.width === width && old.height === height ? old : { width, height }));
			}
		}
		const bar = barRef.current;
		if (bar) {
			const high = Math.ceil(bar.offsetHeight);
			setBarHigh((old) => (old === high ? old : high));
		}
	});

	// The wheel zooms about the pointer, and pans when it moves sideways (see `wheelAction`). It is a
	// native listener because a React wheel handler is passive and cannot stop the page scrolling.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const action = wheelAction(event);
			if (action.kind === 'none') return;
			// The camera zooms about the pointer measured from the uncovered part's corner.
			const rect = canvas.getBoundingClientRect();
			const px = event.clientX - rect.left - visible.x;
			const py = event.clientY - rect.top - visible.y;
			setCamera((current) => {
				if (action.kind === 'pan') {
					const scrolled = {
						...current,
						scrollX: current.scrollX + action.dx,
						scrollY: current.scrollY + action.dy,
					};
					return { ...scrolled, ...clampScroll(scrolled, seen, view) };
				}
				return zoomAt(current, current.zoom + action.step, px, py, seen, view);
			});
		};
		canvas.addEventListener('wheel', onWheel, { passive: false });
		return () => canvas.removeEventListener('wheel', onWheel);
	}, [visible, seen, view]);

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
			viewport: drawn,
			window: size,
			tileColours: colourCache.current.colours,
			colours: readCanvasColours(read),
			cursor,
			selection,
			preview,
			ghosts,
			previewShape,
			paste,
			inspected,
		});
	}, [view, drawn, size, cursor, selection, preview, ghosts, previewShape, paste, inspected]);

	// The canvas spans the frame, so a pixel from its corner maps through the frame's viewport.
	const cellAt = (event: PointerEvent<HTMLCanvasElement>): Cell => {
		const rect = event.currentTarget.getBoundingClientRect();
		return pixelToCell(event.clientX - rect.left, event.clientY - rect.top, drawn, view);
	};

	const inside = (cell: Cell) =>
		cell.x >= 0 && cell.y >= 0 && cell.x < view.width && cell.y < view.height;

	const moveTo = (cell: Cell) => {
		onCursorChange(cell);
		setCamera(revealCell(viewport, cell, seen, view));
	};

	// A cell chosen elsewhere is brought into view; each new serial asks once.
	const lastReveal = useRef(0);
	useEffect(() => {
		if (!reveal || reveal.serial === lastReveal.current) return;
		lastReveal.current = reveal.serial;
		setCamera((current) => revealCell(current, reveal.cell, seen, view));
	}, [reveal, seen, view]);

	const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
		if (event.button !== 0) return;
		event.currentTarget.focus();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		pressed.current = true;
		const cell = cellAt(event);
		if (inside(cell)) onCursorChange(cell);
		if (inside(cell)) onCellChosen?.(cell, 'grid');
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
		const centre = { x: seen.width / 2, y: seen.height / 2 };
		setCamera(zoomAt(viewport, viewport.zoom + step, centre.x, centre.y, seen, view));
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
		} else if (key === 'Escape' && inspected && onClearInspected) {
			onClearInspected();
		} else {
			return;
		}
		event.preventDefault();
	};

	const word = view.palette[view.cells[cursor.y * view.width + cursor.x] ?? 0] ?? '';

	const style = {
		'--fls-cover-right': `${right}px`,
		'--fls-cover-bottom': `${bottom}px`,
		'--fls-cover-left': `${left}px`,
		'--fls-map-x': `${visible.x}px`,
		'--fls-map-y': `${visible.y}px`,
		'--fls-map-w': `${visible.width}px`,
		'--fls-map-h': `${visible.height}px`,
	} as CSSProperties;

	return (
		<div className={styles.root} style={style}>
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
						data-inspected={inspected ? `${inspected.x},${inspected.y}` : undefined}
						onKeyDown={onKeyDown}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerEnd}
						onPointerCancel={onPointerEnd}
					/>
					{overlay && (
						<div className={styles.map} data-map="">
							{overlay({ w: visible.width, h: visible.height })}
						</div>
					)}
				</div>
				<div className={styles.bar} ref={barRef} data-canvas-bar="">
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
		</div>
	);
}
