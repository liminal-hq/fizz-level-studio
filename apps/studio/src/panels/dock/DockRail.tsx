// A folded dock: a thin rail with one button for each panel, showing its icon and title
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { t, type MessageId } from '../../i18n/messages';
import { FoldButton } from './FoldButton';
import { PANEL_ICONS } from './panelIcons';
import type { PanelId } from '../float/panelSpecs';
import styles from './DockRail.module.css';

export interface DockRailProps {
	zone: ZoneId;
	/** The panels showing in the dock, in tab order. */
	panels: readonly string[];
	titleOf: (id: string) => string;
	/** The panel peeking over the level, if it is one of these. */
	peeking: string | null;
	/** Level-first is on: the rails stay, but a panel cannot peek until it ends. */
	disabled: boolean;
	onPeek: (id: string) => void;
	onClosePeek: () => void;
	onUnfold: () => void;
}

const RAIL_LABELS: Record<ZoneId, MessageId> = {
	left: 'dock.rail.left',
	right: 'dock.rail.right',
	bottom: 'dock.rail.bottom',
};

/**
 * The rail a folded dock leaves. Each panel is a button whose `aria-expanded` says whether it is
 * peeking; choosing the one that is peeking closes it. The first button unfolds the dock.
 */
export function DockRail({
	zone,
	panels,
	titleOf,
	peeking,
	disabled,
	onPeek,
	onClosePeek,
	onUnfold,
}: DockRailProps) {
	return (
		<div className={styles.rail} data-rail={zone} role="group" aria-label={t(RAIL_LABELS[zone])}>
			<FoldButton zone={zone} folded onClick={onUnfold} />
			{panels.map((id) => {
				const Icon = PANEL_ICONS[id as PanelId];
				return (
					<button
						key={id}
						type="button"
						className={styles.item}
						data-rail-item={id}
						aria-expanded={peeking === id}
						disabled={disabled}
						onClick={() => (peeking === id ? onClosePeek() : onPeek(id))}
					>
						{Icon && <Icon size={16} />}
						<span className={styles.title}>{titleOf(id)}</span>
					</button>
				);
			})}
		</div>
	);
}
