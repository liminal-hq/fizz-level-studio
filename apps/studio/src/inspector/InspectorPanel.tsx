// The Inspector panel: the selected thing's name, kind, position, facing and script line
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The Inspector reads the one selection the editor holds and draws the entry of the level's own
// view that it points to, so what it shows is always the level as Rust describes it. Nothing here
// decides what may change: a thing Rust cannot edit is shown with the reason.

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { ViewSpawn } from '@liminal-hq/fizz-studio-protocol/generated/ViewSpawn';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useEffect, useState } from 'react';
import { t, type MessageId } from '../i18n/messages';
import { spawnCell, type Thing } from '../tools/tool';
import styles from './InspectorPanel.module.css';

export interface InspectorPanelProps {
	snapshot: LevelSnapshot;
	/** The selection, or null when nothing is selected. */
	thing: Thing | null;
	/** The documented words, for the quick help under the name. */
	words: readonly WordDoc[];
	/** Shows a script line (from 1) in the Script panel. */
	onShowLine: (line: number) => void;
	/** The script line that last set a cell, for a selected cell; null when none did. */
	lookupCellLine?: (x: number, y: number) => Promise<number | null>;
}

/** A number as written in the script: whole numbers bare, a fraction as it is. */
export function coordText(value: number): string {
	return String(value);
}

/** The word with its first letter capitalised, for a heading. */
function capitalised(word: string): string {
	return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

/** The entry of the level's own view that `thing` points to, or null where it is no longer there. */
function entryOf(view: LevelView, thing: Thing) {
	if (thing.kind === 'item') return view.items[thing.index] ?? null;
	if (thing.kind === 'enemy') return view.spawns[thing.index] ?? null;
	if (thing.kind === 'start') return view.start;
	return null;
}

/** The facing a spawn shows: its `dir`, or the Builder's default, left, when it has none. */
function facingOf(spawn: ViewSpawn): 'left' | 'right' {
	return spawn.dir !== null && spawn.dir > 0 ? 'right' : 'left';
}

export function InspectorPanel({
	snapshot,
	thing,
	words,
	onShowLine,
	lookupCellLine,
}: InspectorPanelProps) {
	const view = snapshot.view;
	const cellX = thing?.kind === 'cell' ? thing.x : null;
	const cellY = thing?.kind === 'cell' ? thing.y : null;
	const revision = snapshot.revision;
	const [cellLine, setCellLine] = useState<number | null>(null);
	useEffect(() => {
		setCellLine(null);
		if (cellX === null || cellY === null || !lookupCellLine) return;
		let current = true;
		lookupCellLine(cellX, cellY).then(
			(line) => current && setCellLine(line),
			() => current && setCellLine(null),
		);
		return () => {
			current = false;
		};
	}, [cellX, cellY, lookupCellLine, revision]);

	if (!thing) {
		return (
			<div className={styles.panel} role="group" aria-label={t('inspector.group')}>
				<p className={styles.empty}>{t('inspector.empty')}</p>
			</div>
		);
	}
	if (thing.kind === 'cell') {
		return (
			<div className={styles.panel} role="group" aria-label={t('inspector.group')}>
				<h3 className={styles.heading}>
					{t('inspector.cell', { x: thing.x, y: thing.y, tile: thing.name })}
				</h3>
				<p className={styles.note}>{t('inspector.cellNote')}</p>
				<LineRow line={cellLine} onShowLine={onShowLine} />
			</div>
		);
	}
	const entry = entryOf(view, thing);
	if (!entry) {
		return (
			<div className={styles.panel} role="group" aria-label={t('inspector.group')}>
				<p className={styles.empty}>{t('inspector.empty')}</p>
			</div>
		);
	}
	const fizz2 = snapshot.target === 'fizz2';
	const kindLabel = t(`inspector.kind.${thing.kind}` as MessageId);
	const heading =
		thing.kind === 'start'
			? t('inspector.startName')
			: t('inspector.heading', { name: capitalised(thing.name), kind: kindLabel });
	const help =
		thing.kind === 'start' ? undefined : words.find((word) => word.word === thing.name)?.note;
	const spawn = thing.kind === 'enemy' ? (view.spawns[thing.index] ?? null) : null;
	const item = thing.kind === 'item' ? (view.items[thing.index] ?? null) : null;
	const generator = item?.generator ?? null;
	// A ground-relative spawn shows the row it stands on.
	const shownY = spawn ? (spawn.y ?? spawnCell(view, spawn).y) : (item?.y ?? view.start?.y ?? 0);
	return (
		<div className={styles.panel} role="group" aria-label={t('inspector.group')}>
			<h3 className={styles.heading}>{heading}</h3>
			{help && <p className={styles.help}>{help}</p>}
			<dl className={styles.fields}>
				<dt>{t('inspector.x')}</dt>
				<dd>{coordText(entry.x)}</dd>
				<dt>{t('inspector.y')}</dt>
				<dd>
					{coordText(shownY)}
					{spawn?.on_ground && <span className={styles.hint}> {t('inspector.ground')}</span>}
				</dd>
				{spawn && (
					<>
						<dt>{t('inspector.facing')}</dt>
						<dd>
							{spawn.ride
								? t('inspector.noFacing')
								: facingOf(spawn) === 'left'
									? t('inspector.left')
									: t('inspector.right')}
						</dd>
					</>
				)}
			</dl>
			{generator !== null && item && (
				<p className={styles.note}>
					{t('inspector.generated', { generator, line: item.line ?? 0 })}
				</p>
			)}
			{fizz2 && <p className={styles.note}>{t('inspector.fizz2')}</p>}
			<LineRow line={entry.line} onShowLine={onShowLine} />
		</div>
	);
}

function LineRow({
	line,
	onShowLine,
}: {
	line: number | null;
	onShowLine: (line: number) => void;
}) {
	if (line === null) return null;
	return (
		<div className={styles.lineRow}>
			<span>{t('inspector.line', { line })}</span>
			<button type="button" className={styles.key} onClick={() => onShowLine(line)}>
				{t('inspector.showInScript')}
			</button>
		</div>
	);
}
