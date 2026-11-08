// The level editor screen: the canvas, the tools and the panels for one open level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import {
	useCallback,
	useContext,
	useMemo,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
	type KeyboardEvent,
} from 'react';
import { LevelCanvas } from '../canvas/LevelCanvas';
import type { ZoomKind } from '../canvas/ZoomControl';
import { enMessages, t, type MessageId } from '../i18n/messages';
import { FloatingPanel } from '../panels/float/FloatingPanel';
import { neighboursOf } from '../panels/float/usePanelLayout';
import { DockShell } from '../panels/dock/DockShell';
import { isLevelFirstKey, isMaximiseKey, isRestoreKey, panelOfNode } from '../panels/dock/dockKeys';
import { PanelExpandButton } from '../panels/dock/PanelExpandButton';
import type { RailPlaceholders } from '../panels/dock/railPlaceholders';
import { ScriptTabStrip } from '../panels/script/ScriptTabStrip';
import { LEVEL_TAB, scriptTabsFor } from '../panels/script/scriptTabs';
import { isDirty } from '../worlds/tauriLevelClient';
import type { HeaderWidth } from '../panels/dock/DockZone';
import { PanelMenuButton } from '../panels/dock/PanelMenuButton';
import { useDockLayout } from '../panels/dock/useDockLayout';
import {
	floatRectAt,
	locateDropTarget,
	type DropTarget,
	type Point,
} from '../panels/dock/dockDrop';
import { useDockDrag } from '../panels/dock/useDockDrag';
import { useTearOffDrag } from '../panels/windows/useTearOffDrag';
import type { TearoffClient } from '../services/tearoffClient';
import { ZONE_LABELS } from '../panels/dock/DockZone';
import { useLayerLocks } from '../panels/layers/useLayerLocks';
import { lockedProblem } from '../panels/layers/lockedNote';
import { useMaskedView } from '../panels/layers/useMaskedView';
import { cellLayers, layersView, stillHidden } from '../panels/layers/layersView';
import { PANEL_SPECS, isExpandable, type PanelId } from '../panels/float/panelSpecs';
import { SnapGuides } from '../panels/float/SnapGuides';
import { useElementSize } from '../panels/float/useElementSize';
import type { Guide } from '../panels/float/snap';
import { historyShortcut } from '../panels/HistoryPanel';
import { TornOffNotice } from '../panels/TornOffNotice';
import { withAwayTabs } from '../panels/windows/awayTabs';
import { type EditorShare, type PanelBridge } from '../panels/windows/panelBridge';
import { useEditorBridgeHost } from '../panels/windows/useEditorBridgeHost';
import { usePanelWindows } from '../panels/windows/usePanelWindows';
import { dockInsets } from '../panels/dock/dockGeometry';
import { zoneOf } from '../panels/dock/dockModel';
import { visibleWorkspace } from '../panels/dock/dockView';
import { dockClient as defaultDockClient, type DockClient } from '../services/dockClient';
import type { PanelWindowClient } from '../services/panelWindowClient';
import { pasteRect } from '../tools/clip';
import { SPACING_KEYS, toolForKey } from '../tools/shortcuts';
import { ToolPicker } from '../tools/ToolPicker';
import { resolveThing } from '../inspector/resolveThing';
import { thingRef } from '../inspector/thingRef';
import {
	buildEdit,
	editProblem,
	type ThingEditApi,
	type ThingEditResult,
	type ThingEditSource,
} from '../inspector/thingEdit';
import type { Nudge } from '../commands/selectionCommands';
import { entryOf, selectionFacts } from '../inspector/selectionFacts';
import {
	spawnCell,
	thingAt,
	thingsOnCells,
	type Cell,
	type PointerPhase,
	type Thing,
} from '../tools/tool';
import { useTool } from '../tools/useTool';
import { isLevelError, type LevelClient } from '../worlds/levelClient';
import styles from './EditorScreen.module.css';
import { panelContent } from './panelContent';
import { useEditorCommands } from './useEditorCommands';
import { panelMenuItems } from '../commands/panelMenuModel';
import {
	CommandBridgeContext,
	createCommandBridge,
	type BridgeSnapshot,
	type CommandFacts,
} from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
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
	/** The channel to the panels torn off into their own windows; without one they get no state. */
	panelBridge?: PanelBridge;
	/** The tear-off plugin, for dragging a panel out into a window and back; without it a drag stays in the window. */
	tearoff?: TearoffClient;
}

/** The command each button of the zoom control runs. */
const ZOOM_COMMANDS: Record<ZoomKind, string> = {
	in: 'view.zoomIn',
	out: 'view.zoomOut',
	fit: 'view.zoomFit',
};

/** Assets is drawn on the left rail, dimmed, until it is built. */
const railPlaceholders = (): RailPlaceholders => ({
	left: [{ id: 'assets', title: t('dock.assets'), icon: 'assets', reason: t('dock.assets.later') }],
});

/** A panel's ⋮ menu: its rows, and choosing one runs that command through the registry. */
function menuOf(id: PanelId, snapshot: BridgeSnapshot) {
	return {
		items: panelMenuItems(id, snapshot),
		onSelect: (item: { id: string }) => void runCommand(item.id, snapshot),
	};
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
	panelBridge,
	tearoff,
}: EditorScreenProps) {
	const [snapshot, setSnapshot] = useState(initial);
	const held = useRef(initial);
	const queue = useRef<Promise<void>>(Promise.resolve());
	const strokes = useRef(0);
	const [cursor, setCursor] = useState<Cell>(initial.view.start ?? { x: 0, y: 0 });
	const [focusLine, setFocusLine] = useState<number | null>(null);
	const [focusSerial, setFocusSerial] = useState(0);
	const cellRequests = useRef(0);
	const [problem, setProblem] = useState<{
		id: MessageId;
		values?: Record<string, string | number>;
	} | null>(null);
	const tool = useTool(snapshot.view);
	// What Inspect selected. It lives here, above the tool, so it outlasts a change of tool, never
	// touches Select's rectangle, and the canvas, the objects list and the inspector read one value.
	const [selectedThing, setSelectedThing] = useState<Thing | null>(null);
	// Set when the selected thing went away under the person (an outside edit), until they choose again.
	const [selectionLost, setSelectionLost] = useState(false);
	// The word of the thing deleted last, until the person selects something again.
	const [deletedName, setDeletedName] = useState<string | null>(null);
	const [words, setWords] = useState<WordDoc[]>([]);
	const [proposals, setProposals] = useState<GhostProposal[]>([]);
	const [showGhosts, setShowGhosts] = useState(true);
	// The layers the person hid on the canvas: this window's view only, never saved or sent to Rust.
	const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
	const levelId = snapshot.id;
	// Which layers are locked is Rust's to say; this only follows it and asks it to change.
	const layerLocks = useLayerLocks(client, levelId);
	const lockFailures = layerLocks.failures;
	useEffect(() => {
		if (lockFailures > 0) setProblem({ id: 'layers.lockFailed' });
	}, [lockFailures]);
	const revision = snapshot.revision;
	const areaRef = useRef<HTMLDivElement>(null);
	const area = useElementSize(areaRef);
	const windowRef = useRef<HTMLElement>(
		typeof document === 'undefined' ? null : document.documentElement,
	);
	const windowSize = useElementSize(windowRef);
	const dock = useDockLayout(docks, windowSize, area);
	const windows = usePanelWindows(dock, panelWindows);
	// The main window provides the command bridge. A screen drawn without one (a test, the webview
	// served alone) keeps its own, so its panel menus still list and run the same commands.
	const parentBridge = useContext(CommandBridgeContext);
	const [ownBridge] = useState(() => (parentBridge ? null : createCommandBridge()));
	const bridge = parentBridge ?? ownBridge!;
	const commands = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot);
	const panelMenu = (id: string) => menuOf(id as PanelId, commands);
	const anyAway = Object.values(windows.away).some(Boolean);
	// An away panel's tab cannot be made the showing tab in the saved arrangement (the panel is in
	// no zone), so which away tabs show is kept here; tearing a panel off shows its notice at once.
	const [shownAway, setShownAway] = useState<string[]>([]);
	const dockView = useMemo(
		() => visibleWorkspace(withAwayTabs(dock.workspace, shownAway), dock.session.levelFirst),
		[dock.workspace, dock.session.levelFirst, shownAway],
	);
	// The level spans the dock shell and the docks lie over its edges; the canvas keeps the level in
	// what they leave uncovered.
	const insets = useMemo(() => dockInsets(dockView, dock.window), [dockView, dock.window]);
	const activateTab = (id: string) => {
		if (windows.away[id as PanelId]) {
			setShownAway((was) => (was.includes(id) ? was : [...was, id]));
			return;
		}
		const zone = zoneOf(dock.workspace, id);
		setShownAway((was) => was.filter((away) => dock.workspace.panels[away]?.home !== zone));
		dock.activate(id);
	};
	const tearOffPanel = (id: string) => {
		setShownAway((was) => (was.includes(id) ? was : [...was, id]));
		windows.tearOff(id as PanelId);
	};
	const [guides, setGuides] = useState<Guide[]>([]);
	// The canvas zoom for the zoom commands: what it last reported, and the zoom they last asked for.
	const [zoom, setZoom] = useState<CommandFacts['zoom']>(null);
	const [zoomRequest, setZoomRequest] = useState<{ kind: ZoomKind; serial: number } | null>(null);
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
				if (isLevelError(error) && error.kind === 'locked') {
					setProblem(lockedProblem(error.layers, held.current.view.sections));
				} else {
					setProblem({
						id: isLevelError(error) && error.kind === 'stale' ? 'editor.stale' : 'editor.failed',
					});
				}
			}
		});
	}, []);

	// A stroke is one merge group and so one undo step. An Erase stroke carries the things on the cells
	// it covered: they are deleted after its clears, under the same key, from the level as the queue
	// finds it, highest index first so the deletes do not move one another.
	const sendStroke = useCallback(
		(edits: LevelEdit[], doomed: readonly Thing[] = []) => {
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
				for (const target of doomed) {
					const snap = held.current;
					const thing = resolveThing(target, snap.view);
					const ref = thing ? thingRef(snap.view, snap.text, thing) : null;
					if (!ref) continue;
					if (selectedNow.current && thing && sameThing(selectedNow.current, thing)) {
						selectedNow.current = null;
						setSelectedThing(null);
					}
					accept(
						await client.applyEdit(
							snap.id,
							buildEdit({ op: 'delete' }, ref),
							snap.revision,
							mergeKey,
						),
					);
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

	// Inspect selects the topmost thing on the pressed cell (null outside the level) and edits nothing.
	const levelView = snapshot.view;
	// The canvas draws the level without the things of the layers the person hid.
	const hiddenNow = useMemo(
		() => stillHidden(levelView.sections, hiddenLayers),
		[levelView.sections, hiddenLayers],
	);
	// Hiding tiles asks Rust for the level run without those layers; hiding things filters it here.
	const maskedView = useMaskedView(
		client,
		levelId,
		snapshot.revision,
		cellLayers(levelView.sections, hiddenNow),
	);
	const shownView = useMemo(
		() => layersView(maskedView ?? levelView, hiddenNow),
		[maskedView, levelView, hiddenNow],
	);
	const onToolEvent = useCallback(
		(phase: PointerPhase, cell: Cell) => {
			if (tool.tool === 'inspect') {
				if (phase === 'down') {
					setSelectionLost(false);
					setDeletedName(null);
					setSelectedThing(thingAt(shownView, cell, levelView));
				}
				return;
			}
			const { edits, erased } = tool.stroke(phase, cell);
			// Erase also removes the items and enemies on the cells it covered (a Fizz 1 level only).
			const doomed =
				erased.length > 0 && snapshot.target === 'fizz1'
					? thingsOnCells(shownView, erased, levelView)
					: [];
			if (edits.length > 0) sendStroke(edits, doomed);
		},
		[tool, sendStroke, shownView, levelView, snapshot.target],
	);
	const inspected = useMemo(
		() => (selectedThing ? { x: selectedThing.x, y: selectedThing.y } : null),
		[selectedThing],
	);
	// The Inspector's changes go through the same queue as every other edit, tied to the revision
	// and the thing as they are when the turn comes, and a refusal goes back to the Inspector to show.
	const applyThingEdit = useCallback(
		(source: ThingEditSource, mergeKey: string) =>
			new Promise<ThingEditResult>((resolve) => {
				queue.current = queue.current.then(async () => {
					const snap = held.current;
					const prev = selectedNow.current;
					const thing = prev ? resolveThing(prev, snap.view) : null;
					const ref = thing ? thingRef(snap.view, snap.text, thing) : null;
					if (!ref || !thing) {
						resolve({ ok: false, problem: { id: 'inspector.gone' } });
						return;
					}
					// A change worked out from the level as the queue finds it (a nudge, a flip) may find
					// there is nothing to do.
					const spec = typeof source === 'function' ? source(snap.view, thing) : source;
					if (!spec) {
						resolve({ ok: true });
						return;
					}
					try {
						accept(await client.applyEdit(snap.id, buildEdit(spec, ref), snap.revision, mergeKey));
						if (spec.op === 'delete') {
							selectedNow.current = null;
							setSelectedThing(null);
							setDeletedName(thing.name);
						} else if (spec.op === 'move') {
							// The thing keeps its place in the level's lists, so it is the same entry on its new
							// cell; saying so here keeps the selection exact when another thing shares the old one.
							const moved = {
								...thing,
								x: Math.floor(spec.x),
								y: Math.floor(spec.y ?? entryRowAfter(held.current.view, thing)),
							};
							selectedNow.current = moved;
							setSelectedThing(moved);
						}
						resolve({ ok: true });
					} catch (error) {
						resolve({ ok: false, problem: editProblem(error, held.current.view.sections) });
					}
				});
			}),
		[client, accept],
	);
	const endThingStep = useCallback(
		() =>
			enqueue(async () => {
				accept(await client.endStep(held.current.id));
			}),
		[client, accept, enqueue],
	);
	const thingEdits = useMemo<ThingEditApi>(
		() => ({ apply: applyThingEdit, endStep: endThingStep }),
		[applyThingEdit, endThingStep],
	);
	// The selection commands: what the keys, the menus and the ribbon run on the selected thing. A
	// refusal has no Inspector under it here, so it is shown as the screen's own problem.
	const showProblem = useCallback((result: ThingEditResult) => {
		if (result.ok) return;
		setProblem('id' in result.problem ? result.problem : { id: 'editor.failed' });
	}, []);
	const nudgeRun = useRef({ burst: 0, running: false, timer: 0 });
	const endNudgeRun = useCallback(() => {
		window.clearTimeout(nudgeRun.current.timer);
		if (!nudgeRun.current.running) return;
		nudgeRun.current.running = false;
		nudgeRun.current.burst += 1;
		endThingStep();
	}, [endThingStep]);
	const nudge = useCallback(
		(way: Nudge) => {
			// Worked out when the edit's turn comes, so a quick run of presses counts on from the last.
			const step: ThingEditSource = (view, thing) => {
				const entry = entryOf(view, thing);
				if (!entry || thing.kind === 'cell') return null;
				const dx = way === 'left' ? -1 : way === 'right' ? 1 : 0;
				const dy = way === 'down' ? -1 : way === 'up' ? 1 : 0;
				const spawn = thing.kind === 'enemy' ? view.spawns[thing.index] : undefined;
				const row = spawn ? spawnCell(view, spawn).y : (entry.y ?? 0);
				const x = Math.min(Math.max(entry.x + dx, 0), view.width - 1);
				const y = Math.min(Math.max(row + dy, 0), view.height - 1);
				if (dx !== 0 ? x === entry.x : y === row) return null;
				// An enemy on the ground stays on it until it is moved up or down, which pins it.
				return { op: 'move', x, y: spawn && dy === 0 ? spawn.y : y };
			};
			const selected = selectedNow.current;
			if (!selected) return;
			nudgeRun.current.running = true;
			window.clearTimeout(nudgeRun.current.timer);
			nudgeRun.current.timer = window.setTimeout(endNudgeRun, NUDGE_RUN_MS);
			const key = `nudge:${selected.kind}:${selected.index}:${nudgeRun.current.burst}`;
			void applyThingEdit(step, key).then(showProblem);
		},
		[applyThingEdit, endNudgeRun, showProblem],
	);
	// A run of nudges ends when another thing is selected or the editor goes away.
	const selectedIdentity = selectedThing ? `${selectedThing.kind}:${selectedThing.index}` : null;
	useEffect(() => endNudgeRun, [selectedIdentity, endNudgeRun]);
	const oneShot = useRef(0);
	const flip = useCallback(() => {
		const turn: ThingEditSource = (view, thing) => {
			const spawn = thing.kind === 'enemy' ? view.spawns[thing.index] : undefined;
			if (!spawn || spawn.ride) return null;
			return { op: 'face', facing: spawn.dir !== null && spawn.dir > 0 ? 'left' : 'right' };
		};
		void applyThingEdit(turn, `flip:${(oneShot.current += 1)}`).then(showProblem);
	}, [applyThingEdit, showProblem]);
	const deleteSelected = useCallback(
		() =>
			void applyThingEdit({ op: 'delete' }, `delete:${(oneShot.current += 1)}`).then(showProblem),
		[applyThingEdit, showProblem],
	);
	const showSelectedLine = useCallback(() => {
		const prev = selectedNow.current;
		const entry = prev ? entryOf(held.current.view, prev) : null;
		if (entry && entry.line !== null) showLine(entry.line);
	}, [showLine]);
	const selection = useMemo(
		() => ({
			facts: selectionFacts(snapshot, selectedThing),
			delete: deleteSelected,
			flip,
			nudge,
			showInScript: showSelectedLine,
		}),
		[snapshot, selectedThing, deleteSelected, flip, nudge, showSelectedLine],
	);
	const lookupCellLine = useCallback(
		(x: number, y: number) => client.cellLine(held.current.id, x, y),
		[client],
	);
	const clearInspected = useCallback(() => {
		setSelectionLost(false);
		setSelectedThing(null);
	}, []);
	const chooseThing = useCallback((thing: Thing) => {
		setSelectionLost(false);
		setDeletedName(null);
		setSelectedThing(thing);
	}, []);
	// The level changed (an edit of the person's, or one from outside): the selected thing follows
	// its entry, or is let go with a note when it is no longer in the level.
	const selectedNow = useRef(selectedThing);
	selectedNow.current = selectedThing;
	// Undo and Redo bring an earlier text back, so the thing is taken by its place in the list.
	const afterHistory = useRef(false);
	useEffect(() => {
		const prev = selectedNow.current;
		if (!prev) return;
		const lenient = afterHistory.current;
		afterHistory.current = false;
		const next = resolveThing(prev, levelView, lenient);
		if (next === prev) return;
		setSelectedThing(next);
		if (next === null) setSelectionLost(true);
	}, [levelView]);

	const undo = useCallback(
		() =>
			enqueue(async () => {
				setProblem(null);
				afterHistory.current = true;
				accept(await client.undo(held.current.id, held.current.revision));
			}),
		[client, accept, enqueue],
	);

	const redo = useCallback(
		() =>
			enqueue(async () => {
				setProblem(null);
				afterHistory.current = true;
				accept(await client.redo(held.current.id, held.current.revision));
			}),
		[client, accept, enqueue],
	);

	useEditorCommands({
		bridge,
		snapshot,
		words,
		dock,
		windows,
		tool,
		undo,
		redo,
		showLine,
		selection,
		tearOff: tearOffPanel,
		zoom,
		onZoom: (kind) => setZoomRequest((old) => ({ kind, serial: (old?.serial ?? 0) + 1 })),
		layers: {
			locked: layerLocks.locked,
			hidden: hiddenLayers,
			showAll: () => setHiddenLayers([]),
			unlockAll: layerLocks.unlockAll,
		},
	});

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
	// Out of the window and back: the tear-off drag's side of the docks. Its hint is shown through the
	// drag controller, which is made next.
	const hoverRef = useRef<(id: string, point: Point | null) => void>(() => {});
	const tearDrag = useTearOffDrag({
		client: tearoff,
		areaRef,
		dock,
		windows,
		titleOf,
		hover: (id, point) => hoverRef.current(id, point),
		say: setDragNote,
	});
	const drag = useDockDrag({
		onLeaveWindow: tearDrag.onLeaveWindow,
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

	hoverRef.current = drag.hoverFloat;

	// A panel in a window of its own keeps its tab and its place; its content is the notice.
	const tabTitleOf = (id: string) =>
		windows.away[id as PanelId] ? t('panel.awayTitle', { title: titleOf(id) }) : titleOf(id);

	const brushGroup = tool.brush.group;
	const brushKind = tool.brush.kind;
	const share = useMemo<EditorShare>(
		() => ({
			levelId,
			tool: tool.tool,
			brush: { group: brushGroup, kind: brushKind },
			spacing: tool.spacing,
			ghostsShown: showGhosts,
			focus: focusLine === null ? null : { line: focusLine, serial: focusSerial },
			hiddenLayers,
			selectedThing,
			deletedName,
		}),
		[
			levelId,
			tool.tool,
			brushGroup,
			brushKind,
			tool.spacing,
			showGhosts,
			focusLine,
			focusSerial,
			hiddenLayers,
			selectedThing,
			deletedName,
		],
	);
	useEditorBridgeHost(panelBridge ?? null, share, anyAway, {
		setTool: tool.setTool,
		setBrush: tool.setBrush,
		setSpacing: tool.setSpacing,
		chooseObject: onObjectChosen,
		selectThing: chooseThing,
		editThing: applyThingEdit,
		endThingStep,
		showLine,
		setGhostsShown: setShowGhosts,
		setHiddenLayers,
		dockBackTo: tearDrag.dockBackTo,
		dockHint: tearDrag.dockHint,
	});

	// A panel in a window of its own cannot be dragged in the main window; its tab only docks it
	// elsewhere through the Dock buttons.
	const dragFromHere = {
		...drag,
		begin: (...args: Parameters<typeof drag.begin>) => {
			if (!windows.away[args[1] as PanelId]) drag.begin(...args);
		},
	};

	// The Script panel's header holds its tabs: the level's script (the only one until Fizz 2), marked
	// when it is open in a window of its own. Closing the tab hides the panel and never closes the level.
	const scriptTabs = scriptTabsFor({
		path: snapshot.path,
		dirty: isDirty(snapshot),
		away: windows.away.script,
	});
	function headerExtra(id: string, width: HeaderWidth) {
		if (id !== 'script') return null;
		return (
			<ScriptTabStrip
				tabs={scriptTabs}
				active={LEVEL_TAB}
				narrow={width === 'narrow'}
				controls="panel-body-script"
				onActivate={() => (windows.away.script ? tearOffPanel('script') : dock.activate('script'))}
				onClose={() => dock.setVisible('script', false)}
				onTabDragStart={(event) => dragFromHere.begin(event, 'script', 'scriptTab')}
			/>
		);
	}

	const content = (id: PanelId) =>
		windows.away[id] ? (
			<TornOffNotice title={titleOf(id)} onDockBack={() => windows.dockBack(id)} />
		) : (
			panelContent(id, {
				snapshot,
				words,
				brush: tool.brush,
				onBrush: tool.setBrush,
				spacing: tool.spacing,
				onSpacing: tool.setSpacing,
				onObjectChosen,
				onThingChosen: chooseThing,
				selectedThing,
				lookupCellLine,
				thingEdits,
				deletedName,
				showLine,
				undo,
				redo,
				proposals,
				showGhosts,
				onToggleGhosts: setShowGhosts,
				onRefreshProposals: () => setReads((n) => n + 1),
				focusLine,
				focusSerial,
				hiddenLayers,
				onToggleLayer: (id) =>
					setHiddenLayers((was) =>
						was.includes(id) ? was.filter((hidden) => hidden !== id) : [...was, id],
					),
				onShowAllLayers: () => setHiddenLayers([]),
				lockedLayers: layerLocks.locked,
				onToggleLock: layerLocks.toggle,
				onUnlockAll: layerLocks.unlockAll,
			})
		);

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
			{selectionLost && (
				<p className={styles.banner} role="status">
					{t('selection.lost')}
				</p>
			)}
			{problem && (
				<p className={styles.error} role="alert">
					{t(problem.id, problem.values)}
				</p>
			)}
			<div className={styles.body} ref={areaRef}>
				<DockShell
					view={dockView}
					window={dock.window}
					session={dock.session}
					titleOf={tabTitleOf}
					renderPanel={(id) => content(id as PanelId)}
					expandable={(id) => isExpandable(id) && !windows.away[id as PanelId]}
					maximised={maximised}
					actions={{
						...dock,
						activate: activateTab,
						chooseAway: (id) => {
							if (!windows.away[id as PanelId]) return false;
							windows.dockBack(id as PanelId);
							return true;
						},
					}}
					panelMenu={panelMenu}
					headerExtra={headerExtra}
					railPlaceholders={railPlaceholders()}
					drag={dragFromHere}
					announcement={dragNote}
					landed={tearDrag.landed}
				>
					<div className={styles.canvas}>
						<LevelCanvas
							view={shownView}
							cursor={cursor}
							onCursorChange={setCursor}
							onToolEvent={onToolEvent}
							preview={tool.preview}
							previewShape={tool.tool === 'paint' && tool.brush.group === 'item' ? 'item' : 'cell'}
							paste={tool.tool === 'stamp' && tool.clip ? pasteRect(tool.clip, cursor) : null}
							selection={tool.selection}
							inspected={inspected}
							arrowsMoveThing={selection.facts.editable}
							onClearInspected={clearInspected}
							ghosts={ghostCells}
							reveal={reveal}
							onCellChosen={onCellChosen}
							insets={insets}
							zoomRequest={zoomRequest}
							onZoomChange={setZoom}
							statusNote={tool.tool === 'stamp' && !tool.clip ? t('tools.stampEmpty') : undefined}
							onZoomAction={(kind) => void runCommand(ZOOM_COMMANDS[kind], commands)}
							overlay={(map) => (
								<ToolPicker
									tool={tool.tool}
									onTool={tool.setTool}
									map={map}
									place={dock.toolPicker}
									onPlace={dock.placeToolPicker}
								/>
							)}
						/>
					</div>
				</DockShell>
				{PANEL_SPECS.map((spec) => {
					const floating = dock.floating[spec.id];
					// A panel torn off never floats here: it is a tab in its home dock until it is back.
					const view = floating;
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
							headerExtra={headerExtra(spec.id, 'wide')}
							actions={
								maximised === spec.id ? (
									<PanelExpandButton title={t(spec.title)} expanded onToggle={dock.restore} />
								) : (
									<>
										{spec.expandable && !view.collapsed && !windows.away[spec.id] && (
											<PanelExpandButton
												title={t(spec.title)}
												expanded={false}
												onToggle={() => dock.maximise(spec.id)}
											/>
										)}
										<PanelMenuButton
											title={t(spec.title)}
											items={menuOf(spec.id, commands).items}
											onSelect={menuOf(spec.id, commands).onSelect}
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

/** How long a run of arrow-key nudges stays one undo step after the last one, in milliseconds. */
const NUDGE_RUN_MS = 900;

/** Two selections of the same place in the level's lists. */
function sameThing(a: Thing, b: Thing): boolean {
	return a.kind === b.kind && a.index === b.index;
}

/** The row a thing stands on in `view`: an enemy with no row of its own rests on its column's ground. */
function entryRowAfter(view: LevelView, thing: Thing): number {
	const spawn = thing.kind === 'enemy' ? view.spawns[thing.index] : undefined;
	return spawn ? spawnCell(view, spawn).y : thing.y;
}
