// The header button that maximises a panel to fill the workspace, and restores it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// One small component so the control is cheap to restyle or replace: every header that offers it
// (the dock's, the floating panel's and the maximised panel's own) uses this. The icons are the
// panel's own, not the window's: four corner brackets pointing outward to maximise and the same
// corners pulled in to restore, so the control never looks like the title bar's maximise button.

import { t } from '../../i18n/messages';
import { MAXIMISE_KEYS } from '../../commands/registry';
import styles from './PanelMenuButton.module.css';

export interface PanelExpandButtonProps {
	title: string;
	/** The panel is maximised now: the button restores it. */
	expanded: boolean;
	onToggle: () => void;
}

const ICON_PROPS = {
	width: 14,
	height: 14,
	viewBox: '0 0 16 16',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.25,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
	focusable: 'false',
} as const;

/** Four corners spread out to the edges: the panel will fill the workspace. */
export function MaximiseIcon() {
	return (
		<svg {...ICON_PROPS} data-icon="maximise">
			<path d="M2 6V2h4M10 2h4v4M2 10v4h4M14 10v4h-4" />
		</svg>
	);
}

/** The same four corners pulled in, their elbows toward the middle: the panel will go back. */
export function RestoreIcon() {
	return (
		<svg {...ICON_PROPS} data-icon="restore">
			<path d="M2 6h4V2M10 2v4h4M2 10h4v4M10 14v-4h4" />
		</svg>
	);
}

export function PanelExpandButton({ title, expanded, onToggle }: PanelExpandButtonProps) {
	const name = t(expanded ? 'panel.restore' : 'panel.maximise', { title });
	const tip = t(expanded ? 'panel.restore.tip' : 'panel.maximise.tip', {
		title,
		keys: MAXIMISE_KEYS,
	});
	return (
		<button
			type="button"
			className={styles.key}
			aria-label={name}
			title={tip}
			aria-keyshortcuts="Control+Shift+M"
			data-expand=""
			onClick={onToggle}
		>
			{expanded ? <RestoreIcon /> : <MaximiseIcon />}
		</button>
	);
}
