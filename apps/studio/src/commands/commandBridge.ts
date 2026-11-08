// What the application menu reads and runs: the main window's screens publish their facts and actions here
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ToolbarMode } from '@liminal-hq/fizz-studio-protocol/generated/ToolbarMode';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import type { Brush } from '../tools/brush';
import type { MessageId } from '../i18n/messages';
import type { ThingKind, ToolId } from '../tools/tool';

/**
 * What the selection commands need to know about the thing Inspect or Objects selected. `reason`
 * says why the thing cannot be changed, when it cannot.
 */
export interface SelectionFacts {
	/** What is selected, or null. */
	kind: ThingKind | null;
	/** The thing can be moved, turned or deleted (a Fizz 1 item or enemy a hand-written line placed). */
	editable: boolean;
	/** An enemy that has a facing to turn. */
	canFlip: boolean;
	/** An item or enemy that can be deleted: the start and a generated item cannot. */
	canDelete: boolean;
	/** The thing is on a script line the Script panel can show. */
	hasLine: boolean;
	/** Why the thing cannot be changed, as a catalogue message; null while it can. */
	reason: MessageId | null;
}

export const NO_SELECTION: SelectionFacts = {
	kind: null,
	editable: false,
	canFlip: false,
	canDelete: false,
	hasLine: false,
	reason: null,
};

/** What the menu needs to know to enable, disable and check its rows. */
export interface CommandFacts {
	/** A level is open in this window. */
	hasLevel: boolean;
	/** The editor is on screen (it publishes the rest). */
	editorOpen: boolean;
	canUndo: boolean;
	canRedo: boolean;
	/** The name of the step Undo would take back, such as `Paint grass`. */
	undoName: string | null;
	/** The name of the step Redo would do again. */
	redoName: string | null;
	/** Who made the last change or step: `person`, `claude`, `outside` or `recovered`. */
	author: string | null;
	/** Every docked and floating panel is hidden so the level has the room. */
	levelFirst: boolean;
	/** The panel maximised to fill the workspace, if any. */
	maximised: PanelId | null;
	/** Whether each panel is shown. */
	panels: Record<PanelId, boolean>;
	/** Whether each panel is in a window of its own. */
	away: Record<PanelId, boolean>;
	/** The brushes the palette offers (tiles of the open level, items and enemies), for the command palette. */
	brushes: readonly Brush[];
	/** How many lines the open level's script has; Go to line accepts 1 to this. */
	lineCount: number;
	/** The canvas zoom and whether it can still change either way; null until a level canvas publishes it. */
	zoom: { level: number; canIn: boolean; canOut: boolean } | null;
	/** The brush the tools paint with; null with no editor open. */
	brush: Brush | null;
	/** The tool in use; null with no editor open. */
	tool: ToolId | null;
	/** The spacing between painted cells. */
	spacing: number;
	/** The active workspace and the names of all of them. */
	workspace: { active: string; names: readonly string[] };
	/** Where each panel is: a dock, floating over the level, in a window of its own, or hidden. */
	placeOf: Record<PanelId, ZoneId | 'float' | 'window' | 'hidden'>;
	/** The panel the keyboard focus was last in, for the focused-panel commands. */
	focusedPanel: PanelId | null;
	/** The layers that are locked in the open level, by id (the Layers panel publishes them; this app only reads them). */
	locks: readonly string[];
	/** The layers hidden on the canvas in this window, by id (the editor publishes them; they are a view, not saved). */
	hiddenLayers: readonly string[];
	/** The selected thing and what may be done to it. */
	selection: SelectionFacts;
	/** The menu bar is on (the `ui.menu_bar` setting). */
	menuBar: boolean;
	/** The commands row under the menus (the `ui.toolbar` setting). */
	toolbar: ToolbarMode;
	/** The ribbon is folded to its tabs (the `ui.ribbon_folded` setting). */
	ribbonFolded: boolean;
}

/** A record with one entry per panel, so a new panel needs no edit here. */
export function perPanel<T>(value: T): Record<PanelId, T> {
	return Object.fromEntries(PANEL_SPECS.map((spec) => [spec.id, value])) as Record<PanelId, T>;
}

export const NO_FACTS: CommandFacts = {
	hasLevel: false,
	editorOpen: false,
	canUndo: false,
	canRedo: false,
	undoName: null,
	redoName: null,
	author: null,
	levelFirst: false,
	maximised: null,
	panels: perPanel(false),
	away: perPanel(false),
	brushes: [],
	lineCount: 0,
	zoom: null,
	brush: null,
	tool: null,
	spacing: 1,
	workspace: { active: '', names: [] },
	placeOf: perPanel('hidden'),
	focusedPanel: null,
	locks: [],
	hiddenLayers: [],
	selection: NO_SELECTION,
	menuBar: false,
	toolbar: 'classic',
	ribbonFolded: false,
};

/**
 * The actions the screens own, by command id. A command with no handler published cannot run. A
 * command that asks for a value (Go to line) receives it as the argument.
 */
export type CommandHandlers = Readonly<Record<string, (argument?: string) => void>>;

export interface BridgeSnapshot {
	facts: CommandFacts;
	handlers: CommandHandlers;
}

export interface CommandBridge {
	getSnapshot(): BridgeSnapshot;
	subscribe(listener: () => void): () => void;
	/** Merges facts in; nothing changes (and nobody is told) when they are the same as now. */
	setFacts(patch: Partial<CommandFacts>): void;
	/** Adds handlers; the returned function takes those handlers away again. */
	setHandlers(handlers: CommandHandlers): () => void;
}

function samePanels(a: Record<PanelId, boolean>, b: Record<PanelId, boolean>): boolean {
	return (Object.keys(a) as PanelId[]).every((id) => a[id] === b[id]);
}

const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

const sameBrushes = (a: readonly Brush[], b: readonly Brush[]) =>
	a === b ||
	(a.length === b.length &&
		a.every((brush, i) => brush.group === b[i]!.group && brush.kind === b[i]!.kind));

export function createCommandBridge(): CommandBridge {
	let snapshot: BridgeSnapshot = { facts: NO_FACTS, handlers: {} };
	const listeners = new Set<() => void>();
	const set = (next: BridgeSnapshot) => {
		snapshot = next;
		for (const listener of [...listeners]) listener();
	};
	return {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		setFacts(patch) {
			const was = snapshot.facts;
			const next = { ...was, ...patch };
			const same =
				next.hasLevel === was.hasLevel &&
				next.editorOpen === was.editorOpen &&
				next.canUndo === was.canUndo &&
				next.canRedo === was.canRedo &&
				next.undoName === was.undoName &&
				next.redoName === was.redoName &&
				next.author === was.author &&
				next.lineCount === was.lineCount &&
				sameBrushes(next.brushes, was.brushes) &&
				next.levelFirst === was.levelFirst &&
				next.maximised === was.maximised &&
				samePanels(next.panels, was.panels) &&
				samePanels(next.away, was.away) &&
				next.spacing === was.spacing &&
				next.tool === was.tool &&
				next.focusedPanel === was.focusedPanel &&
				next.menuBar === was.menuBar &&
				next.toolbar === was.toolbar &&
				next.ribbonFolded === was.ribbonFolded &&
				sameJson(next.zoom, was.zoom) &&
				sameJson(next.brush, was.brush) &&
				sameJson(next.workspace, was.workspace) &&
				sameJson(next.placeOf, was.placeOf) &&
				sameJson(next.locks, was.locks) &&
				sameJson(next.hiddenLayers, was.hiddenLayers) &&
				sameJson(next.selection, was.selection);
			if (!same) set({ ...snapshot, facts: next });
		},
		setHandlers(handlers) {
			set({ ...snapshot, handlers: { ...snapshot.handlers, ...handlers } });
			return () => {
				const rest = { ...snapshot.handlers };
				for (const id of Object.keys(handlers)) {
					if (rest[id] === handlers[id]) delete rest[id];
				}
				set({ ...snapshot, handlers: rest });
			};
		},
	};
}

/** The main window provides one; a screen rendered without it publishes nowhere. */
export const CommandBridgeContext = createContext<CommandBridge | null>(null);

export function useCommandBridge(): CommandBridge | null {
	return useContext(CommandBridgeContext);
}

const EMPTY: BridgeSnapshot = { facts: NO_FACTS, handlers: {} };
const NEVER = () => () => {};

/** The bridge's current facts and handlers, re-read when a screen publishes. */
export function useBridgeSnapshot(): BridgeSnapshot {
	const bridge = useCommandBridge();
	return useSyncExternalStore(
		bridge ? bridge.subscribe : NEVER,
		bridge ? bridge.getSnapshot : () => EMPTY,
	);
}
