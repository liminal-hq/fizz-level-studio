// How a surface opens a context menu: the host's `open` and `close`, and a trigger for plain surfaces
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// `ContextMenuHost` (one per window, rendered at the root of the app) provides the context; a screen
// drawn without it (a unit test, the webview served alone) gets a menu that never opens. A surface
// works out its `ContextTarget`, applies its own selection rule, and calls `open`.

import type { MenuPosition } from '@liminal-hq/fizz-studio-chrome/ContextMenu/types';
import {
	createContext,
	useCallback,
	useContext,
	useRef,
	type KeyboardEvent,
	type MouseEvent,
} from 'react';
import type { ContextTarget } from '../commands/contextTargets';

export interface ContextMenuOptions {
	/** The menu was opened from the keyboard: the first row takes focus. */
	keyboard?: boolean;
	/** Where focus goes when the menu closes; defaults to what had focus when it opened. */
	returnFocusTo?: HTMLElement | null;
}

export interface ContextMenuApi {
	/**
	 * Opens the menu for `target` at a pointer position, or at an element's corner (a keyboard open).
	 * The host focuses the target first, rebuilds the rows from the command bridge while the menu is
	 * open, and opens nothing when the target has no rows.
	 */
	open(target: ContextTarget, at: MenuPosition | HTMLElement, options?: ContextMenuOptions): void;
	/**
	 * Replaces the target of the menu that is open, so its rows are rebuilt from the new one (a canvas
	 * menu's header gains its script line when the line arrives). It does nothing when no menu is open.
	 */
	update(target: ContextTarget): void;
	close(): void;
}

/** The api of a window with no host: nothing opens. */
export const NO_CONTEXT_MENU: ContextMenuApi = {
	open: () => {},
	update: () => {},
	close: () => {},
};

export const ContextMenuContext = createContext<ContextMenuApi>(NO_CONTEXT_MENU);

export function useContextMenu(): ContextMenuApi {
	return useContext(ContextMenuContext);
}

/** How long after a keyboard open a `contextmenu` event is only prevented, not opened again, in milliseconds. */
export const KEYBOARD_OPEN_GRACE_MS = 300;

/** The keys that open the menu from the keyboard: the Menu key, and Shift+F10. */
export function isContextMenuKey(event: {
	key: string;
	shiftKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
}) {
	return (
		event.key === 'ContextMenu' ||
		(event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.altKey)
	);
}

export interface ContextMenuTrigger<E extends HTMLElement> {
	onContextMenu: (event: MouseEvent<E>) => void;
	onKeyDown: (event: KeyboardEvent<E>) => void;
}

/**
 * The handlers for a surface whose target is simple: a right-click opens the menu at the pointer, and
 * the Menu key or Shift+F10 opens it at the element's corner with the keyboard flag. `getTarget` returns
 * null where the surface has no menu, and the event then goes on to the host (which blocks it).
 * A surface with a selection rule (the canvas) calls `open` itself instead.
 */
export function useContextMenuTrigger<E extends HTMLElement>(
	getTarget: (event: MouseEvent<E> | KeyboardEvent<E>) => ContextTarget | null,
): ContextMenuTrigger<E> {
	const menu = useContextMenu();
	const latest = useRef(getTarget);
	latest.current = getTarget;
	const onContextMenu = useCallback(
		(event: MouseEvent<E>) => {
			const target = latest.current(event);
			if (!target) return;
			event.preventDefault();
			menu.open(target, { x: event.clientX, y: event.clientY });
		},
		[menu],
	);
	const onKeyDown = useCallback(
		(event: KeyboardEvent<E>) => {
			if (!isContextMenuKey(event.nativeEvent)) return;
			const target = latest.current(event);
			if (!target) return;
			event.preventDefault();
			menu.open(target, event.currentTarget, {
				keyboard: true,
				returnFocusTo: event.currentTarget,
			});
		},
		[menu],
	);
	return { onContextMenu, onKeyDown };
}
