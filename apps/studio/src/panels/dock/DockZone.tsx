// One open dock: its tab groups, each with a tab strip, the buttons that move the showing panel, and its content
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { TabGroup } from '@liminal-hq/fizz-studio-protocol/generated/TabGroup';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { KeyboardEvent, ReactNode } from 'react';
import { t, type MessageId } from '../../i18n/messages';
import { FoldButton } from './FoldButton';
import { PanelCommands } from './PanelCommands';
import { PANEL_ICONS } from './panelIcons';
import type { PanelId } from '../float/panelSpecs';
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
}: DockZoneProps) {
	return (
		<section className={styles.zone} data-zone={zone} aria-label={t(ZONE_LABELS[zone])}>
			{groups.map((group, index) => (
				<Group
					key={group.tabs[0]}
					zone={zone}
					group={group}
					index={index}
					titleOf={titleOf}
					renderPanel={renderPanel}
					onActivate={onActivate}
					onDock={onDock}
					onFloat={onFloat}
					onFold={onFold}
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
}: GroupProps) {
	const id = `dock-${zone}-${index}`;
	const move = (event: KeyboardEvent<HTMLDivElement>) => {
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
	return (
		<div className={styles.group}>
			<div className={styles.header}>
				<div
					className={styles.tabs}
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
								className={styles.tab}
								aria-selected={tab === active}
								aria-controls={`${id}-panel`}
								tabIndex={tab === active ? 0 : -1}
								onClick={() => onActivate(tab)}
							>
								{Icon && <Icon size={14} />}
								{titleOf(tab)}
							</button>
						);
					})}
				</div>
				<PanelCommands
					title={titleOf(active)}
					at={zone}
					onDock={(to) => onDock(active, to)}
					onFloat={() => onFloat(active)}
				/>
				{index === 0 && <FoldButton zone={zone} folded={false} onClick={onFold} />}
			</div>
			<div
				className={styles.body}
				id={`${id}-panel`}
				role="tabpanel"
				aria-labelledby={`${id}-tab-${active}`}
			>
				{renderPanel(active)}
			</div>
		</div>
	);
}
