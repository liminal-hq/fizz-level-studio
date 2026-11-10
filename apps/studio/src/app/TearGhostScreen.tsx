// The tear-off ghost: a small card that draws whichever panel the drag is carrying
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The plugin keeps one click-through window (`tear-ghost`) and moves it under the cursor from the
// native side. The window loads this page. It draws a card only while a drag has sent a payload, so
// the window stays empty and transparent between drags. Modelled on Waypoint's `TearGhostScreen`.

import { getPayload, onPayload } from '@liminal-hq/plugin-window-tearoff';
import { useEffect, useState } from 'react';
import { PANEL_ICONS } from '../panels/dock/panelIcons';
import type { PanelId } from '../panels/float/panelSpecs';
import { PANEL_SPECS } from '../panels/float/panelSpecs';
import { readPanelDragPayload, type PanelDragPayload } from '../services/tearoffClient';
import styles from './TearGhostScreen.module.css';

/** The card for a drag's payload: the panel's icon, its name, and what releasing would do. */
export function TearCard({ payload }: { payload: PanelDragPayload }) {
	const known = PANEL_SPECS.some((spec) => spec.id === payload.panel);
	const Icon = known ? PANEL_ICONS[payload.panel as PanelId] : null;
	return (
		<div className={styles.card} data-testid="tear-ghost-card">
			{Icon && (
				<span className={styles.icon}>
					<Icon />
				</span>
			)}
			<div className={styles.text}>
				<span className={styles.title}>{payload.title}</span>
				{payload.label !== undefined && <span className={styles.label}>{payload.label}</span>}
			</div>
		</div>
	);
}

/**
 * Reads the payload once on mount (the page may load after the drag began) and then follows the
 * payload events. The plugin sends `null` when a drag ends, which clears the card before the window
 * is next shown.
 */
export function TearGhostScreen() {
	const [payload, setPayload] = useState<PanelDragPayload | null>(null);

	useEffect(() => {
		let active = true;
		let unlisten: (() => void) | undefined;
		void onPayload((raw) => {
			if (active) setPayload(readPanelDragPayload(raw));
		}).then(
			(stop) => {
				if (active) unlisten = stop;
				else stop();
			},
			() => {},
		);
		void getPayload()
			.then((raw) => {
				if (active) setPayload((current) => current ?? readPanelDragPayload(raw));
			})
			.catch(() => {});
		return () => {
			active = false;
			unlisten?.();
		};
	}, []);

	if (!payload) return null;
	return <TearCard payload={payload} />;
}
