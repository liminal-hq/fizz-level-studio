// A dock's rail along the window's edge: one entry for each panel docked there, showing its icon and title
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { TabGroup } from '@liminal-hq/fizz-studio-protocol/generated/TabGroup';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { t, type MessageId } from '../../i18n/messages';
import { FoldButton } from './FoldButton';
import { PANEL_ICONS } from './panelIcons';
import type { PanelId } from '../float/panelSpecs';
import type { DragSource } from './useDockDrag';
import styles from './DockRail.module.css';

/** How long the pointer rests on an entry of a folded rail before its panel peeks. */
export const PEEK_DELAY_MS = 300;

export type PeekCause = 'hover' | 'key';

export interface DockRailProps {
	zone: ZoneId;
	/** The zone's tab groups as drawn: every panel in them has an entry, in tab order. */
	groups: readonly TabGroup[];
	/** The zone is folded: its content is away and its panels peek from here. */
	collapsed: boolean;
	titleOf: (id: string) => string;
	/** The panel peeking over the level, if it is one of these. */
	peeking: string | null;
	/** Level-first is on: the rail stays, but nothing on it works until it ends. */
	disabled: boolean;
	/** An entry chosen: it shows its panel (opening a folded zone), or folds the zone when showing. */
	onChoose: (id: string) => void;
	onPeek: (id: string, cause: PeekCause) => void;
	onUnfold: () => void;
	/** Moves a panel to a place among its group's panels (the keyboard's way of reordering). */
	onReorder?: (id: string, index: number) => void;
	/** A press on an entry that may become a drag. */
	onDragStart?: (event: PointerEvent<HTMLElement>, id: string, source: DragSource) => void;
	/** The panel being dragged, dimmed where it sits. */
	dragging?: string | null;
}

const RAIL_LABELS: Record<ZoneId, MessageId> = {
	left: 'dock.rail.left',
	right: 'dock.rail.right',
	bottom: 'dock.rail.bottom',
};

/** The keys that move along the rail, and the one that points from the rail into the level. */
const ALONG: Record<ZoneId, { back: string; on: string; into: string }> = {
	left: { back: 'ArrowUp', on: 'ArrowDown', into: 'ArrowRight' },
	right: { back: 'ArrowUp', on: 'ArrowDown', into: 'ArrowLeft' },
	bottom: { back: 'ArrowLeft', on: 'ArrowRight', into: 'ArrowUp' },
};

/**
 * The rail every zone with panels keeps along the window's edge. Each entry is a toggle button
 * named by its panel's title: pressed when its panel is showing in the open zone, with the accent
 * bar. The arrow keys along the rail move between the entries, and with Alt they move the entry
 * among its group's panels; a press that moves becomes a drag. On a folded zone the first button
 * unfolds it, and resting the pointer on an entry (or pressing the arrow key that points into the
 * level) peeks its panel.
 */
export function DockRail({
	zone,
	groups,
	collapsed,
	titleOf,
	peeking,
	disabled,
	onChoose,
	onPeek,
	onUnfold,
	onReorder,
	onDragStart,
	dragging = null,
}: DockRailProps) {
	const rail = useRef<HTMLDivElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancel = () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
	};
	useEffect(() => cancel, []);

	// After a keyboard reorder the entry is drawn again in its new place; give it back the focus.
	const refocus = useRef<string | null>(null);
	useLayoutEffect(() => {
		const id = refocus.current;
		if (id === null) return;
		refocus.current = null;
		rail.current?.querySelector<HTMLElement>(`[data-rail-item="${id}"]`)?.focus();
	});

	const canPeek = collapsed && !disabled;
	const keys = ALONG[zone];
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-rail-item]')];
		const at = items.indexOf(event.target as HTMLButtonElement);
		if (at < 0) return;
		const id = items[at]!.dataset.railItem!;
		if (event.altKey && (event.key === keys.on || event.key === keys.back)) {
			const group = groups.find((g) => g.tabs.includes(id));
			if (!group || !onReorder) return;
			event.preventDefault();
			const to = group.tabs.indexOf(id) + (event.key === keys.on ? 1 : -1);
			if (to < 0 || to >= group.tabs.length) return;
			refocus.current = id;
			onReorder(id, to);
			return;
		}
		let to = -1;
		if (event.key === keys.on) to = (at + 1) % items.length;
		else if (event.key === keys.back) to = (at - 1 + items.length) % items.length;
		else if (event.key === 'Home') to = 0;
		else if (event.key === 'End') to = items.length - 1;
		else if (event.key === keys.into && canPeek) {
			event.preventDefault();
			onPeek(id, 'key');
			return;
		}
		if (to < 0) return;
		event.preventDefault();
		items[to]!.focus();
	};

	return (
		<div
			ref={rail}
			className={styles.rail}
			data-rail={zone}
			data-folded={collapsed || undefined}
			role="group"
			aria-label={t(RAIL_LABELS[zone])}
			onKeyDown={onKeyDown}
		>
			{collapsed && <FoldButton zone={zone} folded onClick={onUnfold} disabled={disabled} />}
			{groups.flatMap((group, index) =>
				group.tabs.map((id) => {
					const Icon = PANEL_ICONS[id as PanelId];
					const active = group.active === id;
					const title = titleOf(id);
					return (
						<button
							key={id}
							type="button"
							className={styles.item}
							data-rail-item={id}
							data-rail-group={index}
							data-active={active || undefined}
							data-peeking={peeking === id || undefined}
							data-dragging={dragging === id || undefined}
							aria-pressed={active && !collapsed}
							title={title}
							disabled={disabled}
							onPointerEnter={(event) => {
								if (!canPeek || event.pointerType === 'touch' || peeking === id) return;
								cancel();
								timer.current = setTimeout(() => onPeek(id, 'hover'), PEEK_DELAY_MS);
							}}
							onPointerLeave={cancel}
							onPointerDown={(event) => {
								cancel();
								onDragStart?.(event, id, 'tab');
							}}
							onClick={() => {
								cancel();
								onChoose(id);
							}}
						>
							{Icon && <Icon size={16} />}
							<span className={styles.title}>{title}</span>
						</button>
					);
				}),
			)}
		</div>
	);
}
