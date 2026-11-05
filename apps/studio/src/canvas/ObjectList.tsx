// A focusable list of the level's items, spawns, start and problems, beside the canvas
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import { t } from '../i18n/messages';
import type { Cell } from '../tools/tool';
import styles from './ObjectList.module.css';
import { restingRow } from './drawLevel';

export interface ObjectListProps {
	view: LevelView;
	/** Called with the cell of an item, spawn or start the person chose. */
	onSelectCell: (cell: Cell) => void;
	/** Called with the line of a problem the person chose. */
	onSelectLine?: (line: number) => void;
}

/**
 * Every object in the level as a button in a list, so a level can be explored and its objects
 * reached from the keyboard alone. Choosing one moves the canvas cursor to it.
 */
export function ObjectList({ view, onSelectCell, onSelectLine }: ObjectListProps) {
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
						onClick={() => view.start && onSelectCell({ x: view.start.x, y: view.start.y })}
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
						onClick={() => onSelectCell({ x: item.x, y: item.y })}
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
						onClick={() => onSelectCell({ x: spawn.x, y: spawn.y ?? restingRow(view, spawn.x) })}
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
