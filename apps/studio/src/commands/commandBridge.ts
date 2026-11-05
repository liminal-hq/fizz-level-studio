// What the application menu reads and runs: the main window's screens publish their facts and actions here
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { PanelId } from '../panels/float/panelSpecs';
import type { Brush } from '../tools/brush';

/** What the menu needs to know to enable, disable and check its rows. */
export interface CommandFacts {
	/** A level is open in this window. */
	hasLevel: boolean;
	/** The editor is on screen (it publishes the rest). */
	editorOpen: boolean;
	canUndo: boolean;
	canRedo: boolean;
	/** Every docked and floating panel is hidden so the level has the room. */
	levelFirst: boolean;
	/** Whether each panel is shown. */
	panels: Record<PanelId, boolean>;
	/** The brushes the palette offers (tiles of the open level, items and enemies), for the command palette. */
	brushes: readonly Brush[];
	/** How many lines the open level's script has; Go to line accepts 1 to this. */
	lineCount: number;
}

export const NO_FACTS: CommandFacts = {
	hasLevel: false,
	editorOpen: false,
	canUndo: false,
	canRedo: false,
	levelFirst: false,
	panels: { palette: false, objects: false, history: false, proposals: false, script: false },
	brushes: [],
	lineCount: 0,
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

function samePanels(a: CommandFacts['panels'], b: CommandFacts['panels']): boolean {
	return (Object.keys(a) as PanelId[]).every((id) => a[id] === b[id]);
}

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
				next.lineCount === was.lineCount &&
				sameBrushes(next.brushes, was.brushes) &&
				next.levelFirst === was.levelFirst &&
				samePanels(next.panels, was.panels);
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
