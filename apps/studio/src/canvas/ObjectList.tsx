// A focusable list of the level's items, spawns, start and problems, beside the canvas
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { useState } from 'react';
import { t } from '../i18n/messages';
import { spawnCell, type Cell, type Thing } from '../tools/tool';
import styles from './ObjectList.module.css';

export interface ObjectListProps {
	view: LevelView;
	/** Called with the cell of an item, spawn or start the person chose. */
	onSelectCell: (cell: Cell) => void;
	/** Called with the thing the person chose, counted in this view's own lists. */
	onSelectThing?: (thing: Thing) => void;
	/** Called with the line of a problem the person chose. */
	onSelectLine?: (line: number) => void;
	/** The thing now selected, whose row is marked. */
	selected?: Thing | null;
}

/** One row of the list: what it says, what it is, where its line is and what choosing it does. */
interface Row {
	key: string;
	kind: 'start' | 'item' | 'enemy';
	index: number;
	text: string;
	name: string;
	line: number | null;
	choose: () => void;
}

/**
 * Every object in the level as a button in a list, so a level can be explored and its objects
 * reached from the keyboard alone. Choosing one moves the canvas cursor to it and selects it for the
 * Inspector; each row shows the script line it is on, and the filter above narrows the list by what
 * a thing is, its name or its line.
 */
export function ObjectList({
	view,
	onSelectCell,
	onSelectThing,
	onSelectLine,
	selected = null,
}: ObjectListProps) {
	const [filter, setFilter] = useState('');
	const choose = (cell: Cell, thing: Thing) => {
		onSelectCell(cell);
		onSelectThing?.(thing);
	};
	const rows: Row[] = [];
	const start = view.start;
	if (start) {
		const cell = { x: start.x, y: start.y };
		rows.push({
			key: 'start',
			kind: 'start',
			index: 0,
			text: t('objects.start', { x: start.x, y: start.y }),
			name: 'start',
			line: start.line,
			choose: () =>
				choose(cell, {
					kind: 'start',
					name: 'start',
					...cell,
					layer: 'objects',
					index: 0,
					line: start.line,
				}),
		});
	}
	view.items.forEach((item, index) =>
		rows.push({
			key: `item-${index}`,
			kind: 'item',
			index,
			text: t('objects.item', { kind: item.kind, x: item.x, y: item.y }),
			name: item.kind,
			line: item.line,
			choose: () =>
				choose(
					{ x: item.x, y: item.y },
					{
						kind: 'item',
						name: item.kind,
						x: item.x,
						y: item.y,
						layer: 'objects',
						index,
						line: item.line,
					},
				),
		}),
	);
	view.spawns.forEach((spawn, index) =>
		rows.push({
			key: `spawn-${index}`,
			kind: 'enemy',
			index,
			text:
				spawn.y === null
					? t('objects.spawnGround', { kind: spawn.kind, x: spawn.x })
					: t('objects.spawn', { kind: spawn.kind, x: spawn.x, y: spawn.y }),
			name: spawn.kind,
			line: spawn.line,
			choose: () => {
				const cell = spawnCell(view, spawn);
				choose(cell, {
					kind: 'enemy',
					name: spawn.kind,
					...cell,
					layer: 'objects',
					index,
					line: spawn.line,
				});
			},
		}),
	);

	// A row matches when what is typed is in its kind, its name, its text or its line number.
	const needle = filter.trim().toLocaleLowerCase();
	const matches = (...words: Array<string | number | null>) =>
		needle === '' ||
		words
			.filter((word) => word !== null)
			.join(' ')
			.toLocaleLowerCase()
			.includes(needle);
	const shown = rows.filter((row) =>
		matches(
			row.name,
			t(`inspector.kind.${row.kind}`),
			row.text,
			row.line,
			t('objects.line', { line: row.line ?? 0 }),
		),
	);
	const problems = view.diagnostics.filter((problem) =>
		matches(problem.code, problem.message, problem.line, t('objects.line', { line: problem.line })),
	);
	const empty = rows.length === 0 && view.diagnostics.length === 0;
	const nothingMatches = !empty && shown.length === 0 && problems.length === 0;
	return (
		<div className={styles.panel}>
			<input
				type="search"
				className={styles.filter}
				value={filter}
				placeholder={t('objects.filter')}
				aria-label={t('objects.filter')}
				onChange={(event) => setFilter(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Escape' && filter !== '') {
						event.preventDefault();
						event.stopPropagation();
						setFilter('');
					}
				}}
			/>
			<ul className={styles.list} role="list" aria-label={t('objects.list')}>
				{shown.map((row) => (
					<li key={row.key} className={styles.row}>
						<span className={`${styles.glyph} ${styles[row.kind]}`} aria-hidden="true" />
						<button
							type="button"
							className={styles.entry}
							aria-current={
								selected && selected.kind === row.kind && selected.index === row.index
									? 'true'
									: undefined
							}
							onClick={row.choose}
						>
							{row.text}
						</button>
						{row.line !== null && (
							<span className={styles.line}>{t('objects.line', { line: row.line })}</span>
						)}
					</li>
				))}
				{problems.map((problem, index) => (
					<li key={`problem-${index}`}>
						<button
							type="button"
							className={`${styles.entry} ${styles.problem}`}
							onClick={() => onSelectLine?.(problem.line)}
						>
							{t('objects.diagnostic', {
								line: problem.line,
								code: problem.code,
								message: problem.message,
							})}
						</button>
					</li>
				))}
				{empty && <li className={styles.none}>{t('objects.none')}</li>}
				{nothingMatches && (
					<li className={styles.none}>{t('objects.noMatch', { filter: filter.trim() })}</li>
				)}
			</ul>
		</div>
	);
}
