// The locked layers of the open level: read from Rust, followed across windows, changed through it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Rust owns the lock (the session enforces it and the sidecar keeps it), so this holds only what
// Rust last said and asks Rust to change it. Every window that shows the panel hears the same
// change.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LevelClient } from '../../worlds/levelClient';

export interface LayerLocks {
	/** The locked layer ids, as Rust last reported them. */
	locked: readonly string[];
	/** Locks the layer if it is open, and unlocks it if it is locked. */
	toggle(layer: string): void;
	unlockAll(): void;
	/** Counts up each time a change could not be saved, so a screen can say so once per failure. */
	failures: number;
}

export function useLayerLocks(client: LevelClient, levelId: string | null): LayerLocks {
	const [locked, setLocked] = useState<readonly string[]>([]);
	const [failures, setFailures] = useState(0);
	const held = useRef(locked);
	held.current = locked;

	useEffect(() => {
		setLocked([]);
		if (levelId === null) return;
		let live = true;
		// A change heard while the first read is on its way is newer than that read.
		let heard = false;
		client.layers(levelId).then(
			(found) => live && !heard && setLocked(found),
			() => {},
		);
		const stop = client.onLayersChanged((id, now) => {
			if (!live || id !== levelId) return;
			heard = true;
			setLocked(now);
		});
		return () => {
			live = false;
			stop();
		};
	}, [client, levelId]);

	const change = useCallback(
		async (layers: readonly string[], value: boolean) => {
			if (levelId === null) return;
			for (const layer of layers) {
				try {
					setLocked(await client.setLayerLocked(levelId, layer, value));
				} catch {
					setFailures((n) => n + 1);
					return;
				}
			}
		},
		[client, levelId],
	);
	const toggle = useCallback(
		(layer: string) => void change([layer], !held.current.includes(layer)),
		[change],
	);
	const unlockAll = useCallback(() => void change([...held.current], false), [change]);
	return { locked, toggle, unlockAll, failures };
}
