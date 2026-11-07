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
import { BRUSH_GROUPS, type Brush } from '../../tools/brush';
import { TOOL_IDS, type Cell } from '../../tools/tool';
import { EVERY_PANEL, type EditorShare, type PaletteChoice, type PanelBridge } from './panelBridge';

/** The editor's own setters, which the panels' choices go through. */
export interface EditorBridgeHandlers {
	setTool(tool: NonNullable<PaletteChoice['tool']>): void;
	setBrush(brush: Brush): void;
	setSpacing(spacing: number): void;
	chooseObject(cell: Cell): void;
	showLine(line: number): void;
	setGhostsShown(shown: boolean): void;
	setHiddenLayers(hidden: string[]): void;
}

function isBrush(value: unknown): value is Brush {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return BRUSH_GROUPS.includes(v.group as Brush['group']) && typeof v.kind === 'string';
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
