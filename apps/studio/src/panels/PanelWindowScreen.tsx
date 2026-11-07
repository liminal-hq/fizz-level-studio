// The content of a torn-off panel's window: the real panel, fed from Rust and the main window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useMemo } from 'react';
import { AppWindow } from '../app/AppWindow';
import { panelContent } from '../app/panelContent';
import { ownerOfPanel, panelFromLabel } from '../app/windowKind';
import { t } from '../i18n/messages';
import { panelWindowClient, type PanelWindowClient } from '../services/panelWindowClient';
import { PANEL_SPECS } from './float/panelSpecs';
import { createPanelBridge, type PanelBridge } from './windows/panelBridge';
import { usePanelSession } from './windows/usePanelSession';
import { TauriLevelClient } from '../worlds/tauriLevelClient';
import type { LevelClient } from '../worlds/levelClient';
import { isDirty } from '../worlds/tauriLevelClient';
import { ScriptTabStrip } from './script/ScriptTabStrip';
import { LEVEL_TAB, scriptTabsFor } from './script/scriptTabs';
import styles from './PanelWindowScreen.module.css';

export interface PanelWindowScreenProps {
	/** The label Rust gave this window, such as `panel-script-1`. */
	windowLabel: string;
	client?: PanelWindowClient;
	/** The level backend; defaults to the worlds plugin, the client the main window uses. */
	levels?: LevelClient;
	/** The channel to the main window; defaults to the app's events. */
	bridge?: PanelBridge;
}

let sharedLevels: TauriLevelClient | null = null;
function defaultLevels(): LevelClient {
	sharedLevels ??= new TauriLevelClient();
	return sharedLevels;
}

/**
 * A panel's own window: the frame, the real panel, and Dock back, which closes the window and so
 * puts the panel back. The panel reads the level from Rust like the main window does; the choices
 * that belong to the main window (the brush, the object to reveal) are sent over the bridge.
 */
export function PanelWindowScreen({
	windowLabel,
	client = panelWindowClient,
	levels,
	bridge,
}: PanelWindowScreenProps) {
	const panel = panelFromLabel(windowLabel);
	const spec = PANEL_SPECS.find((candidate) => candidate.id === panel);
	if (panel === null || !spec) return null;
	return (
		<PanelWindow
			windowLabel={windowLabel}
			spec={spec}
			client={client}
			levels={levels ?? defaultLevels()}
			bridge={bridge}
		/>
	);
}

interface PanelWindowProps {
	windowLabel: string;
	spec: (typeof PANEL_SPECS)[number];
	client: PanelWindowClient;
	levels: LevelClient;
	bridge: PanelBridge | undefined;
}

function PanelWindow({ windowLabel, spec, client, levels, bridge: given }: PanelWindowProps) {
	const bridge = useMemo(() => given ?? createPanelBridge(windowLabel, true), [given, windowLabel]);
	const owner = ownerOfPanel(windowLabel) ?? 'main-1';
	const session = usePanelSession(windowLabel, bridge, levels);
	const { share, snapshot } = session;
	return (
		<AppWindow titleId={spec.title}>
			<main className={styles.panel}>
				<div className={styles.bar}>
					{spec.id === 'script' && snapshot && (
						// The window holds one script: its one tab. Closing the tab docks the panel back.
						<ScriptTabStrip
							tabs={scriptTabsFor({
								path: snapshot.path,
								dirty: isDirty(snapshot),
								away: false,
							})}
							active={LEVEL_TAB}
							controls="panel-window-body"
							onActivate={() => {}}
							onClose={() => void client.dockBack(spec.id)}
						/>
					)}
					<button
						type="button"
						className={styles.button}
						onClick={() => void client.dockBack(spec.id)}
					>
						{t('panel.dockBack')}
					</button>
				</div>
				<div className={styles.body} id="panel-window-body">
					{share && snapshot ? (
						panelContent(spec.id, {
							snapshot,
							words: session.words,
							brush: share.brush,
							onBrush: (brush) => bridge.send(owner, 'palette/set', { brush }),
							spacing: share.spacing,
							onSpacing: (spacing) => bridge.send(owner, 'palette/set', { spacing }),
							onObjectChosen: (cell) => bridge.send(owner, 'objects/choose', cell),
							showLine: (line) => bridge.send(owner, 'script/show', { line }),
							undo: session.undo,
							redo: session.redo,
							proposals: session.proposals,
							showGhosts: share.ghostsShown,
							onToggleGhosts: (shown) => bridge.send(owner, 'proposals/shown', { shown }),
							onRefreshProposals: session.refreshProposals,
							focusLine: share.focus?.line ?? null,
							focusSerial: share.focus?.serial ?? 0,
							hiddenLayers: share.hiddenLayers,
							onToggleLayer: (id) =>
								bridge.send(owner, 'layers/hidden', {
									hidden: share.hiddenLayers.includes(id)
										? share.hiddenLayers.filter((hidden) => hidden !== id)
										: [...share.hiddenLayers, id],
								}),
							onShowAllLayers: () => bridge.send(owner, 'layers/hidden', { hidden: [] }),
						})
					) : (
						<p className={styles.message}>{t('panelWindow.noLevel')}</p>
					)}
				</div>
			</main>
		</AppWindow>
	);
}
