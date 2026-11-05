// A panel peeking over the level from a folded dock's rail, with a pin that makes it a real dock
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { PinIcon } from '@liminal-hq/fizz-studio-chrome/icons/icons';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { t } from '../../i18n/messages';
import { PanelExpandButton } from './PanelExpandButton';
import { PANEL_ICONS } from './panelIcons';
import type { PanelId } from '../float/panelSpecs';
import styles from './PeekPanel.module.css';

export interface PeekPanelProps {
	zone: ZoneId;
	id: string;
	title: string;
	/** How much room it takes along the width (side docks) or height (bottom dock). */
	size: number;
	onPin: () => void;
	/** Present when the panel can fill the workspace: the header then offers Maximise. */
	onMaximise?: () => void;
	children: ReactNode;
}

/**
 * The folded dock's panel, laid over the level next to its rail. It takes the focus when it opens
 * so the keyboard can reach its content and its pin; the shell closes it on Escape, on a click
 * elsewhere, or when another rail button is chosen.
 */
export function PeekPanel({ zone, id, title, size, onPin, onMaximise, children }: PeekPanelProps) {
	const region = useRef<HTMLElement>(null);
	useEffect(() => {
		region.current?.focus({ preventScroll: true });
	}, [id]);
	const Icon = PANEL_ICONS[id as PanelId];
	return (
		<section
			ref={region}
			className={styles.peek}
			data-peek={zone}
			style={{ '--fls-peek-size': `${size}px` } as CSSProperties}
			tabIndex={-1}
			aria-label={t('dock.peek', { title })}
		>
			<header className={styles.header}>
				{Icon && <Icon size={14} />}
				<h2 className={styles.title}>{title}</h2>
				<span className={styles.spacer} />
				{onMaximise && <PanelExpandButton title={title} expanded={false} onToggle={onMaximise} />}
				<button
					type="button"
					className={styles.pin}
					aria-label={t('dock.pin', { title })}
					title={t('dock.pin', { title })}
					onClick={onPin}
				>
					<PinIcon size={14} />
				</button>
			</header>
			<div className={styles.body}>{children}</div>
		</section>
	);
}
