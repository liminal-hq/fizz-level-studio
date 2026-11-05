// The rule for which LevelSnapshot the editor keeps when two arrive out of order
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';

/**
 * Keeps whichever snapshot of a level is newer. Replies and pushed changes can arrive in any
 * order, so a snapshot at or below the revision already held is ignored; a snapshot of a different
 * level replaces it, since revisions only compare within one level.
 */
export function newerSnapshot(held: LevelSnapshot, incoming: LevelSnapshot): LevelSnapshot {
	if (incoming.id !== held.id) return incoming;
	if (incoming.revision !== held.revision)
		return incoming.revision > held.revision ? incoming : held;
	// A save keeps the revision and moves the saved one up.
	return incoming.saved_revision > held.saved_revision ? incoming : held;
}
