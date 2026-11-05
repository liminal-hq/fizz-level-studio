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
import { PalettePanel } from '../panels/PalettePanel';
import { ScriptPanel } from '../panels/ScriptPanel';
import { TornOffNotice } from '../panels/TornOffNotice';
import type { PanelDock } from '../panels/usePanelDock';
import type { Brush } from '../tools/brush';
import type { Cell } from '../tools/tool';

export interface PanelContentContext {
	snapshot: LevelSnapshot;
	words: WordDoc[];
	brush: Brush;
	onBrush: (brush: Brush) => void;
	onObjectChosen: (cell: Cell) => void;
	showLine: (line: number) => void;
	undo: () => void;
	redo: () => void;
	proposals: GhostProposal[];
	showGhosts: boolean;
	onToggleGhosts: (shown: boolean) => void;
	onRefreshProposals: () => void;
	scriptDock: PanelDock;
	focusLine: number | null;
	focusSerial: number;
}

/** The content of one panel. */
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
				/>
			);
		case 'objects':
			return (
				<ObjectList
					view={snapshot.view}
					onSelectCell={ctx.onObjectChosen}
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
				/>
			);
		case 'script':
			return ctx.scriptDock.tornOff ? (
				<TornOffNotice messageId="panel.scriptTornOff" onDockBack={ctx.scriptDock.dockBack} />
			) : (
				<ScriptPanel
					words={ctx.words}
					text={snapshot.text}
					diagnostics={snapshot.view.diagnostics}
					focusLine={ctx.focusLine}
					focusSerial={ctx.focusSerial}
					onTearOff={ctx.scriptDock.tearOff}
				/>
			);
	}
}
