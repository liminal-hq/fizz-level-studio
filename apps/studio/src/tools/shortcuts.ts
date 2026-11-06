// The tool shortcut keys and the keys that step the item spacing
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ToolId } from './tool';

/** The key that picks each tool (`B`rush, `E`rase, p`I`ck, `S`elect, s`T`amp, and `Q` for Inspect, a query). */
export const TOOL_KEYS: Record<ToolId, string> = {
	paint: 'b',
	erase: 'e',
	pick: 'i',
	select: 's',
	stamp: 't',
	inspect: 'q',
};

/** The tool a key chooses, or null. Modified keys never choose a tool. */
export function toolForKey(
	event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): ToolId | null {
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	const key = event.key.toLowerCase();
	for (const [tool, shortcut] of Object.entries(TOOL_KEYS)) {
		if (shortcut === key) return tool as ToolId;
	}
	return null;
}

/** The keys that step the item spacing down and up. */
export const SPACING_KEYS = { less: '[', more: ']' } as const;
