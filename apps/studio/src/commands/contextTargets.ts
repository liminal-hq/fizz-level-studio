// What a right-click (or the Menu key) can land on, as plain data the menu model turns into rows
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A surface works out its target (a cell, a row, a header) and hands it to `useContextMenu().open`;
// `buildContextMenu` (contextMenuModel.ts) turns it into the menu's rows. Targets carry only what
// the surface alone knows. Everything else (what is selected, what is locked, the brush) is read
// from the command bridge's facts when the rows are built, so the rows stay current while the menu
// is open.

import type { PanelId } from '../panels/float/panelSpecs';
import type { Brush } from '../tools/brush';
import type { Cell, Thing } from '../tools/tool';

/** Where on a panel the click landed: its header, its button on a dock's rail, or its tab. */
export type PanelContextPlace = 'header' | 'rail' | 'tab';

/** Where in the script editor the click landed: the text, the line numbers or fold gutter, or a hover tooltip. */
export type ScriptContextRegion = 'text' | 'gutter' | 'hover';

/** The commands row that was clicked: the classic toolbar, the ribbon, or the row of menus. */
export type CommandsContextRow = 'toolbar' | 'ribbon' | 'menuBar';

/** What the field being edited allows, read by the surface when the menu opens. */
export interface TextFieldState {
	/** Some text in the field is selected. */
	hasSelection: boolean;
	/** The field holds any text. */
	hasText: boolean;
	/** The field cannot be changed (a read-only or disabled field): Cut, Paste, Undo and Redo are dimmed. */
	readOnly: boolean;
}

/** A cell, tile, item, enemy, start or marker on the level canvas. */
export interface CanvasContextTarget {
	kind: 'canvas';
	/** The cell under the pointer (or the keyboard cursor), inside the level. */
	cell: Cell;
	/**
	 * What the cell holds, topmost first, as `thingAt` reports it: an item, an enemy, the start, or the
	 * cell itself (`kind: 'cell'`, named by its tile word; an exit or a door is a tile too).
	 */
	thing: Thing;
	/** The pointer is inside Select's rectangle, which the right-click keeps. */
	inRect: boolean;
	/**
	 * The script line that last set a tile cell, once `client.cellLine` has answered; null until then.
	 * The surface calls `useContextMenu().update` with the same target and the line when it arrives.
	 * A thing carries its own line in `thing.line`.
	 */
	line: number | null;
}

/** A row of the Objects list: the thing it stands for. */
export interface ObjectRowContextTarget {
	kind: 'objectRow';
	thing: Thing;
}

/** A row of the Layers panel, by the layer's id (`terrain`, `treats`, and so on). */
export interface LayerRowContextTarget {
	kind: 'layerRow';
	layer: string;
}

/** A palette brush (a later change: the contract holds the target so its builder can arrive without one). */
export interface BrushContextTarget {
	kind: 'brush';
	brush: Brush;
}

/** A panel's header, its button on a dock rail, or its tab. */
export interface PanelContextTarget {
	kind: 'panel';
	panel: PanelId;
	where: PanelContextPlace;
}

/** The level script's tab in the Script panel's header. */
export interface ScriptTabContextTarget {
	kind: 'scriptTab';
}

/** The read-only script editor, its line numbers, or a hover tooltip over it. */
export interface ScriptEditorContextTarget {
	kind: 'scriptEditor';
	region: ScriptContextRegion;
	/** Some script text is selected, so Copy can run. */
	hasSelection: boolean;
}

/** The toolbar, the ribbon, or the menu row. */
export interface CommandsRowContextTarget {
	kind: 'commandsRow';
	row: CommandsContextRow;
}

/** The workspace switcher. */
export interface WorkspaceContextTarget {
	kind: 'workspace';
}

/** The zoom pill. */
export interface ZoomContextTarget {
	kind: 'zoom';
}

/** The tool picker (a later change). */
export interface ToolsContextTarget {
	kind: 'tools';
}

/** The History panel. */
export interface HistoryContextTarget {
	kind: 'history';
}

/** A text field: an input, a textarea, or a content-editable (never the script editor). */
export interface TextFieldContextTarget {
	kind: 'textField';
	field: TextFieldState;
}

export type ContextTarget =
	| CanvasContextTarget
	| ObjectRowContextTarget
	| LayerRowContextTarget
	| BrushContextTarget
	| PanelContextTarget
	| ScriptTabContextTarget
	| ScriptEditorContextTarget
	| CommandsRowContextTarget
	| WorkspaceContextTarget
	| ZoomContextTarget
	| ToolsContextTarget
	| HistoryContextTarget
	| TextFieldContextTarget;
