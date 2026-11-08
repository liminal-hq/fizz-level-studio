// Typed messages between the main window and the panels torn off it, over Tauri events
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Rust owns the level, so a torn-off panel reads and edits it through the same commands as the
// main window. State that lives only in the main window's React tree (the tool, the brush, the
// spacing, whether ghosts are drawn, the script line to show) crosses here instead. Every message
// is one envelope on one event, addressed to a window label or to every panel window, and each
// topic has a payload type in `BridgeTopics`, so a new panel (the sprite editor, later) adds a
// topic and nothing else. The envelope is broadcast and filtered by the receiver rather than
// targeted with `emitTo`, so it behaves the same on every platform's webview and a window that has
// not started listening yet simply misses it (the panel window asks again with `hello`).

import { emit, listen } from '@tauri-apps/api/event';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { Brush } from '../../tools/brush';
import type { ThingEditResult, ThingEditSpec } from '../../inspector/thingEdit';
import type { Cell, Thing, ToolId } from '../../tools/tool';

/** The one event every message travels on. */
export const PANEL_BRIDGE_EVENT = 'panel://bridge';

/** The address that reaches every panel window. */
export const EVERY_PANEL = 'panels';

/** What the main window shares with its panel windows about the editor. */
export interface EditorShare {
	/** The level the main window has open, or `null` before one is. */
	levelId: string | null;
	tool: ToolId;
	brush: Brush;
	spacing: number;
	/** Whether Claude's proposals are drawn over the level. */
	ghostsShown: boolean;
	/** A script line to mark; `serial` changes each time one is asked for. */
	focus: { line: number; serial: number } | null;
	/** The ids of the layers hidden on the canvas. */
	hiddenLayers: string[];
	/** What Inspect or the Objects list selected, or null: the Inspector in a window of its own draws it. */
	selectedThing: Thing | null;
}

/** The palette state a panel window may set; the main window applies it through the editor's own setters. */
export interface PaletteChoice {
	tool?: ToolId;
	brush?: Brush;
	spacing?: number;
}

/** Each topic and the payload it carries. */
export interface BridgeTopics {
	/** A panel window to the main window: I am up, send me the editor state. */
	hello: null;
	/** The main window to its panel windows: the editor state as it is now. */
	editor: EditorShare;
	/** A panel window to the main window: the person chose a tool, brush or spacing. */
	'palette/set': PaletteChoice;
	/** A panel window to the main window: the person chose an object, so reveal its cell. */
	'objects/choose': Cell;
	/** A panel window to the main window: the person chose this thing in the Objects list, so select it. */
	'objects/select': Thing;
	/**
	 * A torn-off Inspector to the main window: change the selected thing. The main window applies it
	 * in its own queue, with every other edit, and answers with `inspector/result` and the same
	 * `serial`.
	 */
	'inspector/edit': { serial: number; spec: ThingEditSpec; mergeKey: string };
	/** The main window to the torn-off Inspector: what became of the change with this serial. */
	'inspector/result': { serial: number; result: ThingEditResult };
	/** A torn-off Inspector to the main window: the run of changes is over, so end its undo step. */
	'inspector/endStep': null;
	/** A panel window to the main window: show this script line (from 1). */
	'script/show': { line: number };
	/** A panel window to the main window: show or hide Claude's proposals over the level. */
	'proposals/shown': { shown: boolean };
	/** A panel window to the main window: hide or show these layers on the canvas. */
	'layers/hidden': { hidden: string[] };
	/**
	 * A panel window to the main window: the panel was dragged back and let go over this place in the
	 * dock (a dock, a tab group in it, and the place among its tabs; null is the end). The main
	 * window docks it there, which closes the panel's window.
	 */
	dockBackTo: { panel: string; zone: ZoneId; group: number | null; index: number | null };
	/** A panel window to the main window: the panel being dragged is over this region (null: none), so show where it would land. */
	dockHint: { panel: string; region: string | null };
}

export type BridgeTopic = keyof BridgeTopics;

export interface BridgeEnvelope<K extends BridgeTopic = BridgeTopic> {
	from: string;
	to: string;
	topic: K;
	payload: BridgeTopics[K];
}

/** One window's end of the bridge. */
export interface PanelBridge {
	/** This window's label, the address messages to it carry. */
	readonly label: string;
	/** Sends a message to a window label, or to `EVERY_PANEL`. Never throws. */
	send<K extends BridgeTopic>(to: string, topic: K, payload: BridgeTopics[K]): void;
	/** Hears messages of one topic addressed to this window; returns the unsubscribe. */
	on<K extends BridgeTopic>(
		topic: K,
		handler: (payload: BridgeTopics[K], from: string) => void,
	): () => void;
}

/** True for a value shaped like an envelope. The payload is the topic's handler's to trust. */
export function isEnvelope(value: unknown): value is BridgeEnvelope {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.from === 'string' && typeof v.to === 'string' && typeof v.topic === 'string';
}

/** Whether an envelope is for the window `label`, which is a panel window when `isPanel`. */
export function addressedTo(envelope: BridgeEnvelope, label: string, isPanel: boolean): boolean {
	if (envelope.from === label) return false;
	return envelope.to === label || (isPanel && envelope.to === EVERY_PANEL);
}

/** The bridge over Tauri's events for the window `label`. */
export function createPanelBridge(label: string, isPanel: boolean): PanelBridge {
	return {
		label,
		send(to, topic, payload) {
			const envelope: BridgeEnvelope = { from: label, to, topic, payload } as BridgeEnvelope;
			void emit(PANEL_BRIDGE_EVENT, envelope).catch(() => {});
		},
		on(topic, handler) {
			let stop: (() => void) | null = null;
			let cancelled = false;
			void listen<unknown>(PANEL_BRIDGE_EVENT, (event) => {
				const envelope = event.payload;
				if (!isEnvelope(envelope) || envelope.topic !== topic) return;
				if (!addressedTo(envelope, label, isPanel)) return;
				handler(envelope.payload as never, envelope.from);
			})
				.then((unlisten) => {
					if (cancelled) unlisten();
					else stop = unlisten;
				})
				.catch(() => {});
			return () => {
				cancelled = true;
				stop?.();
			};
		},
	};
}
