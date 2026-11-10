// The Inspector's account of a selected cell: its tile, what the language says it is, and where it came from
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Everything shown is read from `CellDescription`, the pure model: the language's own category,
// description and syntax for the tile, the script line (with its text) and layer that last set the
// cell, whether that layer is locked or hidden, and the Palette brush that places the tile. The
// panel shows it and changes nothing: the only controls are choosing the brush and Show in script.

import { useId } from 'react';
import { formatLocale } from '../i18n/active';
import { t } from '../i18n/messages';
import { layerName, layerNote } from '../panels/layers/layerNames';
import { SECTION_LABELS } from '../panels/PalettePanel';
import type { Brush } from '../tools/brush';
import type { CellDescription, CellLayer } from './cellDescription';
import styles from './InspectorPanel.module.css';

export interface CellDetailsProps {
	cell: CellDescription;
	/** True for a level in the Fizz 2 language, which has no layers or words here yet. */
	fizz2: boolean;
	onShowLine: (line: number) => void;
	onBrush?: (brush: Brush) => void;
}

function nameOf(layer: CellLayer): string {
	return layerName({ id: layer.id, label: layer.label });
}

export function CellDetails({ cell, fizz2, onShowLine, onBrush }: CellDetailsProps) {
	const base = useId();
	const noteId = `${base}-note`;
	const layer = cell.layer;
	const sections = new Intl.ListFormat(formatLocale(), {
		style: 'long',
		type: 'conjunction',
	}).format(cell.placeable.map((id) => t(SECTION_LABELS[id])));
	const layerExplain = layer?.locked
		? t('inspector.cellLocked')
		: layer?.hidden
			? t('inspector.cellHidden')
			: null;
	const note = layer ? layerNote(layer.id) : null;
	return (
		<>
			<h3 className={styles.heading}>
				{t('inspector.cell', { x: cell.x, y: cell.y, tile: cell.tile })}
			</h3>
			{cell.category && <p className={styles.category}>{cell.category}</p>}
			{cell.empty && <p className={styles.help}>{t('inspector.cellEmpty')}</p>}
			{cell.note && (
				<p className={styles.help} id={noteId}>
					{cell.note}
				</p>
			)}
			{cell.empty && cell.placeable.length > 0 && (
				<p className={styles.note}>{t('inspector.cellPlace', { sections })}</p>
			)}
			{cell.empty && cell.paintLayer && (
				<p className={styles.note}>
					{t('inspector.cellPaintLayer', { layer: nameOf(cell.paintLayer) })}
				</p>
			)}
			{cell.empty && cell.paintLayer?.locked && (
				<p className={styles.warning} role="status">
					{t('inspector.cellLocked')}
				</p>
			)}
			<div role="group" aria-label={t('inspector.cellFacts')}>
				<dl className={styles.facts}>
					{cell.syntax && (
						<>
							<dt>{t('inspector.cellWrittenAs')}</dt>
							<dd className={styles.fact}>
								<code className={styles.code}>{cell.syntax}</code>
							</dd>
						</>
					)}
					{cell.line !== null && (
						<>
							<dt>{t('inspector.cellSetBy')}</dt>
							<dd className={styles.fact}>
								<span>
									{layer
										? t('inspector.cellSetByAt', { layer: nameOf(layer), line: cell.line })
										: t('inspector.line', { line: cell.line })}
								</span>
								{cell.lineText !== null && cell.lineText !== '' && (
									<code className={styles.code}>{cell.lineText}</code>
								)}
								<span className={styles.keys}>
									<button
										type="button"
										className={styles.key}
										onClick={() => onShowLine(cell.line as number)}
									>
										{t('inspector.showInScript')}
									</button>
								</span>
							</dd>
						</>
					)}
					{cell.line === null && !cell.empty && !fizz2 && (
						<>
							<dt>{t('inspector.cellSetBy')}</dt>
							<dd className={styles.fact}>{t('inspector.cellNoLine')}</dd>
						</>
					)}
					{layer && (
						<>
							<dt>{t('inspector.cellLayer')}</dt>
							<dd className={styles.fact}>
								<span>
									{nameOf(layer)}
									{note && <span className={styles.hint}> · {note}</span>}
									{layer.locked && (
										<span className={styles.badge}> {t('inspector.badgeLocked')}</span>
									)}
									{layer.hidden && (
										<span className={styles.badge}> {t('inspector.badgeHidden')}</span>
									)}
								</span>
								{layerExplain && <span className={styles.hint}>{layerExplain}</span>}
							</dd>
						</>
					)}
					{!cell.empty && (
						<>
							<dt>{t('inspector.cellBrush')}</dt>
							<dd className={styles.fact}>
								{cell.brush && onBrush ? (
									<span className={styles.keys}>
										<button
											type="button"
											className={styles.key}
											aria-describedby={cell.note ? noteId : undefined}
											onClick={() => onBrush(cell.brush as Brush)}
										>
											{t('inspector.useBrush', { tile: cell.tile })}
										</button>
									</span>
								) : (
									<span className={styles.hint}>{t('inspector.noBrush')}</span>
								)}
							</dd>
						</>
					)}
				</dl>
			</div>
			<p className={styles.note}>{t('inspector.cellNote')}</p>
		</>
	);
}
