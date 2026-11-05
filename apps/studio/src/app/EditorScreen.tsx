// The level editor screen: the canvas, the tools and the panels for one open level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useCallback, useMemo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { LevelCanvas } from '../canvas/LevelCanvas';
import { enMessages, t, type MessageId } from '../i18n/messages';
import { GhostsPanel } from '../panels/GhostsPanel';
import { HistoryPanel, historyShortcut } from '../panels/HistoryPanel';
import { PalettePanel } from '../panels/PalettePanel';
import { ScriptPanel } from '../panels/ScriptPanel';
import { TornOffNotice } from '../panels/TornOffNotice';
import { usePanelDock } from '../panels/usePanelDock';
import type { PanelWindowClient } from '../services/panelWindowClient';
import { toolForKey } from '../tools/shortcuts';
import { ToolPalette } from '../tools/ToolPalette';
import type { Cell, PointerPhase } from '../tools/tool';
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
}: EditorScreenProps) {
	const [snapshot, setSnapshot] = useState(initial);
	const held = useRef(initial);
	const queue = useRef<Promise<void>>(Promise.resolve());
	const strokes = useRef(0);
	const [cursor, setCursor] = useState<Cell>(initial.view.start ?? { x: 0, y: 0 });
	const [focusLine, setFocusLine] = useState<number | null>(null);
	const [problem, setProblem] = useState<MessageId | null>(null);
	const tool = useTool(snapshot.view);
	const [words, setWords] = useState<WordDoc[]>([]);
	const [proposals, setProposals] = useState<GhostProposal[]>([]);
	const [showGhosts, setShowGhosts] = useState(true);
	const levelId = snapshot.id;
	const revision = snapshot.revision;
	const scriptDock = usePanelDock('script', panelWindows);

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

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (isTyping(event.target)) return;
		const history = historyShortcut(event.nativeEvent);
		if (history) {
			event.preventDefault();
			if (history === 'undo') undo();
			else redo();
			return;
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
			<ToolPalette handle={tool} palette={snapshot.view.palette} />
			<div className={styles.body}>
				<LevelCanvas
					view={snapshot.view}
					cursor={cursor}
					onCursorChange={setCursor}
					onToolEvent={onToolEvent}
					preview={tool.preview}
					selection={tool.selection}
					ghosts={ghostCells}
					onSelectLine={setFocusLine}
				/>
				<div className={styles.side}>
					<PalettePanel
						tiles={snapshot.view.palette}
						words={words}
						tile={tool.tile}
						item={tool.item}
						onPickTile={(word) => {
							tool.setTile(word);
							tool.setTool('paint');
						}}
						onPickItem={(word) => {
							tool.setItem(word);
							tool.setTool('stamp');
						}}
					/>
					<GhostsPanel
						proposals={proposals}
						shown={showGhosts}
						onToggle={setShowGhosts}
						onRefresh={() => setReads((n) => n + 1)}
					/>
					{scriptDock.tornOff ? (
						<TornOffNotice messageId="panel.scriptTornOff" onDockBack={scriptDock.dockBack} />
					) : (
						<ScriptPanel
							words={words}
							text={snapshot.text}
							diagnostics={snapshot.view.diagnostics}
							focusLine={focusLine}
							onTearOff={scriptDock.tearOff}
						/>
					)}
					<HistoryPanel
						canUndo={snapshot.can_undo}
						canRedo={snapshot.can_redo}
						undoName={snapshot.undo_name}
						redoName={snapshot.redo_name}
						onUndo={undo}
						onRedo={redo}
					/>
				</div>
			</div>
		</div>
	);
}
