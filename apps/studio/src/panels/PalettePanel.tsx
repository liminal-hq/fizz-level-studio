// The palette: every brush in labelled sections, the only place the brush is chosen
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { t, type MessageId } from '../i18n/messages';
import { sameBrush, type Brush } from '../tools/brush';
import { paletteSections, sectionOf, type SectionId } from '../tools/paletteSections';
import { SpacingStepper } from '../tools/SpacingStepper';
import { brushSwatch } from '../tools/swatch';
import styles from './PalettePanel.module.css';

export interface PalettePanelProps {
	/** The tile words of the open level (`LevelView.palette`). */
	tiles: readonly string[];
	/** The language's documented words, from the backend; their notes show as tooltips. */
	words: readonly WordDoc[];
	brush: Brush;
	/** Chooses the brush; the caller also switches the tool to Paint. */
	onBrush: (brush: Brush) => void;
	/** Items per cell step: one in every `spacing` cells. */
	spacing: number;
	onSpacing: (spacing: number) => void;
}

const SECTION_LABELS = {
	terrain: 'palette.section.terrain',
	hazards: 'palette.section.hazards',
	treats: 'palette.section.treats',
	enemies: 'palette.section.enemies',
	markers: 'palette.section.markers',
} as const satisfies Record<SectionId, MessageId>;

export function PalettePanel({
	tiles,
	words: docs,
	brush,
	onBrush,
	spacing,
	onSpacing,
}: PalettePanelProps) {
	const base = useId();
	const panel = useRef<HTMLDivElement>(null);
	// Folded sections are remembered for this session only, in memory.
	const [folded, setFolded] = useState<ReadonlySet<SectionId>>(new Set());
	// The entry that takes Tab in each section (the roving tab stop), by section.
	const [roving, setRoving] = useState<Readonly<Record<string, string>>>({});

	// Pick or a stroke changes the brush from outside: open its section so it can be seen.
	const [lastBrush, setLastBrush] = useState(brush);
	if (!sameBrush(lastBrush, brush)) {
		setLastBrush(brush);
		const home = sectionOf(brush);
		if (folded.has(home)) {
			const next = new Set(folded);
			next.delete(home);
			setFolded(next);
		}
	}
	const chosenKey = `${brush.group}:${brush.kind}`;
	useEffect(() => {
		panel.current
			?.querySelector<HTMLElement>('[role=option][aria-selected=true]')
			?.scrollIntoView?.({ block: 'nearest' });
	}, [chosenKey]);

	const sections = paletteSections(tiles, docs);
	const noteOf = (entry: Brush) =>
		docs.find((doc) => doc.word === entry.kind && doc.kind === entry.group)?.note || undefined;

	const toggle = (id: SectionId) => {
		const next = new Set(folded);
		if (!next.delete(id)) next.add(id);
		setFolded(next);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLElement>, id: SectionId) => {
		const list = event.currentTarget;
		const options = [...list.querySelectorAll<HTMLElement>('[role=option]')];
		const at = options.indexOf(event.target as HTMLElement);
		if (at < 0) return;
		const last = options.length - 1;
		const to =
			event.key === 'ArrowDown' || event.key === 'ArrowRight'
				? Math.min(at + 1, last)
				: event.key === 'ArrowUp' || event.key === 'ArrowLeft'
					? Math.max(at - 1, 0)
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: -1;
		if (to < 0) return;
		event.preventDefault();
		const target = options[to];
		if (!target) return;
		setRoving({ ...roving, [id]: target.dataset.kind ?? '' });
		target.focus();
	};

	return (
		<div className={styles.panel} ref={panel}>
			{sections.map(({ id, brushes }) => {
				const open = !folded.has(id);
				const headingId = `${base}-${id}-h`;
				const bodyId = `${base}-${id}-b`;
				const chosen = brushes.find((entry) => sameBrush(entry, brush));
				const stop = brushes.find((entry) => entry.kind === roving[id]) ?? chosen ?? brushes[0];
				return (
					<div key={id} role="group" aria-labelledby={headingId} className={styles.section}>
						<h3 className={styles.heading} id={headingId}>
							<button
								type="button"
								className={styles.fold}
								aria-expanded={open}
								aria-controls={bodyId}
								onClick={() => toggle(id)}
							>
								<span className={styles.chevron} aria-hidden="true" />
								{t(SECTION_LABELS[id])}
							</button>
						</h3>
						<div id={bodyId} hidden={!open}>
							{id === 'treats' && (
								<SpacingStepper
									spacing={spacing}
									onSpacing={onSpacing}
									active={brush.group === 'item'}
								/>
							)}
							<div
								role="listbox"
								aria-labelledby={headingId}
								className={styles.list}
								onKeyDown={(event) => onKeyDown(event, id)}
							>
								{brushes.map((entry) => (
									<button
										key={`${entry.group}:${entry.kind}`}
										type="button"
										role="option"
										className={styles.entry}
										aria-selected={sameBrush(brush, entry)}
										tabIndex={stop && sameBrush(stop, entry) ? 0 : -1}
										data-group={entry.group}
										data-kind={entry.kind}
										title={noteOf(entry)}
										onClick={() => {
											setRoving({ ...roving, [id]: entry.kind });
											onBrush(entry);
										}}
									>
										<span className={styles.swatch} style={brushSwatch(entry)} aria-hidden="true">
											{entry.kind.charAt(0).toUpperCase()}
										</span>
										<span className={styles.name}>{entry.kind}</span>
									</button>
								))}
							</div>
						</div>
					</div>
				);
			})}
			{docs.length === 0 && <p className={styles.note}>{t('palette.unavailable')}</p>}
		</div>
	);
}
