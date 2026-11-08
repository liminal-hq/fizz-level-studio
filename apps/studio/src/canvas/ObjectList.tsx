// A focusable list of the level's items, spawns, start and problems, beside the canvas
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
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
}

/**
 * Every object in the level as a button in a list, so a level can be explored and its objects
 * reached from the keyboard alone. Choosing one moves the canvas cursor to it.
 */
export function ObjectList({ view, onSelectCell, onSelectThing, onSelectLine }: ObjectListProps) {
	const choose = (cell: Cell, thing: Thing) => {
		onSelectCell(cell);
		onSelectThing?.(thing);
	};
	const empty =
		view.items.length === 0 &&
		view.spawns.length === 0 &&
		view.start === null &&
		view.diagnostics.length === 0;
	return (
		<ul className={styles.list} role="list" aria-label={t('objects.list')}>
			{view.start && (
				<li>
					<button
						type="button"
						className={styles.entry}
						onClick={() => {
							const start = view.start;
							if (!start) return;
							const cell = { x: start.x, y: start.y };
							choose(cell, {
								kind: 'start',
								name: 'start',
								...cell,
								layer: 'objects',
								index: 0,
								line: start.line,
							});
						}}
					>
						{t('objects.start', { x: view.start.x, y: view.start.y })}
					</button>
				</li>
			)}
			{view.items.map((item, index) => (
				<li key={`item-${index}`}>
					<button
						type="button"
						className={styles.entry}
						onClick={() =>
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
							)
						}
					>
						{t('objects.item', { kind: item.kind, x: item.x, y: item.y })}
					</button>
				</li>
			))}
			{view.spawns.map((spawn, index) => (
				<li key={`spawn-${index}`}>
					<button
						type="button"
						className={styles.entry}
						onClick={() => {
							const cell = spawnCell(view, spawn);
							choose(cell, {
								kind: 'enemy',
								name: spawn.kind,
								...cell,
								layer: 'objects',
								index,
								line: spawn.line,
							});
						}}
					>
						{spawn.y === null
							? t('objects.spawnGround', { kind: spawn.kind, x: spawn.x })
							: t('objects.spawn', { kind: spawn.kind, x: spawn.x, y: spawn.y })}
					</button>
				</li>
			))}
			{view.diagnostics.map((problem, index) => (
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
		</ul>
	);
}
