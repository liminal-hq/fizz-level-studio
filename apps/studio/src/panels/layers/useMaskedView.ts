// The level drawn without the layers of tiles the person hid, asked of Rust for the revision shown
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Hiding things (items, enemies, exits and doors) filters the view in the webview. Hiding tiles
// needs the level run without those layers' statements, which only Rust can do, so this asks it:
// nothing is saved, and the answer is a view like any other.

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { useEffect, useState } from 'react';
import type { LevelClient } from '../../worlds/levelClient';

/**
 * The view with the statements of the `hidden` layers left out, for the level at `revision`, or
 * `null` while nothing is hidden or the answer has not come yet (draw the ordinary view until
 * then). A reply for an older revision or another set is dropped.
 */
export function useMaskedView(
	client: LevelClient,
	levelId: string,
	revision: bigint,
	hidden: readonly string[],
): LevelView | null {
	const [masked, setMasked] = useState<LevelView | null>(null);
	const key = hidden.join(',');
	useEffect(() => {
		if (key === '') {
			setMasked(null);
			return;
		}
		let live = true;
		client.viewMasked(levelId, key.split(',')).then(
			(view) => live && setMasked(view),
			() => live && setMasked(null),
		);
		return () => {
			live = false;
		};
	}, [client, levelId, revision, key]);
	return key === '' ? null : masked;
}
