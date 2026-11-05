// Draws a LevelView onto a 2D canvas context: tiles, objects, grid, selection and cursor
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { Cell, Rect } from '../tools/tool';
import { glyphOf, isEmptyTile, type TokenReader } from './tileColours';
import {
	GLYPH_MIN_CELL_PX,
	GRID_MIN_CELL_PX,
	cellOrigin,
	cellPx,
	type Size,
	type Viewport,
} from './viewport';

/** The part of `CanvasRenderingContext2D` the drawing uses, so a test can stand one in. */
export type DrawContext = Pick<
	CanvasRenderingContext2D,
	| 'fillRect'
	| 'strokeRect'
	| 'fillText'
	| 'beginPath'
	| 'moveTo'
	| 'lineTo'
	| 'closePath'
	| 'arc'
	| 'fill'
	| 'stroke'
	| 'font'
	| 'fillStyle'
	| 'strokeStyle'
	| 'lineWidth'
	| 'textAlign'
	| 'textBaseline'
>;

/** The colours around the tiles, read once from the theme's canvas tokens. */
export interface CanvasColours {
	background: string;
	grid: string;
	glyph: string;
	cursor: string;
	selection: string;
	preview: string;
	item: string;
	spawn: string;
	start: string;
	ink: string;
}

const CANVAS_TOKENS: Record<keyof CanvasColours, string> = {
	background: '--fls-canvas-bg',
	grid: '--fls-canvas-grid',
	glyph: '--fls-canvas-glyph',
	cursor: '--fls-canvas-cursor',
	selection: '--fls-canvas-selection',
	preview: '--fls-canvas-preview',
	item: '--fls-canvas-item',
	spawn: '--fls-canvas-spawn',
	start: '--fls-canvas-start',
	ink: '--fls-canvas-object-ink',
};

export function readCanvasColours(read: TokenReader): CanvasColours {
	const colours = {} as CanvasColours;
	for (const key of Object.keys(CANVAS_TOKENS) as Array<keyof CanvasColours>) {
		colours[key] = read(CANVAS_TOKENS[key]).trim();
	}
	return colours;
}

export interface DrawOptions {
	viewport: Viewport;
	/** The canvas's size in pixels. */
	window: Size;
	/** One CSS colour per palette index (see `resolveTileColours`); empty for no fill. */
	tileColours: readonly string[];
	colours: CanvasColours;
	cursor: Cell | null;
	selection: Rect | null;
	/** Cells a drag in progress covers. */
	preview: readonly Cell[];
}

/**
 * The row an enemy with no `y` is drawn on: the first empty cell above the highest filled one in
 * its column. Only a place to draw it; where the game puts it is the game's decision.
 */
export function restingRow(view: LevelView, x: number): number {
	for (let y = view.height - 1; y >= 0; y--) {
		const word = view.palette[view.cells[y * view.width + x] ?? 0] ?? 'empty';
		if (!isEmptyTile(word)) return Math.min(y + 1, view.height - 1);
	}
	return 0;
}

/** Draws only the cells inside the window, so a redraw costs what the screen shows. */
export function drawLevel(ctx: DrawContext, view: LevelView, options: DrawOptions): void {
	const { viewport, window, colours } = options;
	const size = cellPx(viewport.zoom);
	const level: Size = { width: view.width, height: view.height };

	ctx.fillStyle = colours.background;
	ctx.fillRect(0, 0, window.width, window.height);

	// The visible columns, and the visible rows counted from the bottom.
	const firstX = Math.max(0, Math.floor(viewport.scrollX / size));
	const lastX = Math.min(view.width - 1, Math.floor((viewport.scrollX + window.width) / size));
	const topRow = Math.max(0, Math.floor(viewport.scrollY / size));
	const bottomRow = Math.min(
		view.height - 1,
		Math.floor((viewport.scrollY + window.height) / size),
	);
	const glyphs = size >= GLYPH_MIN_CELL_PX;
	if (glyphs) {
		ctx.font = `${Math.floor(size * 0.6)}px ui-monospace, monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
	}

	let current = '';
	for (let row = topRow; row <= bottomRow; row++) {
		const y = view.height - 1 - row;
		const top = row * size - viewport.scrollY;
		for (let x = firstX; x <= lastX; x++) {
			const index = view.cells[y * view.width + x] ?? 0;
			const colour = options.tileColours[index];
			if (!colour) continue;
			if (colour !== current) {
				ctx.fillStyle = colour;
				current = colour;
			}
			ctx.fillRect(x * size - viewport.scrollX, top, size, size);
		}
	}

	if (glyphs) {
		ctx.fillStyle = colours.glyph;
		for (let row = topRow; row <= bottomRow; row++) {
			const y = view.height - 1 - row;
			const top = row * size - viewport.scrollY;
			for (let x = firstX; x <= lastX; x++) {
				const word = view.palette[view.cells[y * view.width + x] ?? 0] ?? '';
				if (isEmptyTile(word) || !options.tileColours[view.cells[y * view.width + x] ?? 0]) {
					continue;
				}
				ctx.fillText(glyphOf(word), x * size - viewport.scrollX + size / 2, top + size / 2);
			}
		}
	}

	if (size >= GRID_MIN_CELL_PX) {
		ctx.strokeStyle = colours.grid;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let x = firstX; x <= lastX + 1; x++) {
			const px = x * size - viewport.scrollX + 0.5;
			ctx.moveTo(px, 0);
			ctx.lineTo(px, window.height);
		}
		for (let row = topRow; row <= bottomRow + 1; row++) {
			const py = row * size - viewport.scrollY + 0.5;
			ctx.moveTo(0, py);
			ctx.lineTo(window.width, py);
		}
		ctx.stroke();
	}

	const visible = (cell: Cell) =>
		cell.x >= firstX &&
		cell.x <= lastX &&
		view.height - 1 - cell.y >= topRow &&
		view.height - 1 - cell.y <= bottomRow;
	const origin = (cell: Cell) => cellOrigin(cell, viewport, level);

	// Items are discs and spawns are diamonds, each with the first letter of its kind.
	const letter = (kind: string, cell: Cell) => {
		if (!glyphs) return;
		const at = origin(cell);
		ctx.fillStyle = colours.ink;
		ctx.fillText(glyphOf(kind), at.x + size / 2, at.y + size / 2);
	};
	for (const item of view.items) {
		if (!visible(item)) continue;
		const at = origin(item);
		ctx.fillStyle = colours.item;
		ctx.beginPath();
		ctx.arc(at.x + size / 2, at.y + size / 2, size * 0.36, 0, Math.PI * 2);
		ctx.fill();
		letter(item.kind, item);
	}
	for (const spawn of view.spawns) {
		const cell = { x: spawn.x, y: spawn.y ?? restingRow(view, spawn.x) };
		if (!visible(cell)) continue;
		const at = origin(cell);
		const mid = { x: at.x + size / 2, y: at.y + size / 2 };
		const reach = size * 0.42;
		ctx.fillStyle = colours.spawn;
		ctx.beginPath();
		ctx.moveTo(mid.x, mid.y - reach);
		ctx.lineTo(mid.x + reach, mid.y);
		ctx.lineTo(mid.x, mid.y + reach);
		ctx.lineTo(mid.x - reach, mid.y);
		ctx.closePath();
		ctx.fill();
		letter(spawn.kind, cell);
	}
	if (view.start && visible(view.start)) {
		const at = origin(view.start);
		ctx.strokeStyle = colours.start;
		ctx.lineWidth = Math.max(2, size / 8);
		ctx.strokeRect(at.x + 1, at.y + 1, size - 2, size - 2);
		if (glyphs) {
			ctx.fillStyle = colours.start;
			ctx.fillText(glyphOf('ben'), at.x + size / 2, at.y + size / 2);
		}
	}

	ctx.fillStyle = colours.preview;
	for (const cell of options.preview) {
		if (!visible(cell)) continue;
		const at = origin(cell);
		ctx.fillRect(at.x, at.y, size, size);
	}

	if (options.selection) {
		const { x0, y0, x1, y1 } = options.selection;
		const corner = origin({ x: x0, y: y1 });
		ctx.strokeStyle = colours.selection;
		ctx.lineWidth = 2;
		ctx.strokeRect(corner.x, corner.y, (x1 - x0 + 1) * size, (y1 - y0 + 1) * size);
	}

	if (options.cursor) {
		const at = origin(options.cursor);
		ctx.strokeStyle = colours.cursor;
		ctx.lineWidth = 2;
		ctx.strokeRect(at.x + 1, at.y + 1, size - 2, size - 2);
	}
}
