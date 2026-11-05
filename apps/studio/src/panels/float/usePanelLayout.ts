// The editor's floating panels: where each is, kept in the settings document and reset on demand
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { PanelLayout } from '@liminal-hq/fizz-studio-protocol/generated/PanelLayout';
import type { PanelPlacement } from '@liminal-hq/fizz-studio-protocol/generated/PanelPlacement';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutClient } from '../../services/layoutClient';
import { clampRect, isMeasured, shownHeight, type Rect, type Size } from './panelGeometry';
import {
	EDITOR_KIND,
	PANEL_SPECS,
	fallbackLayout,
	type PanelId,
	type PanelSpec,
} from './panelSpecs';
import { isResetLayoutKey } from './snap';

/** How long the layout waits after the last change before it is written. */
export const SAVE_DELAY_MS = 400;

/** A panel as it should be drawn now: its rectangle already kept inside the area. */
export interface PanelView {
	rect: Rect;
	collapsed: boolean;
	visible: boolean;
	z: number;
}

export interface PanelLayoutHandle {
	/** Every known panel, in the order of `PANEL_SPECS`. */
	panels: Record<PanelId, PanelView>;
	/** A panel moved or was resized. */
	change(id: PanelId, rect: Rect): void;
	toggleCollapsed(id: PanelId): void;
	/** Brings a panel in front of the others. */
	raise(id: PanelId): void;
	setVisible(id: PanelId, visible: boolean): void;
	/** Puts every panel back where the defaults have it. */
	reset(): void;
}

const near = (z: number) => z > 1_000_000;

function viewOf(placement: PanelPlacement, spec: PanelSpec, area: Size): PanelView {
	const raw: Rect = { x: placement.x, y: placement.y, w: placement.w, h: placement.h };
	return {
		rect: isMeasured(area) ? clampRect(raw, spec.min, area, placement.collapsed) : raw,
		collapsed: placement.collapsed,
		visible: placement.visible,
		z: placement.z,
	};
}

/**
 * Holds the layout of the panels floating in an area of the given size. It starts from the built-in
 * arrangement, takes the saved one when Rust answers (unless the person has already moved
 * something), writes changes back after a short pause and once more when the editor closes, and
 * resets on Ctrl+Shift+0. A failed read or write leaves the layout as it is on screen.
 */
export function usePanelLayout(
	client: LayoutClient,
	area: Size,
	kind: string = EDITOR_KIND,
): PanelLayoutHandle {
	const [layout, setLayout] = useState<PanelLayout>(fallbackLayout);
	const latest = useRef(layout);
	const touched = useRef(false);
	const dirty = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const write = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		if (!dirty.current) return;
		dirty.current = false;
		void client.save(kind, latest.current).catch(() => {});
	}, [client, kind]);

	const update = useCallback(
		(change: (old: PanelLayout) => PanelLayout) => {
			const next = change(latest.current);
			if (next === latest.current) return;
			latest.current = next;
			touched.current = true;
			dirty.current = true;
			setLayout(next);
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(write, SAVE_DELAY_MS);
		},
		[write],
	);

	useEffect(() => {
		let live = true;
		client.get(kind).then(
			(saved) => {
				if (!live || touched.current) return;
				latest.current = saved;
				setLayout(saved);
			},
			() => {},
		);
		return () => {
			live = false;
		};
	}, [client, kind]);

	// The last change is written when the editor goes away.
	useEffect(() => write, [write]);

	const edit = useCallback(
		(id: PanelId, change: (old: PanelPlacement) => PanelPlacement) =>
			update((old) => {
				const was = old.panels[id];
				if (!was) return old;
				const now = change(was);
				return now === was ? old : { panels: { ...old.panels, [id]: now } };
			}),
		[update],
	);

	const change = useCallback(
		(id: PanelId, rect: Rect) =>
			edit(id, (p) =>
				p.x === rect.x && p.y === rect.y && p.w === rect.w && p.h === rect.h
					? p
					: { ...p, ...rect },
			),
		[edit],
	);

	const toggleCollapsed = useCallback(
		(id: PanelId) => edit(id, (p) => ({ ...p, collapsed: !p.collapsed })),
		[edit],
	);

	const raise = useCallback(
		(id: PanelId) =>
			update((old) => {
				const was = old.panels[id];
				if (!was) return old;
				const top = Math.max(...Object.values(old.panels).map((p) => p.z));
				if (was.z === top && Object.values(old.panels).filter((p) => p.z === top).length === 1) {
					return old;
				}
				// Keep the numbers small: past a point, renumber from 1 in the current order.
				if (near(top)) {
					const order = Object.entries(old.panels).sort((a, b) => a[1].z - b[1].z);
					const renumbered = Object.fromEntries(
						order.map(([key, p], index) => [key, { ...p, z: index + 1 }]),
					);
					return { panels: { ...renumbered, [id]: { ...renumbered[id]!, z: order.length + 1 } } };
				}
				return { panels: { ...old.panels, [id]: { ...was, z: top + 1 } } };
			}),
		[update],
	);

	const setVisible = useCallback(
		(id: PanelId, visible: boolean) =>
			edit(id, (p) => (p.visible === visible ? p : { ...p, visible })),
		[edit],
	);

	const reset = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		dirty.current = false;
		touched.current = true;
		client.reset(kind).then(
			(defaults) => {
				latest.current = defaults;
				setLayout(defaults);
			},
			() => {
				latest.current = fallbackLayout();
				setLayout(latest.current);
			},
		);
	}, [client, kind]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!isResetLayoutKey(event)) return;
			event.preventDefault();
			reset();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [reset]);

	const panels = useMemo(() => {
		const defaults = fallbackLayout().panels;
		return Object.fromEntries(
			PANEL_SPECS.map((spec) => [
				spec.id,
				viewOf(layout.panels[spec.id] ?? defaults[spec.id]!, spec, area),
			]),
		) as Record<PanelId, PanelView>;
	}, [layout, area]);

	return { panels, change, toggleCollapsed, raise, setVisible, reset };
}

/** The rectangles other visible panels show, as a panel's snapping targets. */
export function neighboursOf(
	id: PanelId,
	panels: Record<PanelId, PanelView>,
	except?: PanelId,
): Rect[] {
	return PANEL_SPECS.filter(
		(spec) => spec.id !== id && spec.id !== except && panels[spec.id].visible,
	)
		.map((spec) => panels[spec.id])
		.map((p) => ({ ...p.rect, h: shownHeight(p.rect, p.collapsed) }));
}
