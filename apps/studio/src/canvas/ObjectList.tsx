// A focusable list of the level's items, spawns, start and problems, beside the canvas
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { isContextMenuKey, useContextMenu } from '../app/useContextMenu';
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
	/** The thing the row stands for, counted in this view's own lists. */
	thing: Thing;
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
	const menu = useContextMenu();
	const choose = (cell: Cell, thing: Thing) => {
		onSelectCell(cell);
		onSelectThing?.(thing);
	};
	const rows: Row[] = [];
	const push = (row: Omit<Row, 'choose'>, cell: Cell) =>
		rows.push({ ...row, choose: () => choose(cell, row.thing) });
	const start = view.start;
	if (start) {
		const cell = { x: start.x, y: start.y };
		push(
			{
				key: 'start',
				kind: 'start',
				index: 0,
				text: t('objects.start', { x: start.x, y: start.y }),
				name: 'start',
				line: start.line,
				thing: {
					kind: 'start',
					name: 'start',
					...cell,
					layer: 'objects',
					index: 0,
					line: start.line,
				},
			},
			cell,
		);
	}
	view.items.forEach((item, index) =>
		push(
			{
				key: `item-${index}`,
				kind: 'item',
				index,
				text: t('objects.item', { kind: item.kind, x: item.x, y: item.y }),
				name: item.kind,
				line: item.line,
				thing: {
					kind: 'item',
					name: item.kind,
					x: item.x,
					y: item.y,
					layer: 'objects',
					index,
					line: item.line,
				},
			},
			{ x: item.x, y: item.y },
		),
	);
	view.spawns.forEach((spawn, index) => {
		const cell = spawnCell(view, spawn);
		push(
			{
				key: `spawn-${index}`,
				kind: 'enemy',
				index,
				text:
					spawn.y === null
						? t('objects.spawnGround', { kind: spawn.kind, x: spawn.x })
						: t('objects.spawn', { kind: spawn.kind, x: spawn.x, y: spawn.y }),
				name: spawn.kind,
				line: spawn.line,
				thing: {
					kind: 'enemy',
					name: spawn.kind,
					...cell,
					layer: 'objects',
					index,
					line: spawn.line,
				},
			},
			cell,
		);
	});

	// A right-click (or the Menu key) on a row selects its thing, unless it is already selected, then
	// opens the same menu the thing has on the canvas, with Show on the canvas. It does not move the
	// cursor: that is what Show on the canvas is for.
	const openMenu = (
		row: Row,
		at: { x: number; y: number } | HTMLElement,
		focus: HTMLElement | null,
		keyboard: boolean,
	) => {
		const chosen = selected !== null && selected.kind === row.kind && selected.index === row.index;
		if (!chosen) onSelectThing?.(row.thing);
		menu.open({ kind: 'objectRow', thing: row.thing }, at, { keyboard, returnFocusTo: focus });
	};
	const onRowContextMenu = (row: Row) => (event: MouseEvent<HTMLLIElement>) => {
		event.preventDefault();
		openMenu(
			row,
			{ x: event.clientX, y: event.clientY },
			event.currentTarget.querySelector('button'),
			false,
		);
	};
	const onRowKeyDown = (row: Row) => (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!isContextMenuKey(event.nativeEvent)) return;
		event.preventDefault();
		event.stopPropagation();
		openMenu(row, event.currentTarget, event.currentTarget, true);
	};

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
					<li key={row.key} className={styles.row} onContextMenu={onRowContextMenu(row)}>
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
							onKeyDown={onRowKeyDown(row)}
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
