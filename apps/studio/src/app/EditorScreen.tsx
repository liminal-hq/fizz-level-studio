// The level editor screen: the canvas, the tools and the panels for one open level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import {
	useCallback,
	useContext,
	useMemo,
	useEffect,
	useRef,
	useState,
	type KeyboardEvent,
} from 'react';
import { LevelCanvas } from '../canvas/LevelCanvas';
import { ObjectList } from '../canvas/ObjectList';
import { enMessages, t, type MessageId } from '../i18n/messages';
import { CommandBridgeContext, NO_FACTS } from '../commands/commandBridge';
import { GhostsPanel } from '../panels/GhostsPanel';
import { FloatingPanel } from '../panels/float/FloatingPanel';
import { neighboursOf, usePanelLayout } from '../panels/float/usePanelLayout';
import { brushCommandId, panelCommandId, toolCommandId } from '../commands/registry';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import { PanelsMenu } from '../panels/float/PanelsMenu';
import { SnapGuides } from '../panels/float/SnapGuides';
import { useElementSize } from '../panels/float/useElementSize';
import type { Guide } from '../panels/float/snap';
import { HistoryPanel, historyShortcut } from '../panels/HistoryPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { ScriptPanel } from '../panels/ScriptPanel';
import { TornOffNotice } from '../panels/TornOffNotice';
import { usePanelDock } from '../panels/usePanelDock';
import { layoutClient as defaultLayoutClient, type LayoutClient } from '../services/layoutClient';
import type { PanelWindowClient } from '../services/panelWindowClient';
import { BRUSH_GROUPS, brushWords, type Brush } from '../tools/brush';
import { pasteRect } from '../tools/clip';
import { SPACING_KEYS, toolForKey } from '../tools/shortcuts';
import { ToolPalette } from '../tools/ToolPalette';
import { TOOL_IDS, type Cell, type PointerPhase } from '../tools/tool';
import { useTool } from '../tools/useTool';
import { isLevelError, type LevelClient } from '../worlds/levelClient';
import styles from './EditorScreen.module.css';
import { newerSnapshot } from './snapshotRule';

export interface EditorScreenProps {
	/** The level as it was when the screen opened; newer snapshots arrive through the client. */
	snapshot: LevelSnapshot;
	client: LevelClient;
	/** Called with every snapshot the screen takes up, so a parent can follow the level. */
	onSnapshot?: (snapshot: LevelSnapshot) => void;
	/** Opens and closes panel windows; defaults to the app's commands. */
	panelWindows?: PanelWindowClient;
	/** Reads and saves where the floating panels sit; defaults to the settings plugin. */
	layouts?: LayoutClient;
}

/** Which panels are shown, as the Panels menu lists them. */
function visibleOf(panels: Record<PanelId, { visible: boolean }>): Record<PanelId, boolean> {
	return Object.fromEntries(
		PANEL_SPECS.map((spec) => [spec.id, panels[spec.id].visible]),
	) as Record<PanelId, boolean>;
}

/** Keys typed into these belong to the control, not to the editor's shortcuts. */
function isTyping(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
}

/**
 * Composes the canvas, tool palette and panels for one level. The latest snapshot lives here; the
 * backend owns the document, so every change goes out through `client` and comes back as a new
 * snapshot. Commands run one at a time, each based on the revision the one before returned.
 */
export function EditorScreen({
	snapshot: initial,
	client,
	onSnapshot,
	panelWindows,
	layouts = defaultLayoutClient,
}: EditorScreenProps) {
	const [snapshot, setSnapshot] = useState(initial);
	const held = useRef(initial);
	const queue = useRef<Promise<void>>(Promise.resolve());
	const strokes = useRef(0);
	const [cursor, setCursor] = useState<Cell>(initial.view.start ?? { x: 0, y: 0 });
	const [focusLine, setFocusLine] = useState<number | null>(null);
	const [focusSerial, setFocusSerial] = useState(0);
	const cellRequests = useRef(0);
	const [problem, setProblem] = useState<MessageId | null>(null);
	const tool = useTool(snapshot.view);
	const [words, setWords] = useState<WordDoc[]>([]);
	const [proposals, setProposals] = useState<GhostProposal[]>([]);
	const [showGhosts, setShowGhosts] = useState(true);
	const levelId = snapshot.id;
	const revision = snapshot.revision;
	const scriptDock = usePanelDock('script', panelWindows);
	const areaRef = useRef<HTMLDivElement>(null);
	const area = useElementSize(areaRef);
	const floating = usePanelLayout(layouts, area);
	const [guides, setGuides] = useState<Guide[]>([]);
	const [reveal, setReveal] = useState<{ cell: Cell; serial: number } | null>(null);

	const follow = useRef(onSnapshot);
	follow.current = onSnapshot;

	const accept = useCallback((incoming: LevelSnapshot) => {
		const kept = newerSnapshot(held.current, incoming);
		if (kept === held.current) return;
		held.current = kept;
		setSnapshot(kept);
		follow.current?.(kept);
	}, []);

	useEffect(() => {
		accept(initial);
	}, [initial, accept]);

	useEffect(() => client.onChanged(accept), [client, accept]);

	// The documented words come from Rust once; they feed the Palette and the Script panel.
	useEffect(() => {
		let current = true;
		client.words().then(
			(found) => current && setWords(found),
			() => current && setWords([]),
		);
		return () => {
			current = false;
		};
	}, [client]);

	// Claude's proposals live in a file the studio is not told about, so they are read again when
	// the level changes and when the person asks.
	const [reads, setReads] = useState(0);
	useEffect(() => {
		let current = true;
		client.ghosts(levelId).then(
			(found) => current && setProposals(found),
			() => current && setProposals([]),
		);
		return () => {
			current = false;
		};
	}, [client, levelId, revision, reads]);
	const ghostCells = useMemo(
		() => (showGhosts ? proposals.flatMap((proposal) => proposal.cells) : undefined),
		[showGhosts, proposals],
	);

	// Commands are chained so each is based on the revision the previous one produced.
	const enqueue = useCallback((run: () => Promise<void>) => {
		queue.current = queue.current.then(async () => {
			try {
				await run();
			} catch (error) {
				setProblem(
					isLevelError(error) && error.kind === 'stale' ? 'editor.stale' : 'editor.failed',
				);
			}
		});
	}, []);

	const sendStroke = useCallback(
		(edits: LevelEdit[]) => {
			const mergeKey = `stroke-${(strokes.current += 1)}`;
			enqueue(async () => {
				setProblem(null);
				for (const edit of edits) {
					const next = await client.applyEdit(
						held.current.id,
						edit,
						held.current.revision,
						mergeKey,
					);
					accept(next);
				}
				accept(await client.endStep(held.current.id));
			});
		},
		[client, accept, enqueue],
	);

	const showLine = useCallback((line: number) => {
		setFocusLine(line);
		setFocusSerial((serial) => serial + 1);
	}, []);

	// Choosing an object in the list, or a cell with Pick or Select, shows the script line that
	// last set the cell. Paint, Erase and Stamp are for drawing, so they leave the script alone.
	const onCellChosen = useCallback(
		(cell: Cell, source: 'grid' | 'list') => {
			if (source === 'grid' && tool.tool !== 'pick' && tool.tool !== 'select') return;
			const request = (cellRequests.current += 1);
			void client
				.cellLine(held.current.id, Math.floor(cell.x), Math.floor(cell.y))
				.then((line) => {
					if (line !== null && request === cellRequests.current) showLine(line);
				})
				.catch(() => {});
		},
		[client, tool.tool, showLine],
	);

	// Choosing an object in the list moves the cursor to it, brings it into view and shows its line.
	const onObjectChosen = useCallback(
		(cell: Cell) => {
			setCursor(cell);
			setReveal((old) => ({ cell, serial: (old?.serial ?? 0) + 1 }));
			onCellChosen(cell, 'list');
		},
		[onCellChosen],
	);

	const onToolEvent = useCallback(
		(phase: PointerPhase, cell: Cell) => {
			const edits = tool.pointer(phase, cell);
			if (edits.length > 0) sendStroke(edits);
		},
		[tool, sendStroke],
	);

	const undo = useCallback(
		() =>
			enqueue(async () => {
				setProblem(null);
				accept(await client.undo(held.current.id, held.current.revision));
			}),
		[client, accept, enqueue],
	);

	const redo = useCallback(
		() =>
			enqueue(async () => {
				setProblem(null);
				accept(await client.redo(held.current.id, held.current.revision));
			}),
		[client, accept, enqueue],
	);

	// The application menu's Edit and View rows: facts as they are now, and actions that call the latest.
	const bridge = useContext(CommandBridgeContext);
	const live = useRef({
		undo,
		redo,
		setVisible: floating.setVisible,
		reset: floating.reset,
		setTool: tool.setTool,
		setBrush: tool.setBrush,
		showLine,
	});
	live.current = {
		undo,
		redo,
		setVisible: floating.setVisible,
		reset: floating.reset,
		setTool: tool.setTool,
		setBrush: tool.setBrush,
		showLine,
	};
	const panelsShown = visibleOf(floating.panels);
	const panelsKey = PANEL_SPECS.map((spec) => (panelsShown[spec.id] ? '1' : '0')).join('');
	useEffect(() => {
		if (!bridge) return;
		const handlers: Record<string, (argument?: string) => void> = {
			'edit.undo': () => live.current.undo(),
			'edit.redo': () => live.current.redo(),
			'view.resetLayout': () => live.current.reset(),
		};
		for (const spec of PANEL_SPECS) {
			handlers[panelCommandId(spec.id)] = () =>
				live.current.setVisible(spec.id, !panelsRef.current[spec.id]);
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
				panels: NO_FACTS.panels,
				brushes: NO_FACTS.brushes,
				lineCount: 0,
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
		if (!bridge) return;
		const handlers: Record<string, () => void> = {};
		for (const brush of brushes) {
			handlers[brushCommandId(brush)] = () => live.current.setBrush(brush);
		}
		return bridge.setHandlers(handlers);
	}, [bridge, brushes]);
	const lineCount = useMemo(() => snapshot.text.split('\n').length, [snapshot.text]);
	const panelsRef = useRef(panelsShown);
	panelsRef.current = panelsShown;
	useEffect(() => {
		bridge?.setFacts({
			editorOpen: true,
			canUndo: snapshot.can_undo,
			canRedo: snapshot.can_redo,
			panels: panelsRef.current,
			brushes,
			lineCount,
		});
	}, [bridge, snapshot.can_undo, snapshot.can_redo, panelsKey, brushes, lineCount]);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (isTyping(event.target)) return;
		const history = historyShortcut(event.nativeEvent);
		if (history) {
			event.preventDefault();
			if (history === 'undo') undo();
			else redo();
			return;
		}
		if (!event.ctrlKey && !event.metaKey && !event.altKey) {
			const step = event.key === SPACING_KEYS.less ? -1 : event.key === SPACING_KEYS.more ? 1 : 0;
			if (step !== 0) {
				event.preventDefault();
				tool.setSpacing(tool.spacing + step);
				return;
			}
		}
		const picked = toolForKey(event.nativeEvent);
		if (picked) {
			event.preventDefault();
			tool.setTool(picked);
		}
	};

	// A banner key the catalogue does not hold shows nothing.
	const noteText =
		snapshot.banner && snapshot.banner in enMessages ? t(snapshot.banner as MessageId) : null;

	const panelContent = (id: PanelId) => {
		switch (id) {
			case 'palette':
				return (
					<PalettePanel
						tiles={snapshot.view.palette}
						words={words}
						brush={tool.brush}
						onBrush={tool.setBrush}
					/>
				);
			case 'objects':
				return (
					<ObjectList view={snapshot.view} onSelectCell={onObjectChosen} onSelectLine={showLine} />
				);
			case 'history':
				return (
					<HistoryPanel
						canUndo={snapshot.can_undo}
						canRedo={snapshot.can_redo}
						undoName={snapshot.undo_name}
						redoName={snapshot.redo_name}
						onUndo={undo}
						onRedo={redo}
					/>
				);
			case 'proposals':
				return (
					<GhostsPanel
						proposals={proposals}
						shown={showGhosts}
						onToggle={setShowGhosts}
						onRefresh={() => setReads((n) => n + 1)}
					/>
				);
			case 'script':
				return scriptDock.tornOff ? (
					<TornOffNotice messageId="panel.scriptTornOff" onDockBack={scriptDock.dockBack} />
				) : (
					<ScriptPanel
						words={words}
						text={snapshot.text}
						diagnostics={snapshot.view.diagnostics}
						focusLine={focusLine}
						focusSerial={focusSerial}
						onTearOff={scriptDock.tearOff}
					/>
				);
		}
	};

	return (
		<div
			className={styles.screen}
			role="group"
			aria-label={t('editor.region')}
			onKeyDown={onKeyDown}
		>
			{snapshot.edited_outside && (
				<p className={styles.banner} role="status">
					{t('editor.editedOutside')}
				</p>
			)}
			{noteText && (
				<p className={styles.banner} role="note">
					{noteText}
				</p>
			)}
			{problem && (
				<p className={styles.error} role="alert">
					{t(problem)}
				</p>
			)}
			<div className={styles.bar}>
				<ToolPalette handle={tool} />
				<PanelsMenu
					visible={visibleOf(floating.panels)}
					onToggle={floating.setVisible}
					onReset={floating.reset}
				/>
			</div>
			<div className={styles.body} ref={areaRef}>
				<div className={styles.canvas}>
					<LevelCanvas
						view={snapshot.view}
						cursor={cursor}
						onCursorChange={setCursor}
						onToolEvent={onToolEvent}
						preview={tool.preview}
						previewShape={tool.tool === 'paint' && tool.brush.group === 'item' ? 'item' : 'cell'}
						paste={tool.tool === 'stamp' && tool.clip ? pasteRect(tool.clip, cursor) : null}
						selection={tool.selection}
						ghosts={ghostCells}
						reveal={reveal}
						onCellChosen={onCellChosen}
					/>
				</div>
				{PANEL_SPECS.map((spec) => {
					const view = floating.panels[spec.id];
					if (!view.visible) return null;
					return (
						<FloatingPanel
							key={spec.id}
							id={spec.id}
							title={t(spec.title)}
							subtitle={spec.id === 'palette' ? tool.brush.kind : undefined}
							rect={view.rect}
							collapsed={view.collapsed}
							z={view.z}
							min={spec.min}
							area={area}
							neighbours={neighboursOf(spec.id, floating.panels)}
							onGuides={setGuides}
							onChange={(rect) => floating.change(spec.id, rect)}
							onToggleCollapsed={() => floating.toggleCollapsed(spec.id)}
							onRaise={() => floating.raise(spec.id)}
						>
							{panelContent(spec.id)}
						</FloatingPanel>
					);
				})}
				<SnapGuides guides={guides} />
			</div>
		</div>
	);
}
