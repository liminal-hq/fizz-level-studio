// A hook holding the current tool, brush, item spacing and copied area, and turning pointer events into level edits
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { useCallback, useMemo, useRef, useState } from 'react';
import { clampSpacing, defaultBrush, type Brush } from './brush';
import { copyArea, type Clip } from './clip';
import { spacedCells } from './runs';
import {
	initialToolState,
	reduceTool,
	type Cell,
	type PointerPhase,
	type Rect,
	type ToolId,
	type ToolState,
} from './tool';

export interface ToolHandle {
	tool: ToolId;
	setTool: (tool: ToolId) => void;
	/** What Paint lays down: a tile, an item or an enemy. */
	brush: Brush;
	/** Chooses the brush, and leaves Erase, Pick, Select and Stamp for Paint. */
	setBrush: (brush: Brush) => void;
	/** For an item brush, one item in every `spacing` visited cells (1 to 8). */
	spacing: number;
	setSpacing: (spacing: number) => void;
	/** What Stamp pastes: the area Select outlined when Stamp was chosen. */
	clip: Clip | null;
	/**
	 * Cells a drag has covered so far, for the canvas to outline. For an item brush these are the
	 * spaced cells the stroke will write, not every cell the pointer crossed.
	 */
	preview: readonly Cell[];
	/** Select's rectangle, kept after the drag. */
	selection: Rect | null;
	/**
	 * Feeds one pointer event, in cell coordinates, to the current tool. Returns the edits to send
	 * (empty until a stroke ends) so the caller can apply them as one merge group.
	 */
	pointer: (phase: PointerPhase, cell: Cell) => LevelEdit[];
	/** Like `pointer`, and also the cells an Erase stroke covered when this event ended it. */
	stroke: (phase: PointerPhase, cell: Cell) => { edits: LevelEdit[]; erased: readonly Cell[] };
}

export function useTool(view: LevelView): ToolHandle {
	const [tool, setToolState] = useState<ToolId>('paint');
	const [brushChoice, setBrushChoice] = useState<Brush | null>(null);
	const [spacing, setSpacingState] = useState(1);
	const [clip, setClip] = useState<Clip | null>(null);
	const [toolState, setState] = useState<ToolState>(initialToolState);
	// Pointer events can arrive faster than React renders, so the reducer reads the latest state here.
	const latest = useRef<ToolState>(initialToolState);
	const brush = brushChoice ?? defaultBrush(view);

	const setTool = useCallback(
		(next: ToolId) => {
			latest.current = { ...initialToolState, selection: latest.current.selection };
			setState(latest.current);
			setToolState(next);
			// Choosing Stamp copies what Select outlined; with nothing outlined it keeps its last copy.
			if (next === 'stamp' && latest.current.selection) {
				setClip(copyArea(view, latest.current.selection));
			}
		},
		[view],
	);

	const setBrush = useCallback((next: Brush) => {
		setBrushChoice(next);
		latest.current = { ...initialToolState, selection: latest.current.selection };
		setState(latest.current);
		setToolState('paint');
	}, []);

	const setSpacing = useCallback((next: number) => setSpacingState(clampSpacing(next)), []);

	const stroke = useCallback(
		(phase: PointerPhase, cell: Cell) => {
			const result = reduceTool(tool, latest.current, phase, cell, { view, brush, spacing, clip });
			latest.current = result.state;
			setState(result.state);
			if (result.pick !== null) setBrushChoice(result.pick);
			if (tool === 'pick' && phase === 'up') setToolState('paint');
			return { edits: result.edits, erased: result.erased ?? [] };
		},
		[tool, view, brush, spacing, clip],
	);
	const pointer = useCallback(
		(phase: PointerPhase, cell: Cell): LevelEdit[] => stroke(phase, cell).edits,
		[stroke],
	);

	const preview = useMemo(() => {
		if (!toolState.active) return [];
		if (tool === 'paint' && brush.group === 'item') return spacedCells(toolState.path, spacing);
		if (tool === 'paint' && brush.group === 'enemy') return [];
		return toolState.path;
	}, [toolState, tool, brush.group, spacing]);

	return {
		tool,
		setTool,
		brush,
		setBrush,
		spacing,
		setSpacing,
		clip,
		preview,
		selection: toolState.selection,
		pointer,
		stroke,
	};
}
