// A hook holding the current tool, tile and item, and turning pointer events into level edits
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { useCallback, useRef, useState } from 'react';
import { ITEM_WORDS } from './shortcuts';
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
	/** The tile Paint lays down: the person's choice, else the first palette word that is not empty. */
	tile: string;
	setTile: (tile: string) => void;
	item: string;
	setItem: (item: string) => void;
	/** Cells a paint or erase drag has covered so far, for the canvas to outline. */
	preview: readonly Cell[];
	/** Select's rectangle, kept after the drag. */
	selection: Rect | null;
	/**
	 * Feeds one pointer event, in cell coordinates, to the current tool. Returns the edits to send
	 * (empty until a stroke ends) so the caller can apply them as one merge group.
	 */
	pointer: (phase: PointerPhase, cell: Cell) => LevelEdit[];
}

export function defaultTile(view: LevelView): string {
	return view.palette.find((word) => word !== 'empty') ?? 'fill';
}

export function useTool(view: LevelView): ToolHandle {
	const [tool, setToolState] = useState<ToolId>('paint');
	const [tileChoice, setTile] = useState<string | null>(null);
	const [item, setItem] = useState<string>(ITEM_WORDS[0] ?? 'cheezie');
	const [toolState, setState] = useState<ToolState>(initialToolState);
	// Pointer events can arrive faster than React renders, so the reducer reads the latest state here.
	const latest = useRef<ToolState>(initialToolState);
	const tile = tileChoice ?? defaultTile(view);

	const setTool = useCallback((next: ToolId) => {
		latest.current = { ...initialToolState, selection: latest.current.selection };
		setState(latest.current);
		setToolState(next);
	}, []);

	const pointer = useCallback(
		(phase: PointerPhase, cell: Cell): LevelEdit[] => {
			const result = reduceTool(tool, latest.current, phase, cell, { view, tile, item });
			latest.current = result.state;
			setState(result.state);
			if (result.pick !== null) setTile(result.pick);
			if (tool === 'pick' && phase === 'up') setToolState('paint');
			return result.edits;
		},
		[tool, view, tile, item],
	);

	return {
		tool,
		setTool,
		tile,
		setTile,
		item,
		setItem,
		preview: toolState.active ? toolState.path : [],
		selection: toolState.selection,
		pointer,
	};
}
