// The app-wide keys: one dispatcher that reads each command's `keys` and finds the command a key press runs
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { chordMatches, isTypingTarget, type KeyEventLike } from './keyChords';
import type { CommandDef } from './registry';

export { isTypingTarget };

export type KeyPhase = 'capture' | 'bubble';

/**
 * The id of the command a key press runs in this phase, or null. Every chord a command lists in
 * `keys` is matched, so the menus, the palette and the dispatcher read one source. The caller
 * prevents the browser's own action for a match (so Ctrl+= never zooms the page) and runs the
 * command through the registry, so a command that cannot run now does nothing.
 */
export function commandForKey(
	event: KeyEventLike,
	defs: readonly CommandDef[],
	phase: KeyPhase = 'bubble',
): string | null {
	for (const def of defs) {
		for (const chord of def.keys ?? []) {
			if ((chord.capture === true) !== (phase === 'capture')) continue;
			if (chordMatches(event, chord)) return def.id;
		}
	}
	return null;
}
