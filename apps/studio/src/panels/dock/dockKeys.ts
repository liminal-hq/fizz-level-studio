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

/** Ctrl+Shift+M: maximises the focused expandable panel, or restores the maximised one. */
export function isMaximiseKey(event: KeyboardEvent): boolean {
	if (event.defaultPrevented || event.altKey || event.metaKey) return false;
	return event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'm';
}

/**
 * Escape, where it is free to restore a maximised panel: not inside the script editor (which uses
 * Escape itself) and not inside a dialog such as the command palette.
 */
export function isRestoreKey(event: KeyboardEvent): boolean {
	if (event.key !== 'Escape' || event.defaultPrevented) return false;
	if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
	const target = event.target;
	if (!(target instanceof Element)) return true;
	return target.closest('.cm-editor, [role="dialog"], dialog, [aria-modal="true"]') === null;
}

/** The panel a node belongs to, if it is in a docked, floating or maximised panel or on a tab. */
export function panelOfNode(node: Element | null): string | null {
	const holder = node?.closest<HTMLElement>('[data-panel-id], [data-panel], [data-tab]');
	if (!holder) return null;
	return holder.dataset.panelId ?? holder.dataset.panel ?? holder.dataset.tab ?? null;
}
