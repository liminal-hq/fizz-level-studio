// The right-click and keyboard handlers of a piece of the chrome: they open its menu and keep an outer surface from opening its own
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import type { ContextTarget } from '../commands/contextTargets';
import { isContextMenuKey, useContextMenu } from './useContextMenu';

export interface SurfaceMenuHandlers<E extends HTMLElement> {
	onContextMenu: (event: MouseEvent<E>) => void;
	onKeyDown: (event: KeyboardEvent<E>) => void;
}

/** True for an event that bubbled up through React from a menu drawn in a portal: a right-click on a row is not a click on the surface. */
function fromMenu(event: { target: EventTarget }): boolean {
	return event.target instanceof Element && event.target.closest('[data-fls-menu-root]') !== null;
}

/**
 * The handlers for a surface whose menu is the same wherever in it you click: a panel's header, the
 * commands row, the zoom pill. `getTarget` returns null where the event should not open one (a
 * rail's gap), and the event then goes on to the surface around it. When the surface does open its
 * menu it stops the event there, so a surface inside another (a tab in a header) wins. The keyboard
 * opens the menu at the element that has the focus, not at the surface's own corner, and gives it
 * the focus back on close.
 */
export function useSurfaceMenu<E extends HTMLElement>(
	getTarget: (event: MouseEvent<E> | KeyboardEvent<E>) => ContextTarget | null,
): SurfaceMenuHandlers<E> {
	const menu = useContextMenu();
	const latest = useRef(getTarget);
	latest.current = getTarget;
	const onContextMenu = useCallback(
		(event: MouseEvent<E>) => {
			if (fromMenu(event)) return;
			const target = latest.current(event);
			if (!target) return;
			event.preventDefault();
			event.stopPropagation();
			menu.open(target, { x: event.clientX, y: event.clientY });
		},
		[menu],
	);
	const onKeyDown = useCallback(
		(event: KeyboardEvent<E>) => {
			if (!isContextMenuKey(event.nativeEvent) || fromMenu(event)) return;
			const target = latest.current(event);
			if (!target) return;
			event.preventDefault();
			event.stopPropagation();
			const at = event.target instanceof HTMLElement ? event.target : event.currentTarget;
			menu.open(target, at, { keyboard: true, returnFocusTo: at });
		},
		[menu],
	);
	return { onContextMenu, onKeyDown };
}
