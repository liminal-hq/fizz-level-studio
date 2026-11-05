// The moves of a floating panel inside a workspace: where it is, whether it is folded, what is in front
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { Rect } from '../float/panelGeometry';

/** Past this the stacking numbers are renumbered from 1, so they stay small. */
const Z_LIMIT = 1_000_000;

/** Places a panel's floating rectangle. */
export function moveFloat(workspace: Workspace, id: string, rect: Rect): Workspace {
	const entry = workspace.panels[id];
	if (!entry) return workspace;
	const f = entry.float;
	if (f.x === rect.x && f.y === rect.y && f.w === rect.w && f.h === rect.h) return workspace;
	const next = structuredClone(workspace);
	Object.assign(next.panels[id]!.float, { x: rect.x, y: rect.y, w: rect.w, h: rect.h });
	return next;
}

/** Folds a floating panel to its header, or opens it again. */
export function toggleFloatCollapsed(workspace: Workspace, id: string): Workspace {
	if (!workspace.panels[id]) return workspace;
	const next = structuredClone(workspace);
	const f = next.panels[id]!.float;
	f.collapsed = !f.collapsed;
	return next;
}

/** Brings a floating panel in front of the others. */
export function raiseFloat(workspace: Workspace, id: string): Workspace {
	if (!workspace.panels[id]) return workspace;
	const entries = Object.entries(workspace.panels);
	const top = Math.max(...entries.map(([, e]) => e.float.z));
	const tied = entries.filter(([, e]) => e.float.z === top).length;
	if (workspace.panels[id]!.float.z === top && tied === 1) return workspace;
	const next = structuredClone(workspace);
	if (top >= Z_LIMIT) {
		const order = Object.entries(next.panels)
			.filter(([key]) => key !== id)
			.sort((a, b) => a[1].float.z - b[1].float.z);
		order.forEach(([, entry], index) => (entry.float.z = index + 1));
		next.panels[id]!.float.z = order.length + 1;
	} else {
		next.panels[id]!.float.z = top + 1;
	}
	return next;
}
