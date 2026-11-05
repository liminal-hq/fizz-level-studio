// The commands the person ran from the palette this session, most recent first, kept in memory only
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export interface RecentCommands {
	/** The ids, most recent first. */
	ids(): readonly string[];
	/** Moves `id` to the front. */
	note(id: string): void;
}

/** A list that forgets the oldest id past `limit`. Nothing is stored: a new session starts empty. */
export function createRecentCommands(limit = 6): RecentCommands {
	let list: string[] = [];
	return {
		ids: () => list,
		note(id) {
			list = [id, ...list.filter((other) => other !== id)].slice(0, limit);
		},
	};
}

/** The one list for the app's session. */
export const sessionRecents = createRecentCommands();
