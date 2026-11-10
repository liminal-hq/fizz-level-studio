// The Layers panel: the level script's sections, each with an eye, a name, a note and a count
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Choosing a name shows the layer's first line in the script. The eye hides a layer on the
// canvas for this person only: it is not saved, stops no edit, and Claude still sees everything.

import type { LevelTarget } from '@liminal-hq/fizz-studio-protocol/generated/LevelTarget';
import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import type { KeyboardEvent, MouseEvent } from 'react';
import { isContextMenuKey, useContextMenu } from '../../app/useContextMenu';
import { t } from '../../i18n/messages';
import { EyeClosedIcon, EyeOpenIcon, LockClosedIcon, LockOpenIcon } from './layerIcons';
import { layerName, layerNote } from './layerNames';
import { Tooltip } from '../../ui/Tooltip';
import styles from './LayersPanel.module.css';

export interface LayersPanelProps {
	sections: readonly ViewSection[];
	/** The ids of the layers hidden on the canvas. */
	hidden: readonly string[];
	/** Which game's language the level is written in; a Fizz 2 level has no layers yet. */
	target: LevelTarget;
	onToggleHidden: (id: string) => void;
	onShowAll: () => void;
	/** The ids of the locked layers. */
	locked: readonly string[];
	onToggleLocked: (id: string) => void;
	onUnlockAll: () => void;
	/** Called with the first line (from 1) of the layer the person chose. */
	onReveal: (line: number) => void;
}

export function LayersPanel({
	sections,
	hidden,
	target,
	onToggleHidden,
	onShowAll,
	locked,
	onToggleLocked,
	onUnlockAll,
	onReveal,
}: LayersPanelProps) {
	const menu = useContextMenu();
	// A right-click (or the Menu key) on a layer's row opens its menu. It changes nothing first: the
	// layer's own commands act on the layer the menu names. A level with no layers has no rows.
	const onRowContextMenu = (layer: string) => (event: MouseEvent<HTMLLIElement>) => {
		event.preventDefault();
		menu.open(
			{ kind: 'layerRow', layer },
			{ x: event.clientX, y: event.clientY },
			{
				returnFocusTo:
					(event.target instanceof Element
						? event.target.closest<HTMLElement>('button:not(:disabled)')
						: null) ?? event.currentTarget.querySelector<HTMLElement>('button:not(:disabled)'),
			},
		);
	};
	const onRowKeyDown = (layer: string) => (event: KeyboardEvent<HTMLLIElement>) => {
		if (!isContextMenuKey(event.nativeEvent) || !(event.target instanceof HTMLElement)) return;
		event.preventDefault();
		event.stopPropagation();
		menu.open({ kind: 'layerRow', layer }, event.target, {
			keyboard: true,
			returnFocusTo: event.target,
		});
	};
	if (sections.length === 0) {
		return (
			<p className={styles.empty}>{target === 'fizz2' ? t('layers.fizz2') : t('layers.none')}</p>
		);
	}
	return (
		<div className={styles.panel}>
			<ul className={styles.list} aria-label={t('layers.title')}>
				{sections.map((section) => {
					const name = layerName(section);
					const note = layerNote(section.id);
					const isHidden = hidden.includes(section.id);
					const isLocked = locked.includes(section.id);
					const first = section.lines[0]?.[0];
					return (
						<li
							key={section.id}
							className={styles.row}
							data-hidden={isHidden || undefined}
							data-locked={isLocked || undefined}
							onContextMenu={onRowContextMenu(section.id)}
							onKeyDown={onRowKeyDown(section.id)}
						>
							<Tooltip label={t('layers.hide', { layer: name })}>
								<button
									type="button"
									className={styles.toggle}
									data-keycap-exempt=""
									aria-pressed={isHidden}
									aria-label={t('layers.hide', { layer: name })}
									onClick={() => onToggleHidden(section.id)}
								>
									{isHidden ? <EyeClosedIcon /> : <EyeOpenIcon />}
								</button>
							</Tooltip>
							<Tooltip label={t('layers.lock', { layer: name })}>
								<button
									type="button"
									className={styles.lock}
									data-keycap-exempt=""
									aria-pressed={isLocked}
									aria-label={t('layers.lock', { layer: name })}
									onClick={() => onToggleLocked(section.id)}
								>
									{isLocked ? <LockClosedIcon /> : <LockOpenIcon />}
								</button>
							</Tooltip>
							<Tooltip label={t('layers.reveal', { layer: name })}>
								<button
									type="button"
									className={styles.name}
									data-keycap-exempt=""
									disabled={first === undefined}
									onClick={() => first !== undefined && onReveal(first)}
								>
									<span className={styles.label}>{name}</span>
									{note && <span className={styles.note}>{note}</span>}
								</button>
							</Tooltip>
							<span className={styles.count}>{section.count}</span>
						</li>
					);
				})}
			</ul>
			<div className={styles.footer}>
				<button
					type="button"
					className={styles.action}
					disabled={hidden.length === 0}
					onClick={onShowAll}
				>
					{t('layers.showAll')}
				</button>
				<button
					type="button"
					className={styles.action}
					disabled={locked.length === 0}
					onClick={onUnlockAll}
				>
					{t('layers.unlockAll')}
				</button>
			</div>
			<p className={styles.hint}>{t('layers.hideNote')}</p>
		</div>
	);
}
