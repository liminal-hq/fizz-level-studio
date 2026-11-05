// The tool shortcut keys and the short list of item words the Stamp tool places
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ToolId } from './tool';

/** The key that picks each tool (`P`aint, `E`rase, p`I`ck, `S`elect, s`T`amp). */
export const TOOL_KEYS: Record<ToolId, string> = {
	paint: 'p',
	erase: 'e',
	pick: 'i',
	select: 's',
	stamp: 't',
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

/** The item words a Fizz 1 level can `place`; the backend validates, this is only the chooser. */
export const ITEM_WORDS: readonly string[] = [
	'cheezie',
	'choc',
	'cookie',
	'soda',
	'key-red',
	'key-blue',
	'key-green',
	'usb',
];
