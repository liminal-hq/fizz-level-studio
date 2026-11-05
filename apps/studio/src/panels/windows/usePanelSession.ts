// A panel window's view of the editor: the shared state from the main window and the level read from Rust
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The level lives in Rust, so this window reads it through the same client the main window uses
// (a snapshot by id, then the changes Rust pushes to every window) and acts through the same
// commands (undo, redo, Claude's proposals). What lives only in the main window's React tree comes
// over the panel bridge: which level is open, the tool and brush, the proposals toggle, the script
// line to show. Until the main window answers there is nothing to show.

import type { GhostProposal } from '@liminal-hq/fizz-studio-protocol/generated/GhostProposal';
import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useCallback, useEffect, useRef, useState } from 'react';
import { newerSnapshot } from '../../app/snapshotRule';
import { ownerOfPanel } from '../../app/windowKind';
import type { LevelClient } from '../../worlds/levelClient';
import type { EditorShare, PanelBridge } from './panelBridge';

/** How long to wait for the main window before asking again, in milliseconds. */
export const HELLO_RETRY_MS = 1000;

export interface PanelSession {
	/** What the main window shared, or `null` until it has answered. */
	share: EditorShare | null;
	/** The open level as of now, or `null` while there is none to show. */
	snapshot: LevelSnapshot | null;
	words: WordDoc[];
	proposals: GhostProposal[];
	undo(): void;
	redo(): void;
	/** Reads Claude's proposals again. */
	refreshProposals(): void;
}

export function usePanelSession(
	windowLabel: string,
	bridge: PanelBridge,
	levels: LevelClient,
): PanelSession {
	const [share, setShare] = useState<EditorShare | null>(null);
	const [snapshot, setSnapshot] = useState<LevelSnapshot | null>(null);
	const [words, setWords] = useState<WordDoc[]>([]);
	const [proposals, setProposals] = useState<GhostProposal[]>([]);
	const [reads, setReads] = useState(0);
	const held = useRef<LevelSnapshot | null>(null);
	const levelId = share?.levelId ?? null;
	const owner = ownerOfPanel(windowLabel) ?? 'main-1';

	// Ask the main window for the editor's state until it answers, then hear it change.
	useEffect(() => {
		let answered = false;
		const stop = bridge.on('editor', (incoming) => {
			answered = true;
			setShare(incoming);
		});
		const ask = () => bridge.send(owner, 'hello', null);
		ask();
		const timer = setInterval(() => {
			if (!answered) ask();
		}, HELLO_RETRY_MS);
		return () => {
			clearInterval(timer);
			stop();
		};
	}, [bridge, owner]);

	const accept = useCallback((incoming: LevelSnapshot) => {
		const kept = held.current ? newerSnapshot(held.current, incoming) : incoming;
		if (kept === held.current) return;
		held.current = kept;
		setSnapshot(kept);
	}, []);

	// The level the main window has open: read it, then follow it.
	useEffect(() => {
		held.current = null;
		setSnapshot(null);
		if (levelId === null) return;
		let live = true;
		const stop = levels.onChanged((changed) => {
			if (live && changed.id === levelId) accept(changed);
		});
		levels.read(levelId).then(
			(read) => live && accept(read),
			() => {},
		);
		return () => {
			live = false;
			stop();
		};
	}, [levels, levelId, accept]);

	useEffect(() => {
		let live = true;
		levels.words().then(
			(found) => live && setWords(found),
			() => live && setWords([]),
		);
		return () => {
			live = false;
		};
	}, [levels]);

	const revision = snapshot?.revision;
	useEffect(() => {
		if (levelId === null) return;
		let live = true;
		levels.ghosts(levelId).then(
			(found) => live && setProposals(found),
			() => live && setProposals([]),
		);
		return () => {
			live = false;
		};
	}, [levels, levelId, revision, reads]);

	// History steps go to Rust based on the revision shown; a refusal (the level moved on) is mended
	// by reading the level again.
	const step = useCallback(
		(command: 'undo' | 'redo') => {
			const current = held.current;
			if (!current) return;
			levels[command](current.id, current.revision).then(accept, () =>
				levels.read(current.id).then(accept, () => {}),
			);
		},
		[levels, accept],
	);
	const undo = useCallback(() => step('undo'), [step]);
	const redo = useCallback(() => step('redo'), [step]);
	const refreshProposals = useCallback(() => setReads((n) => n + 1), []);

	return { share, snapshot, words, proposals, undo, redo, refreshProposals };
}
