// The Panels menu: shows or hides each floating panel and puts the layout back
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../../i18n/messages';
import styles from './PanelsMenu.module.css';
import { PANEL_SPECS, type PanelId } from './panelSpecs';

export interface PanelsMenuProps {
	/** Whether each panel is shown. */
	visible: Record<PanelId, boolean>;
	onToggle: (id: PanelId, visible: boolean) => void;
	onReset: () => void;
}

/**
 * A button that opens a menu with one checkable item per panel and Reset layout. The menu keeps to
 * the usual keys: Up, Down, Home and End move between items, Space or Enter chooses, and Escape
 * closes it and returns to the button.
 */
export function PanelsMenu({ visible, onToggle, onReset }: PanelsMenuProps) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);
	const menu = useRef<HTMLDivElement>(null);

	const items = () => [
		...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []),
	];

	useEffect(() => {
		if (!open) return;
		items()[0]?.focus();
		const away = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener('pointerdown', away);
		return () => document.removeEventListener('pointerdown', away);
	}, [open]);

	const close = (refocus: boolean) => {
		setOpen(false);
		if (refocus) button.current?.focus();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const all = items();
		const at = all.indexOf(document.activeElement as HTMLElement);
		const go = (index: number) => {
			event.preventDefault();
			all[(index + all.length) % all.length]?.focus();
		};
		switch (event.key) {
			case 'ArrowDown':
				return go(at + 1);
			case 'ArrowUp':
				return go(at - 1);
			case 'Home':
				return go(0);
			case 'End':
				return go(all.length - 1);
			case 'Escape':
				event.preventDefault();
				event.stopPropagation();
				return close(true);
			case 'Tab':
				return close(false);
		}
	};

	return (
		<div className={styles.root} ref={root}>
			<button
				type="button"
				ref={button}
				className={styles.button}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((was) => !was)}
			>
				{t('panels.menu')}
			</button>
			{open && (
				<div
					className={styles.menu}
					role="menu"
					aria-label={t('panels.menu')}
					ref={menu}
					onKeyDown={onKeyDown}
				>
					{PANEL_SPECS.map((spec) => (
						<button
							key={spec.id}
							type="button"
							role="menuitemcheckbox"
							aria-checked={visible[spec.id]}
							className={styles.item}
							onClick={() => onToggle(spec.id, !visible[spec.id])}
						>
							<span className={styles.check} aria-hidden="true">
								{visible[spec.id] ? '✓' : ''}
							</span>
							{t(spec.title)}
						</button>
					))}
					<hr className={styles.rule} />
					<button
						type="button"
						role="menuitem"
						className={styles.item}
						aria-keyshortcuts="Control+Shift+0"
						onClick={() => {
							onReset();
							close(true);
						}}
					>
						<span className={styles.check} aria-hidden="true" />
						{t('panels.reset')}
					</button>
				</div>
			)}
		</div>
	);
}
