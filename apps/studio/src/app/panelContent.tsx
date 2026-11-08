// What each panel shows: the real panel components, fed from the editor screen's state
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The dock and the floating panels both ask this for a panel's content, so a panel looks and
// behaves the same wherever it sits.

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import type { ReactNode } from 'react';
import { ObjectList } from '../canvas/ObjectList';
import { GhostsPanel } from '../panels/GhostsPanel';
import type { PanelId } from '../panels/float/panelSpecs';
import { HistoryPanel } from '../panels/HistoryPanel';
import { LayersPanel } from '../panels/layers/LayersPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { ScriptPanel } from '../panels/ScriptPanel';
import type { Brush } from '../tools/brush';
import { InspectorPanel } from '../inspector/InspectorPanel';
import type { ThingEditApi } from '../inspector/thingEdit';
import type { Cell, Thing } from '../tools/tool';

export interface PanelContentContext {
	snapshot: LevelSnapshot;
	words: WordDoc[];
	brush: Brush;
	onBrush: (brush: Brush) => void;
	spacing: number;
	onSpacing: (spacing: number) => void;
	onObjectChosen: (cell: Cell) => void;
	/** The thing chosen in the Objects list, to select it. */
	onThingChosen: (thing: Thing) => void;
	/** What Inspect or the Objects list selected, or null. */
	selectedThing: Thing | null;
	/** The script line that last set a cell, for a selected cell. */
	lookupCellLine?: (x: number, y: number) => Promise<number | null>;
	/** Changes the selected thing, for the Inspector. */
	thingEdits?: ThingEditApi;
	showLine: (line: number) => void;
	undo: () => void;
	redo: () => void;
	proposals: GhostProposal[];
	showGhosts: boolean;
	onToggleGhosts: (shown: boolean) => void;
	onRefreshProposals: () => void;
	focusLine: number | null;
	focusSerial: number;
	/** The ids of the layers hidden on the canvas; hiding is this person's view only. */
	hiddenLayers: readonly string[];
	onToggleLayer: (id: string) => void;
	onShowAllLayers: () => void;
	/** The ids of the locked layers, from Rust. */
	lockedLayers: readonly string[];
	onToggleLock: (id: string) => void;
	onUnlockAll: () => void;
}

/**
 * The content of one panel. The main window and a panel's own window both ask this, so a panel
 * looks and behaves the same in either; what differs is the context each passes in.
 */
export function panelContent(id: PanelId, ctx: PanelContentContext): ReactNode {
	const { snapshot } = ctx;
	switch (id) {
		case 'palette':
			return (
				<PalettePanel
					tiles={snapshot.view.palette}
					words={ctx.words}
					brush={ctx.brush}
					onBrush={ctx.onBrush}
					spacing={ctx.spacing}
					onSpacing={ctx.onSpacing}
				/>
			);
		case 'layers':
			return (
				<LayersPanel
					sections={snapshot.view.sections}
					hidden={ctx.hiddenLayers}
					target={snapshot.target}
					onToggleHidden={ctx.onToggleLayer}
					onShowAll={ctx.onShowAllLayers}
					locked={ctx.lockedLayers}
					onToggleLocked={ctx.onToggleLock}
					onUnlockAll={ctx.onUnlockAll}
					onReveal={ctx.showLine}
				/>
			);
		case 'inspector':
			return (
				<InspectorPanel
					snapshot={snapshot}
					thing={ctx.selectedThing}
					words={ctx.words}
					onShowLine={ctx.showLine}
					lookupCellLine={ctx.lookupCellLine}
					edit={ctx.thingEdits}
				/>
			);
		case 'objects':
			return (
				<ObjectList
					view={snapshot.view}
					onSelectCell={ctx.onObjectChosen}
					onSelectThing={ctx.onThingChosen}
					onSelectLine={ctx.showLine}
				/>
			);
		case 'history':
			return (
				<HistoryPanel
					canUndo={snapshot.can_undo}
					canRedo={snapshot.can_redo}
					undoName={snapshot.undo_name}
					redoName={snapshot.redo_name}
					onUndo={ctx.undo}
					onRedo={ctx.redo}
				/>
			);
		case 'proposals':
			return (
				<GhostsPanel
					proposals={ctx.proposals}
					shown={ctx.showGhosts}
					onToggle={ctx.onToggleGhosts}
					onRefresh={ctx.onRefreshProposals}
					locked={ctx.lockedLayers}
				/>
			);
		case 'script':
			return (
				<ScriptPanel
					words={ctx.words}
					text={snapshot.text}
					diagnostics={snapshot.view.diagnostics}
					focusLine={ctx.focusLine}
					focusSerial={ctx.focusSerial}
				/>
			);
	}
}
