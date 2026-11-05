// The dock shell: the level in the middle and the left, right and bottom docks around it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Workspace } from '@liminal-hq/fizz-studio-protocol/generated/Workspace';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { CSSProperties, ReactNode } from 'react';
import type { Size } from '../float/panelGeometry';
import { DockZone } from './DockZone';
import { zoneExtent } from './dockGeometry';
import styles from './DockShell.module.css';

export interface DockActions {
	activate(id: string): void;
	dockTo(id: string, zone: ZoneId): void;
	floatPanel(id: string): void;
}

export interface DockShellProps {
	/** The workspace as it is drawn: hidden panels already out. */
	view: Workspace;
	/** The window the caps are measured against. */
	window: Size;
	titleOf: (id: string) => string;
	/** The real content of a panel. Only the showing panel of each group is asked for. */
	renderPanel: (id: string) => ReactNode;
	actions: DockActions;
	/** The level. It takes whatever the docks leave and is never covered by them. */
	children: ReactNode;
}

/**
 * Lays the level and the docks out on a grid: the left and right docks beside the level, the
 * bottom dock under all three. A dock's room comes from the model (its size held to its cap), so
 * the level keeps the rest. A dock with nothing showing takes none.
 */
export function DockShell({
	view,
	window,
	titleOf,
	renderPanel,
	actions,
	children,
}: DockShellProps) {
	const extent = (zone: ZoneId) => zoneExtent(view, zone, window);
	const style = {
		'--fls-dock-left': `${extent('left')}px`,
		'--fls-dock-right': `${extent('right')}px`,
		'--fls-dock-bottom': `${extent('bottom')}px`,
	} as CSSProperties;

	const zone = (id: ZoneId) =>
		view.zones[id].groups.length > 0 && extent(id) > 0 ? (
			<div className={styles.slot} data-slot={id}>
				<DockZone
					zone={id}
					groups={view.zones[id].groups}
					titleOf={titleOf}
					renderPanel={renderPanel}
					onActivate={actions.activate}
					onDock={actions.dockTo}
					onFloat={actions.floatPanel}
				/>
			</div>
		) : null;

	return (
		<div className={styles.shell} style={style}>
			{zone('left')}
			<div className={styles.level}>{children}</div>
			{zone('right')}
			{zone('bottom')}
		</div>
	);
}
