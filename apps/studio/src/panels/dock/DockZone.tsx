// One open dock: its tab groups, each with a header naming the showing panel, the buttons that move it, and its content
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { TabGroup } from '@liminal-hq/fizz-studio-protocol/generated/TabGroup';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { PointerEvent, ReactNode } from 'react';
import { t, type MessageId } from '../../i18n/messages';
import { PanelMenuButton, type PanelMenu } from './PanelMenuButton';
import { PanelExpandButton } from './PanelExpandButton';
import { GripIcon, PANEL_ICONS } from './panelIcons';
import type { PanelId } from '../float/panelSpecs';
import type { DragSource } from './useDockDrag';
import styles from './DockZone.module.css';

export interface DockZoneProps {
	zone: ZoneId;
	groups: readonly TabGroup[];
	titleOf: (id: string) => string;
	renderPanel: (id: string) => ReactNode;
	/** The rows of a panel's own ⋮ menu and what choosing one does; the button is left out when this is absent. */
	panelMenu?: (id: string) => PanelMenu;
	/** A press on a header that may become a drag. */
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
 * The panels docked in a zone. Each group is a header with a grip, the showing panel's icon and
 * title, Maximise and its ⋮ menu, over its content; only the showing panel is mounted. The zone's rail is
 * where the other panels are chosen and reordered, so the header has no tab strip of its own and
 * a panel is listed once on the rail and named once here. A press on the header that moves drags
 * the showing panel.
 */
export function DockZone({
	zone,
	groups,
	titleOf,
	renderPanel,
	panelMenu,
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
					panelMenu={panelMenu}
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
	panelMenu,
	onDragStart,
	dragging = null,
	expandable,
	onMaximise,
	maximised = null,
	onRestore,
}: GroupProps) {
	const active = group.active;
	const filling = maximised === active;
	const Icon = PANEL_ICONS[active as PanelId];
	const title = titleOf(active);
	const menu = panelMenu?.(active);
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
				data-dragging={active === dragging || undefined}
				onPointerDown={(event) => {
					if (filling || (event.target as HTMLElement).closest('button')) return;
					onDragStart?.(event, active, 'header');
				}}
			>
				{filling ? (
					<>
						<h2 className={styles.maximisedTitle}>{title}</h2>
						<PanelExpandButton title={title} expanded onToggle={() => onRestore?.()} />
					</>
				) : (
					<>
						<span className={styles.grip} aria-hidden="true">
							<GripIcon size={14} />
						</span>
						{Icon && <Icon size={14} />}
						<h2 className={styles.title}>{title}</h2>
						<span className={styles.spacer} />
						{onMaximise && expandable?.(active) && (
							<PanelExpandButton
								title={title}
								expanded={false}
								onToggle={() => onMaximise(active)}
							/>
						)}
						{menu && <PanelMenuButton title={title} items={menu.items} onSelect={menu.onSelect} />}
					</>
				)}
			</div>
			<div className={styles.body} data-panel-id={active}>
				{renderPanel(active)}
			</div>
		</div>
	);
}
