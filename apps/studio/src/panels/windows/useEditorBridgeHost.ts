// The main window's end of the panel bridge: shares the editor's state out and applies what panels send back
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A panel in a window of its own has no canvas and no tool state, so it asks (`hello`), hears the
// editor's state whenever it changes, and sends its choices here. Each choice is applied through
// the same setters the in-window panel calls, after a check of its shape: a message is another
// window's word, and a bad one is dropped.

import { useEffect, useRef } from 'react';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { BRUSH_GROUPS, type Brush } from '../../tools/brush';
import { ZONE_IDS } from '../dock/dockModel';
import { PANEL_SPECS, type PanelId } from '../float/panelSpecs';
import type { ThingEditResult, ThingEditSpec } from '../../inspector/thingEdit';
import { TOOL_IDS, type Cell, type Thing } from '../../tools/tool';
import { EVERY_PANEL, type EditorShare, type PaletteChoice, type PanelBridge } from './panelBridge';

/** The editor's own setters, which the panels' choices go through. */
export interface EditorBridgeHandlers {
	setTool(tool: NonNullable<PaletteChoice['tool']>): void;
	setBrush(brush: Brush): void;
	setSpacing(spacing: number): void;
	chooseObject(cell: Cell): void;
	selectThing(thing: Thing): void;
	/** Applies a change a torn-off Inspector asked for, in the editor's own queue. */
	editThing(spec: ThingEditSpec, mergeKey: string): Promise<ThingEditResult>;
	/** Ends the undo step the Inspector's run of changes made. */
	endThingStep(): void;
	showLine(line: number): void;
	setGhostsShown(shown: boolean): void;
	setHiddenLayers(hidden: string[]): void;
	/** A panel window dragged a panel back and let go over a place in the docks. */
	dockBackTo(panel: PanelId, zone: ZoneId, group: number | null, index: number | null): void;
	/** A panel window is dragging a panel over a region of the docks (null: none). */
	dockHint(panel: PanelId, region: string | null): void;
}

function isBrush(value: unknown): value is Brush {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return BRUSH_GROUPS.includes(v.group as Brush['group']) && typeof v.kind === 'string';
}

const isPanelId = (value: unknown): value is PanelId =>
	PANEL_SPECS.some((spec) => spec.id === value);

const isZoneId = (value: unknown): value is ZoneId => ZONE_IDS.includes(value as ZoneId);

const isPlace = (value: unknown): value is number | null =>
	value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0);

function isThingEditSpec(value: unknown): value is ThingEditSpec {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	if (v.op === 'delete') return true;
	if (v.op === 'face') return v.facing === 'left' || v.facing === 'right';
	return v.op === 'move' && isCoordinate(v.x) && (v.y === null || isCoordinate(v.y));
}

const THING_KINDS = ['item', 'enemy', 'start', 'cell'];

function isThing(value: unknown): value is Thing {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		THING_KINDS.includes(v.kind as string) &&
		typeof v.name === 'string' &&
		isCoordinate(v.x) &&
		isCoordinate(v.y) &&
		(v.layer === 'objects' || v.layer === 'tiles') &&
		Number.isInteger(v.index) &&
		(v.index as number) >= 0 &&
		(v.line === null || (Number.isInteger(v.line) && (v.line as number) >= 1))
	);
}

const isCoordinate = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

/**
 * Shares `share` with every panel window while any is `away`, answers a panel that says hello, and
 * applies the panels' messages through `handlers`. Does nothing without a bridge.
 */
export function useEditorBridgeHost(
	bridge: PanelBridge | null,
	share: EditorShare,
	away: boolean,
	handlers: EditorBridgeHandlers,
): void {
	const latest = useRef(share);
	latest.current = share;
	const live = useRef(handlers);
	live.current = handlers;

	useEffect(() => {
		if (!bridge) return;
		const stops = [
			bridge.on('hello', (_none, from) => bridge.send(from, 'editor', latest.current)),
			bridge.on('palette/set', (choice) => {
				if (typeof choice !== 'object' || choice === null) return;
				if (isBrush(choice.brush)) live.current.setBrush(choice.brush);
				if (choice.tool !== undefined && TOOL_IDS.includes(choice.tool)) {
					live.current.setTool(choice.tool);
				}
				if (isCoordinate(choice.spacing)) live.current.setSpacing(choice.spacing);
			}),
			bridge.on('objects/choose', (cell) => {
				if (cell && isCoordinate(cell.x) && isCoordinate(cell.y)) live.current.chooseObject(cell);
			}),
			bridge.on('objects/select', (thing) => {
				if (isThing(thing)) live.current.selectThing(thing);
			}),
			bridge.on('inspector/edit', (message, from) => {
				if (!message || !Number.isInteger(message.serial) || !isThingEditSpec(message.spec)) return;
				if (typeof message.mergeKey !== 'string') return;
				const { serial } = message;
				void live.current.editThing(message.spec, message.mergeKey).then((result) => {
					bridge.send(from, 'inspector/result', { serial, result });
				});
			}),
			bridge.on('inspector/endStep', () => live.current.endThingStep()),
			bridge.on('script/show', (message) => {
				if (message && Number.isInteger(message.line) && message.line >= 1) {
					live.current.showLine(message.line);
				}
			}),
			bridge.on('layers/hidden', (message) => {
				if (message && Array.isArray(message.hidden)) {
					live.current.setHiddenLayers(message.hidden.filter((id) => typeof id === 'string'));
				}
			}),
			bridge.on('dockBackTo', (message) => {
				if (!message || !isPanelId(message.panel) || !isZoneId(message.zone)) return;
				if (!isPlace(message.group) || !isPlace(message.index)) return;
				live.current.dockBackTo(message.panel, message.zone, message.group, message.index);
			}),
			bridge.on('dockHint', (message) => {
				if (!message || !isPanelId(message.panel)) return;
				if (message.region !== null && typeof message.region !== 'string') return;
				live.current.dockHint(message.panel, message.region);
			}),
			bridge.on('proposals/shown', (message) => {
				if (message && typeof message.shown === 'boolean') {
					live.current.setGhostsShown(message.shown);
				}
			}),
		];
		return () => stops.forEach((stop) => stop());
	}, [bridge]);

	useEffect(() => {
		if (bridge && away) bridge.send(EVERY_PANEL, 'editor', share);
	}, [bridge, away, share]);
}
