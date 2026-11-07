// The Layers panel: the level script's sections, each with an eye, a name, a note and a count
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Choosing a name shows the layer's first line in the script. The eye hides a layer on the
// canvas for this person only: it is not saved, stops no edit, and Claude still sees everything.

import type { LevelTarget } from '@liminal-hq/fizz-studio-protocol/generated/LevelTarget';
import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import { t } from '../../i18n/messages';
import { EyeClosedIcon, EyeOpenIcon } from './layerIcons';
import { layerName, layerNote } from './layerNames';
import { canHide } from './layersView';
import styles from './LayersPanel.module.css';

export interface LayersPanelProps {
	sections: readonly ViewSection[];
	/** The ids of the layers hidden on the canvas. */
	hidden: readonly string[];
	/** Which game's language the level is written in; a Fizz 2 level has no layers yet. */
	target: LevelTarget;
	onToggleHidden: (id: string) => void;
	onShowAll: () => void;
	/** Called with the first line (from 1) of the layer the person chose. */
	onReveal: (line: number) => void;
}

export function LayersPanel({
	sections,
	hidden,
	target,
	onToggleHidden,
	onShowAll,
	onReveal,
}: LayersPanelProps) {
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
					const usable = canHide(section);
					const first = section.lines[0]?.[0];
					return (
						<li key={section.id} className={styles.row} data-hidden={isHidden || undefined}>
							<button
								type="button"
								className={styles.toggle}
								data-keycap-exempt=""
								aria-pressed={isHidden}
								aria-label={t('layers.hide', { layer: name })}
								title={usable ? undefined : t('layers.tilesLater')}
								disabled={!usable}
								onClick={() => onToggleHidden(section.id)}
							>
								{isHidden ? <EyeClosedIcon /> : <EyeOpenIcon />}
							</button>
							<button
								type="button"
								className={styles.name}
								data-keycap-exempt=""
								title={t('layers.reveal', { layer: name })}
								disabled={first === undefined}
								onClick={() => first !== undefined && onReveal(first)}
							>
								<span className={styles.label}>{name}</span>
								{note && <span className={styles.note}>{note}</span>}
							</button>
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
			</div>
			<p className={styles.hint}>{t('layers.hideNote')}</p>
		</div>
	);
}
