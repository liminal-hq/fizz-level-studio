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
import { enMessages, t, type MessageId } from '../i18n/messages';
import { CommandBridgeContext, NO_FACTS } from '../commands/commandBridge';
import { FloatingPanel } from '../panels/float/FloatingPanel';
import { neighboursOf } from '../panels/float/usePanelLayout';
import { DockShell } from '../panels/dock/DockShell';
import { isLevelFirstKey, isMaximiseKey, isRestoreKey, panelOfNode } from '../panels/dock/dockKeys';
import { PanelExpandButton } from '../panels/dock/PanelExpandButton';
import { PanelCommands } from '../panels/dock/PanelCommands';
import { useDockLayout } from '../panels/dock/useDockLayout';
import {
	floatRectAt,
	locateDropTarget,
	type DropTarget,
	type Point,
} from '../panels/dock/dockDrop';
import { useDockDrag } from '../panels/dock/useDockDrag';
import { ZONE_LABELS } from '../panels/dock/DockZone';
import {
	brushCommandId,
	maximiseCommandId,
	panelCommandId,
	toolCommandId,
} from '../commands/registry';
import { PANEL_SPECS, isExpandable, type PanelId } from '../panels/float/panelSpecs';
import { PanelsMenu } from '../panels/float/PanelsMenu';
import { SnapGuides } from '../panels/float/SnapGuides';
import { useElementSize } from '../panels/float/useElementSize';
import type { Guide } from '../panels/float/snap';
import { historyShortcut } from '../panels/HistoryPanel';
import { usePanelDock } from '../panels/usePanelDock';
import { dockClient as defaultDockClient, type DockClient } from '../services/dockClient';
import type { PanelWindowClient } from '../services/panelWindowClient';
import { BRUSH_GROUPS, brushWords, type Brush } from '../tools/brush';
import { pasteRect } from '../tools/clip';
import { SPACING_KEYS, toolForKey } from '../tools/shortcuts';
import { ToolPalette } from '../tools/ToolPalette';
import { TOOL_IDS, type Cell, type PointerPhase } from '../tools/tool';
import { useTool } from '../tools/useTool';
import { isLevelError, type LevelClient } from '../worlds/levelClient';
import styles from './EditorScreen.module.css';
import { panelContent } from './panelContent';
import { newerSnapshot } from './snapshotRule';

export interface EditorScreenProps {
	/** The level as it was when the screen opened; newer snapshots arrive through the client. */
	snapshot: LevelSnapshot;
	client: LevelClient;
	/** Called with every snapshot the screen takes up, so a parent can follow the level. */
	onSnapshot?: (snapshot: LevelSnapshot) => void;
	/** Opens and closes panel windows; defaults to the app's commands. */
	panelWindows?: PanelWindowClient;
	/** Reads and saves the dock layout; defaults to the settings document. */
	docks?: DockClient;
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
	docks = defaultDockClient,
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
	const windowRef = useRef<HTMLElement>(
		typeof document === 'undefined' ? null : document.documentElement,
	);
	const windowSize = useElementSize(windowRef);
	const dock = useDockLayout(docks, windowSize, area);
	const [guides, setGuides] = useState<Guide[]>([]);
	const [dragNote, setDragNote] = useState('');
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
		setVisible: dock.setVisible,
		reset: dock.reset,
		setTool: tool.setTool,
		setBrush: tool.setBrush,
		showLine,
		levelFirst: dock.toggleLevelFirst,
		maximise: dock.maximise,
		restore: dock.restore,
	});
	live.current = {
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
	};
	const panelsShown = dock.shown;
	const panelsKey = PANEL_SPECS.map((spec) => (panelsShown[spec.id] ? '1' : '0')).join('');
	useEffect(() => {
		if (!bridge) return;
		const handlers: Record<string, (argument?: string) => void> = {
			'edit.undo': () => live.current.undo(),
			'edit.redo': () => live.current.redo(),
			'view.resetLayout': () => live.current.reset(),
			'view.levelFirst': () => live.current.levelFirst(),
		};
		for (const spec of PANEL_SPECS) {
			handlers[panelCommandId(spec.id)] = () =>
				live.current.setVisible(spec.id, !panelsRef.current[spec.id]);
		}
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
				levelFirst: false,
				maximised: null,
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
			levelFirst: dock.session.levelFirst,
			maximised: (dock.session.maximised as PanelId | null) ?? null,
			panels: panelsRef.current,
			brushes,
			lineCount,
		});
	}, [
		bridge,
		snapshot.can_undo,
		snapshot.can_redo,
		panelsKey,
		brushes,
		lineCount,
		dock.session.levelFirst,
		dock.session.maximised,
	]);

	// Tab, on the level or on nothing, shows the level only and brings the panels back.
	const toggleLevelFirst = dock.toggleLevelFirst;
	useEffect(() => {
		const onKey = (event: globalThis.KeyboardEvent) => {
			if (!isLevelFirstKey(event)) return;
			event.preventDefault();
			toggleLevelFirst();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [toggleLevelFirst]);

	// Ctrl+Shift+M maximises the focused expandable panel (else the last one used, else the
	// Script) or restores the maximised one; Escape restores where it is free.
	// While a panel is maximised, Tab (level-first) is ignored: maximising wins.
	const lastPanel = useRef<PanelId>('script');
	const maximised = dock.session.maximised;
	const { maximise, restore } = dock;
	useEffect(() => {
		const note = (event: Event) => {
			const id = panelOfNode(event.target instanceof Element ? event.target : null);
			if (id !== null && isExpandable(id)) lastPanel.current = id as PanelId;
		};
		const onKey = (event: globalThis.KeyboardEvent) => {
			if (isMaximiseKey(event)) {
				event.preventDefault();
				if (maximised !== null) {
					restore();
					return;
				}
				const focused = panelOfNode(
					document.activeElement instanceof Element ? document.activeElement : null,
				);
				maximise(focused !== null && isExpandable(focused) ? focused : lastPanel.current);
			} else if (maximised !== null && isRestoreKey(event)) {
				event.preventDefault();
				restore();
			}
		};
		document.addEventListener('focusin', note);
		document.addEventListener('pointerdown', note);
		window.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('focusin', note);
			document.removeEventListener('pointerdown', note);
			window.removeEventListener('keydown', onKey);
		};
	}, [maximised, maximise, restore]);

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

	const titleOf = (id: string) => {
		const spec = PANEL_SPECS.find((candidate) => candidate.id === id);
		return spec ? t(spec.title) : id;
	};

	// Dragging a panel: the docks and the level are the places it can be let go.
	const dragLive = useRef({ dock, titleOf, area });
	dragLive.current = { dock, titleOf, area };
	const drag = useDockDrag({
		locate: (point: Point, id: string) =>
			areaRef.current ? locateDropTarget(areaRef.current, point, id) : null,
		onDrop: (id: string, target: DropTarget, point: Point) => {
			const { dock: layout, titleOf: nameOf, area: room } = dragLive.current;
			const title = nameOf(id);
			if (target.kind === 'zone') {
				layout.dropOn(id, target.zone, target.group, target.index);
				setDragNote(t('dock.drag.docked', { title, zone: t(ZONE_LABELS[target.zone]) }));
				return;
			}
			const spec = PANEL_SPECS.find((candidate) => candidate.id === id);
			const origin = areaRef.current?.getBoundingClientRect();
			const entry = layout.workspace.panels[id];
			if (!spec || !origin || !entry) return;
			layout.floatAt(
				id,
				floatRectAt(
					point,
					{ x: origin.left, y: origin.top },
					{ w: entry.float.w, h: entry.float.h },
					spec.min,
					room,
				),
			);
			setDragNote(t('dock.drag.floated', { title }));
		},
		onCancel: (id: string) =>
			setDragNote(t('dock.drag.cancelled', { title: dragLive.current.titleOf(id) })),
	});

	const content = (id: PanelId) =>
		panelContent(id, {
			snapshot,
			words,
			brush: tool.brush,
			onBrush: tool.setBrush,
			onObjectChosen,
			showLine,
			undo,
			redo,
			proposals,
			showGhosts,
			onToggleGhosts: setShowGhosts,
			onRefreshProposals: () => setReads((n) => n + 1),
			scriptDock,
			focusLine,
			focusSerial,
		});

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
				<PanelsMenu visible={dock.shown} onToggle={dock.setVisible} onReset={dock.reset} />
			</div>
			<div className={styles.body} ref={areaRef}>
				<DockShell
					view={dock.view}
					window={dock.window}
					session={dock.session}
					titleOf={titleOf}
					renderPanel={(id) => content(id as PanelId)}
					expandable={isExpandable}
					maximised={maximised}
					actions={dock}
					drag={drag}
					announcement={dragNote}
				>
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
				</DockShell>
				{PANEL_SPECS.map((spec) => {
					const view = dock.floating[spec.id];
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
							neighbours={neighboursOf(spec.id, dock.floating)}
							onGuides={setGuides}
							onDockHover={(point) => drag.hoverFloat(spec.id, point)}
							onDockDrop={(point) => drag.dropFloat(spec.id, point)}
							onChange={(rect) => dock.changeFloat(spec.id, rect)}
							onToggleCollapsed={() => dock.toggleFloatCollapsed(spec.id)}
							onRaise={() => dock.raise(spec.id)}
							maximised={maximised === spec.id}
							suppressed={maximised !== null && maximised !== spec.id}
							actions={
								maximised === spec.id ? (
									<PanelExpandButton title={t(spec.title)} expanded onToggle={dock.restore} />
								) : (
									<>
										{spec.expandable && !view.collapsed && (
											<PanelExpandButton
												title={t(spec.title)}
												expanded={false}
												onToggle={() => dock.maximise(spec.id)}
											/>
										)}
										<PanelCommands
											title={t(spec.title)}
											at="float"
											onDock={(zone) => dock.dockTo(spec.id, zone)}
											onFloat={() => {}}
										/>
									</>
								)
							}
						>
							{content(spec.id)}
						</FloatingPanel>
					);
				})}
				<SnapGuides guides={guides} />
			</div>
		</div>
	);
}
