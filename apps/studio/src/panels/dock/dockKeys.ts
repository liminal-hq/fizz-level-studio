// The key that shows the level only: Tab, when nothing else is using it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Tab also moves the keyboard focus, so it toggles level-first only where the person is working
// on the level: with the focus on the level (the canvas) or on nothing at all. In a text field,
// the script editor, a panel, a menu or a dialog it keeps doing what it does there, and the
// application menu's row does the same without the key.

/** Whether this key press should toggle level-first. */
export function isLevelFirstKey(event: KeyboardEvent): boolean {
	if (event.key !== 'Tab' || event.defaultPrevented) return false;
	if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
	const target = event.target;
	if (!(target instanceof Element)) return true;
	if (target === document.body || target === document.documentElement) return true;
	return target.closest('[data-level]') !== null;
}
