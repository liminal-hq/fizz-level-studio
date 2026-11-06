// The app-wide keys that run a menu command: New, Open and Close level, Help and Keyboard shortcuts
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

type KeyEventLike = Pick<
	KeyboardEvent,
	'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'target'
>;

/** True when the key lands in a box the person types in, where a bare key is a character. */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	if (target.closest('input, textarea, select')) return true;
	const editable = target.closest('[contenteditable]');
	return editable !== null && editable.getAttribute('contenteditable') !== 'false';
}

/**
 * The id of the command a key press runs, or null. Ctrl+N is New level, Ctrl+O Open level and
 * Ctrl+W Close level (the open level, never the window); Command stands in for Ctrl on a Mac. F1
 * is Help. The question mark is Keyboard shortcuts, and pauses while typing in a box. The caller
 * runs the command through the registry, so a command that cannot run now does nothing.
 */
export function commandForKey(event: KeyEventLike): string | null {
	const key = event.key;
	if (event.altKey) return null;
	if (event.ctrlKey || event.metaKey) {
		if (event.shiftKey) return null;
		switch (key.toLowerCase()) {
			case 'n':
				return 'file.new';
			case 'o':
				return 'file.open';
			case 'w':
				return 'file.close';
			default:
				return null;
		}
	}
	if (key === 'F1') return event.shiftKey ? null : 'help.help';
	if (key === '?' && !isTypingTarget(event.target)) return 'help.shortcuts';
	return null;
}
