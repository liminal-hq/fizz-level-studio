// One open dock: its tab groups, each with a tab strip, the buttons that move the showing panel, and its content
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { TabGroup } from '@liminal-hq/fizz-studio-protocol/generated/TabGroup';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import {
	useLayoutEffect,
	useRef,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
} from 'react';
import { t, type MessageId } from '../../i18n/messages';
import { FoldButton } from './FoldButton';
import { PanelCommands } from './PanelCommands';
import { PanelExpandButton } from './PanelExpandButton';
import { PANEL_ICONS } from './panelIcons';
import type { PanelId } from '../float/panelSpecs';
import type { DragSource } from './useDockDrag';
import styles from './DockZone.module.css';

export interface DockZoneProps {
	zone: ZoneId;
	groups: readonly TabGroup[];
	titleOf: (id: string) => string;
	renderPanel: (id: string) => ReactNode;
	onActivate: (id: string) => void;
	onDock: (id: string, zone: ZoneId) => void;
	onFloat: (id: string) => void;
	onFold: () => void;
	/** Moves a docked panel to a place among its group's tabs (the keyboard's way of reordering). */
	onReorder?: (id: string, index: number) => void;
	/** A press on a tab or a header that may become a drag. */
	onDragStart?: (event: PointerEvent<HTMLElement>, id: string, source: DragSource) => void;
	/** Whether a panel can be maximised, and the action that does it. */
	expandable?: (id: string) => boolean;
	onMaximise?: (id: string) => void;
	/** The maximised panel, and the action that puts it back. */
	maximised?: string | null;
	onRestore?: () => void;
	/** The panel being dragged, dimmed where it sits. */
	dragging?: string | null;
}

export const ZONE_LABELS: Record<ZoneId, MessageId> = {
	left: 'dock.zone.left',
	right: 'dock.zone.right',
	bottom: 'dock.zone.bottom',
};

/**
 * The panels docked in a zone. Each group is a tab strip over the showing panel's content; only
 * the showing panel is mounted. The strip follows the tabs pattern: Left and Right move between
 * the tabs, Home and End go to the first and last.
 */
export function DockZone({
	zone,
	groups,
	titleOf,
	renderPanel,
	onActivate,
	onDock,
	onFloat,
	onFold,
	onReorder,
	onDragStart,
	dragging = null,
	expandable,
	onMaximise,
	maximised = null,
	onRestore,
}: DockZoneProps) {
	return (
		<section className={styles.zone} data-zone={zone} aria-label={t(ZONE_LABELS[zone])}>
			{groups.map((group, index) => (
				<Group
					key={index}
					zone={zone}
					group={group}
					index={index}
					titleOf={titleOf}
					renderPanel={renderPanel}
					onActivate={onActivate}
					onDock={onDock}
					onFloat={onFloat}
					onFold={onFold}
					onReorder={onReorder}
					onDragStart={onDragStart}
					dragging={dragging}
					expandable={expandable}
					onMaximise={onMaximise}
					maximised={maximised}
					onRestore={onRestore}
				/>
			))}
		</section>
	);
}

interface GroupProps extends Omit<DockZoneProps, 'groups'> {
	group: TabGroup;
	index: number;
}

function Group({
	zone,
	group,
	index,
	titleOf,
	renderPanel,
	onActivate,
	onDock,
	onFloat,
	onFold,
	onReorder,
	onDragStart,
	dragging = null,
	expandable,
	onMaximise,
	maximised = null,
	onRestore,
}: GroupProps) {
	const id = `dock-${zone}-${index}`;
	const strip = useRef<HTMLDivElement>(null);
	// After a keyboard reorder the tab is drawn again in its new place; give it back the focus.
	const refocus = useRef<string | null>(null);
	useLayoutEffect(() => {
		const tab = refocus.current;
		if (tab === null) return;
		refocus.current = null;
		strip.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus();
	});
	const move = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			const tab = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"]')?.dataset.tab;
			const from = tab === undefined ? -1 : group.tabs.indexOf(tab);
			if (from < 0 || !onReorder) return;
			event.preventDefault();
			const to = from + (event.key === 'ArrowRight' ? 1 : -1);
			if (to < 0 || to >= group.tabs.length) return;
			refocus.current = tab!;
			onReorder(tab!, to);
			return;
		}
		const at = group.tabs.indexOf(group.active);
		let to = -1;
		if (event.key === 'ArrowRight') to = (at + 1) % group.tabs.length;
		else if (event.key === 'ArrowLeft') to = (at - 1 + group.tabs.length) % group.tabs.length;
		else if (event.key === 'Home') to = 0;
		else if (event.key === 'End') to = group.tabs.length - 1;
		if (to < 0) return;
		event.preventDefault();
		onActivate(group.tabs[to]!);
		event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus();
	};
	const active = group.active;
	const filling = maximised === active;
	return (
		<div
			className={styles.group}
			data-group-zone={zone}
			data-group={index}
			data-panel-maximised={filling ? '' : undefined}
			data-panel-id={filling ? active : undefined}
		>
			<div
				className={styles.header}
				data-strip=""
				onPointerDown={(event) => {
					if (filling || (event.target as HTMLElement).closest('button')) return;
					onDragStart?.(event, active, 'header');
				}}
			>
				{filling ? (
					<>
						<h2 className={styles.maximisedTitle}>{titleOf(active)}</h2>
						<PanelExpandButton title={titleOf(active)} expanded onToggle={() => onRestore?.()} />
					</>
				) : (
					<>
						<div
							className={styles.tabs}
							ref={strip}
							role="tablist"
							aria-label={t(ZONE_LABELS[zone])}
							onKeyDown={move}
						>
							{group.tabs.map((tab) => {
								const Icon = PANEL_ICONS[tab as PanelId];
								return (
									<button
										key={tab}
										id={`${id}-tab-${tab}`}
										type="button"
										role="tab"
										data-tab={tab}
										data-dragging={tab === dragging || undefined}
										className={styles.tab}
										aria-selected={tab === active}
										aria-controls={`${id}-panel`}
										tabIndex={tab === active ? 0 : -1}
										onClick={() => onActivate(tab)}
										onPointerDown={(event) => onDragStart?.(event, tab, 'tab')}
									>
										{Icon && <Icon size={14} />}
										{titleOf(tab)}
									</button>
								);
							})}
						</div>
						{onMaximise && expandable?.(active) && (
							<PanelExpandButton
								title={titleOf(active)}
								expanded={false}
								onToggle={() => onMaximise(active)}
							/>
						)}
						<PanelCommands
							title={titleOf(active)}
							at={zone}
							onDock={(to) => onDock(active, to)}
							onFloat={() => onFloat(active)}
						/>
						{index === 0 && <FoldButton zone={zone} folded={false} onClick={onFold} />}
					</>
				)}
			</div>
			<div
				className={styles.body}
				id={`${id}-panel`}
				data-panel-id={active}
				role="tabpanel"
				aria-labelledby={`${id}-tab-${active}`}
			>
				{renderPanel(active)}
			</div>
		</div>
	);
}
