// The buttons that move a panel between the docks and the level, in a docked or floating panel's header
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { t, type MessageId } from '../../i18n/messages';
import styles from './PanelCommands.module.css';
import { FloatIcon, ZoneIcon } from './panelIcons';

export interface PanelCommandsProps {
	title: string;
	/** Where the panel is now: the button for that place is left out. */
	at: ZoneId | 'float';
	onDock: (zone: ZoneId) => void;
	onFloat: () => void;
}

const DOCK_LABELS: Record<ZoneId, MessageId> = {
	left: 'dock.dockLeft',
	right: 'dock.dockRight',
	bottom: 'dock.dockBottom',
};

const ZONES: readonly ZoneId[] = ['left', 'right', 'bottom'];

/** One keycap per place the panel can go to: Dock left, Dock right, Dock bottom and Float. */
export function PanelCommands({ title, at, onDock, onFloat }: PanelCommandsProps) {
	return (
		<span className={styles.commands}>
			{ZONES.filter((zone) => zone !== at).map((zone) => (
				<button
					key={zone}
					type="button"
					className={styles.key}
					aria-label={t(DOCK_LABELS[zone], { title })}
					title={t(DOCK_LABELS[zone], { title })}
					onClick={() => onDock(zone)}
				>
					<ZoneIcon zone={zone} size={14} />
				</button>
			))}
			{at !== 'float' && (
				<button
					type="button"
					className={styles.key}
					aria-label={t('dock.float', { title })}
					title={t('dock.float', { title })}
					onClick={onFloat}
				>
					<FloatIcon size={14} />
				</button>
			)}
		</span>
	);
}
