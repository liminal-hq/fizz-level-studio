// The editor's side of the command model: the handlers it runs and the facts it publishes to the bridge
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NO_FACTS, type CommandBridge, type CommandFacts } from '../commands/commandBridge';
import {
	brushCommandId,
	dockBackCommandId,
	WORKSPACE_COMMANDS,
	maximiseCommandId,
	panelCommandId,
	panelDockCommandId,
	panelFloatCommandId,
	tearOffCommandId,
	toolCommandId,
} from '../commands/registry';
import { panelOfNode } from '../panels/dock/dockKeys';
import { ZONE_IDS, zoneOf } from '../panels/dock/dockModel';
import type { useDockLayout } from '../panels/dock/useDockLayout';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import type { usePanelWindows } from '../panels/windows/usePanelWindows';
import { BRUSH_GROUPS, brushWords, type Brush } from '../tools/brush';
import { TOOL_IDS } from '../tools/tool';
import type { useTool } from '../tools/useTool';

export interface EditorCommandsInput {
	/** The bridge the handlers and facts go to. */
	bridge: CommandBridge;
	snapshot: LevelSnapshot;
	words: WordDoc[];
	dock: ReturnType<typeof useDockLayout>;
	windows: ReturnType<typeof usePanelWindows>;
	tool: ReturnType<typeof useTool>;
	undo: () => void;
	redo: () => void;
	showLine: (line: number) => void;
	/** Tears a panel off; the screen's own, which also shows the panel's notice at once. */
	tearOff: (id: PanelId) => void;
}

/**
 * Publishes the editor's actions and facts to the command bridge, so the menus, the palette and the
 * shortcuts can enable, check and run its commands. The handlers always call the latest values.
 */
export function useEditorCommands({
	bridge,
	snapshot,
	words,
	dock,
	windows,
	tool,
	undo,
	redo,
	showLine,
	tearOff,
}: EditorCommandsInput): void {
	// The application menu's Edit and View rows: facts as they are now, and actions that call the latest.
	const latest = {
		undo,
		redo,
		setVisible: dock.setVisible,
		reset: dock.reset,
		setTool: tool.setTool,
		setBrush: tool.setBrush,
		showLine,
		levelFirst: dock.toggleLevelFirst,
		maximise: dock.maximise,
		restore: dock.restore,
		tearOff,
		dockBack: windows.dockBack,
		activate: dock.activate,
		dockTo: dock.dockTo,
		floatPanel: dock.floatPanel,
		switchWorkspace: dock.switchWorkspace,
		away: windows.away,
	};
	const live = useRef(latest);
	live.current = latest;
	// The panel the keyboard focus (or a press) was last in: the Window menu's "focused panel" rows act on it.
	const [focusedPanel, setFocusedPanel] = useState<PanelId | null>(null);
	const focusedRef = useRef(focusedPanel);
	focusedRef.current = focusedPanel;
	useEffect(() => {
		const note = (event: Event) => {
			const id = panelOfNode(event.target instanceof Element ? event.target : null);
			if (id !== null && PANEL_SPECS.some((spec) => spec.id === id)) setFocusedPanel(id as PanelId);
		};
		document.addEventListener('focusin', note);
		document.addEventListener('pointerdown', note);
		return () => {
			document.removeEventListener('focusin', note);
			document.removeEventListener('pointerdown', note);
		};
	}, []);
	const panelsShown = dock.shown;
	const panelsKey = PANEL_SPECS.map((spec) => (panelsShown[spec.id] ? '1' : '0')).join('');
	useEffect(() => {
		const handlers: Record<string, (argument?: string) => void> = {
			'edit.undo': () => live.current.undo(),
			'edit.redo': () => live.current.redo(),
			'view.resetLayout': () => live.current.reset(),
			'view.levelFirst': () => live.current.levelFirst(),
		};
		for (const spec of PANEL_SPECS) {
			handlers[panelCommandId(spec.id)] = () =>
				live.current.setVisible(spec.id, !panelsRef.current[spec.id]);
			handlers[tearOffCommandId(spec.id)] = () => live.current.tearOff(spec.id);
			handlers[dockBackCommandId(spec.id)] = () => live.current.dockBack(spec.id);
			for (const zone of ZONE_IDS) {
				handlers[panelDockCommandId(spec.id, zone)] = () => live.current.dockTo(spec.id, zone);
			}
			handlers[panelFloatCommandId(spec.id)] = () => live.current.floatPanel(spec.id);
		}
		for (const entry of WORKSPACE_COMMANDS) {
			handlers[entry.id] = () => live.current.switchWorkspace(entry.name);
		}
		// The level script's tab: choosing it shows the Script panel (or brings its window forward);
		// closing it hides the panel and never closes the level.
		handlers['script.tab.level.activate'] = () => {
			if (live.current.away.script) return live.current.tearOff('script');
			live.current.setVisible('script', true);
			live.current.activate('script');
		};
		handlers['script.tab.level.close'] = () => live.current.setVisible('script', false);
		handlers['window.floatFocused'] = () => {
			if (focusedRef.current) live.current.floatPanel(focusedRef.current);
		};
		handlers['window.tearOffFocused'] = () => {
			if (focusedRef.current) live.current.tearOff(focusedRef.current);
		};
		handlers['window.dockAllBack'] = () => {
			for (const spec of PANEL_SPECS)
				if (live.current.away[spec.id]) live.current.dockBack(spec.id);
		};
		for (const spec of PANEL_SPECS.filter((candidate) => candidate.expandable)) {
			handlers[maximiseCommandId(spec.id, false)] = () => live.current.maximise(spec.id);
			handlers[maximiseCommandId(spec.id, true)] = () => live.current.restore();
		}
		for (const id of TOOL_IDS) handlers[toolCommandId(id)] = () => live.current.setTool(id);
		// Go to line shows the Script panel if it is hidden, then reveals the line in it.
		handlers['goto.line'] = (argument) => {
			const line = Number(argument);
			if (!Number.isInteger(line) || line < 1) return;
			if (!panelsRef.current.script) live.current.setVisible('script', true);
			live.current.showLine(line);
		};
		const remove = bridge.setHandlers(handlers);
		return () => {
			remove();
			bridge.setFacts({
				editorOpen: false,
				canUndo: false,
				canRedo: false,
				undoName: null,
				redoName: null,
				author: null,
				levelFirst: false,
				maximised: null,
				panels: NO_FACTS.panels,
				away: NO_FACTS.away,
				brushes: NO_FACTS.brushes,
				lineCount: 0,
				brush: null,
				spacing: NO_FACTS.spacing,
				workspace: NO_FACTS.workspace,
				placeOf: NO_FACTS.placeOf,
				focusedPanel: null,
			});
		};
	}, [bridge]);

	// One palette command per brush the Palette panel offers, so the command palette can choose it.
	const brushes = useMemo<Brush[]>(
		() =>
			BRUSH_GROUPS.flatMap((group) =>
				brushWords(group, snapshot.view.palette, words).map((kind) => ({ group, kind })),
			),
		[snapshot.view.palette, words],
	);
	useEffect(() => {
		const handlers: Record<string, () => void> = {};
		for (const brush of brushes) {
			handlers[brushCommandId(brush)] = () => live.current.setBrush(brush);
		}
		return bridge.setHandlers(handlers);
	}, [bridge, brushes]);
	const lineCount = useMemo(() => snapshot.text.split('\n').length, [snapshot.text]);
	const panelsRef = useRef(panelsShown);
	panelsRef.current = panelsShown;
	const placeOf = useMemo(
		() =>
			Object.fromEntries(
				PANEL_SPECS.map((spec) => {
					const entry = dock.workspace.panels[spec.id];
					const place = windows.away[spec.id]
						? 'window'
						: !panelsShown[spec.id] || !entry
							? 'hidden'
							: (zoneOf(dock.workspace, spec.id) ?? 'float');
					return [spec.id, place];
				}),
			) as CommandFacts['placeOf'],
		[dock.workspace, windows.away, panelsKey],
	);
	useEffect(() => {
		bridge.setFacts({
			editorOpen: true,
			canUndo: snapshot.can_undo,
			canRedo: snapshot.can_redo,
			undoName: snapshot.undo_name,
			redoName: snapshot.redo_name,
			author: snapshot.author,
			levelFirst: dock.session.levelFirst,
			maximised: (dock.session.maximised as PanelId | null) ?? null,
			panels: panelsRef.current,
			away: windows.away,
			brushes,
			lineCount,
			brush: tool.brush,
			spacing: tool.spacing,
			workspace: { active: dock.active, names: dock.workspaceNames },
			placeOf,
			focusedPanel,
		});
	}, [
		bridge,
		snapshot.can_undo,
		snapshot.can_redo,
		snapshot.undo_name,
		snapshot.redo_name,
		snapshot.author,
		panelsKey,
		windows.away,
		brushes,
		lineCount,
		dock.session.levelFirst,
		dock.session.maximised,
		tool.brush,
		tool.spacing,
		dock.active,
		dock.workspaceNames,
		placeOf,
		focusedPanel,
	]);
}
