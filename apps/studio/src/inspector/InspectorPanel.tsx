// The Inspector panel: the selected thing's name, kind, position, facing and script line, and the
// controls that change them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The Inspector reads the one selection the editor holds and draws the entry of the level's own
// view that it points to, so what it shows is always the level as Rust describes it. It never
// decides what may change: it sends what the person asked for, and shows Rust's refusal under the
// fields when there is one. A thing Rust cannot edit (an item a generator made, a Fizz 2 level) is
// shown with the reason and no controls.

import type { LevelSnapshot } from '@liminal-hq/fizz-studio-protocol/generated/LevelSnapshot';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { ViewSpawn } from '@liminal-hq/fizz-studio-protocol/generated/ViewSpawn';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useCallback, useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { t, type MessageId } from '../i18n/messages';
import { spawnCell, type Thing } from '../tools/tool';
import { CoordField } from './CoordField';
import { entryOf } from './selectionFacts';
import styles from './InspectorPanel.module.css';
import {
	moveKey,
	type EditProblem,
	type ThingEditApi,
	type ThingEditResult,
	type ThingEditSpec,
} from './thingEdit';

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
	/** Changes the selected thing. Without it the panel only shows. */
	edit?: ThingEditApi;
	/** The word of the thing deleted last, shown with how to undo it until something is selected again. */
	deleted?: string | null;
}

/** A number as written in the script: whole numbers bare, a fraction as it is. */
export function coordText(value: number): string {
	return String(value);
}

/** The word with its first letter capitalised, for a heading. */
function capitalised(word: string): string {
	return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

/** The facing a spawn shows: its `dir`, or the Builder's default, left, when it has none. */
function facingOf(spawn: ViewSpawn): 'left' | 'right' {
	return spawn.dir !== null && spawn.dir > 0 ? 'right' : 'left';
}

/** How many other items and enemies share the cell the thing is on. */
function othersOnCell(view: LevelView, thing: Thing, cell: { x: number; y: number }): number {
	const here = (x: number, y: number) => Math.floor(x) === cell.x && Math.floor(y) === cell.y;
	const items = view.items.filter(
		(item, index) => !(thing.kind === 'item' && index === thing.index) && here(item.x, item.y),
	).length;
	const spawns = view.spawns.filter((spawn, index) => {
		if (thing.kind === 'enemy' && index === thing.index) return false;
		const at = spawnCell(view, spawn);
		return at.x === cell.x && at.y === cell.y;
	}).length;
	return items + spawns;
}

export function InspectorPanel({
	snapshot,
	thing,
	words,
	onShowLine,
	lookupCellLine,
	edit,
	deleted = null,
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

	// A refusal stays under the fields until the person chooses another thing or tries again.
	const [problem, setProblem] = useState<EditProblem | null>(null);
	const burst = useRef(0);
	// Whether a change has been sent since the last time the run ended: only then is there a step to end.
	const running = useRef(false);
	const endStep = edit?.endStep;
	const endRun = useCallback(() => {
		if (!running.current) return;
		running.current = false;
		burst.current += 1;
		endStep?.();
	}, [endStep]);
	const identity = thing ? `${thing.kind}:${thing.index}` : null;
	useEffect(() => {
		setProblem(null);
		return () => {
			if (identity !== null) endRun();
		};
	}, [identity, endRun]);
	// The run of presses that is open ends when focus leaves the fields.
	const onBlur = (event: FocusEvent<HTMLDivElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget)) endRun();
	};

	const send = (spec: ThingEditSpec, then?: (result: ThingEditResult) => void): Promise<void> => {
		if (!edit || !thing) return Promise.resolve();
		setProblem(null);
		running.current = true;
		return edit.apply(spec, moveKey(thing, burst.current)).then((result) => {
			if (!result.ok) setProblem(result.problem);
			then?.(result);
		});
	};

	const emptyState = (
		<>
			{deleted !== null && (
				<p className={styles.note} role="status">
					{t('inspector.deleted', { name: deleted })}
				</p>
			)}
			<p className={styles.empty}>{t('inspector.empty')}</p>
		</>
	);
	if (!thing) {
		return (
			<div
				className={styles.panel}
				role="group"
				aria-label={t('inspector.group')}
				data-inspector-scope=""
			>
				{emptyState}
			</div>
		);
	}
	if (thing.kind === 'cell') {
		return (
			<div
				className={styles.panel}
				role="group"
				aria-label={t('inspector.group')}
				data-inspector-scope=""
			>
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
			<div
				className={styles.panel}
				role="group"
				aria-label={t('inspector.group')}
				data-inspector-scope=""
			>
				{emptyState}
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
	const editable = edit !== undefined && !fizz2 && generator === null && entry.line !== null;
	const whole = thing.kind === 'item';
	const maxX = view.width - 1;
	const maxY = view.height - 1;
	const others = othersOnCell(view, thing, { x: Math.floor(entry.x), y: Math.floor(shownY) });
	// What stays put when one axis moves: an enemy with no row keeps standing on the ground.
	const keptY = spawn ? spawn.y : shownY;
	const facing = spawn ? facingOf(spawn) : null;
	return (
		<div
			className={styles.panel}
			role="group"
			aria-label={t('inspector.group')}
			onBlur={onBlur}
			data-inspector-scope=""
		>
			<h3 className={styles.heading}>{heading}</h3>
			{help && <p className={styles.help}>{help}</p>}
			<div className={styles.fields}>
				{editable ? (
					<>
						<CoordField
							label={t('inspector.x')}
							value={entry.x}
							min={0}
							max={maxX}
							whole={whole}
							onCommit={(x) => send({ op: 'move', x, y: keptY })}
						/>
						<CoordField
							label={t('inspector.y')}
							value={shownY}
							min={0}
							max={maxY}
							whole={whole}
							onCommit={(y) => send({ op: 'move', x: entry.x, y })}
						/>
					</>
				) : (
					<>
						<span className={styles.label}>{t('inspector.x')}</span>
						<span className={styles.value}>{coordText(entry.x)}</span>
						<span className={styles.label}>{t('inspector.y')}</span>
						<span className={styles.value}>{coordText(shownY)}</span>
					</>
				)}
				{spawn && (
					<div className={styles.ground}>
						{spawn.on_ground ? (
							<span className={styles.hint}>{t('inspector.ground')}</span>
						) : (
							editable && (
								<button
									type="button"
									className={styles.key}
									onClick={() => send({ op: 'move', x: spawn.x, y: null })}
								>
									{t('inspector.onGround')}
								</button>
							)
						)}
					</div>
				)}
				{spawn && facing && (
					<>
						<span className={styles.label}>{t('inspector.facing')}</span>
						{editable && !spawn.ride ? (
							<div className={styles.facing} role="group" aria-label={t('inspector.facingGroup')}>
								{(['left', 'right'] as const).map((way) => (
									<button
										key={way}
										type="button"
										className={styles.key}
										aria-pressed={facing === way}
										onClick={() => send({ op: 'face', facing: way })}
									>
										{way === 'left' ? t('inspector.left') : t('inspector.right')}
									</button>
								))}
							</div>
						) : (
							<span className={styles.value}>
								{spawn.ride
									? t('inspector.noFacing')
									: facing === 'left'
										? t('inspector.left')
										: t('inspector.right')}
							</span>
						)}
					</>
				)}
			</div>
			{others > 0 && (
				<p className={styles.warning} role="status">
					{t('inspector.overlap')}
				</p>
			)}
			{generator !== null && item && (
				<p className={styles.note}>
					{t('inspector.generated', { generator, line: item.line ?? 0 })}
				</p>
			)}
			{fizz2 && <p className={styles.note}>{t('inspector.fizz2')}</p>}
			{problem && (
				<p className={styles.error} role="alert">
					{'text' in problem ? problem.text : t(problem.id, problem.values)}
				</p>
			)}
			<LineRow line={entry.line} onShowLine={onShowLine}>
				{edit && !fizz2 && (
					<DeleteKey
						startSelected={thing.kind === 'start'}
						blocked={generator !== null || entry.line === null}
						onDelete={() =>
							send({ op: 'delete' }, (result) => {
								if (result.ok) endRun();
							})
						}
					/>
				)}
			</LineRow>
		</div>
	);
}

function DeleteKey({
	startSelected,
	blocked,
	onDelete,
}: {
	startSelected: boolean;
	blocked: boolean;
	onDelete: () => void;
}) {
	const disabled = startSelected || blocked;
	return (
		<>
			{startSelected && <span className={styles.hint}>{t('inspector.deleteStart')}</span>}
			<button type="button" className={styles.key} disabled={disabled} onClick={onDelete}>
				{t('inspector.delete')}
			</button>
		</>
	);
}

function LineRow({
	line,
	onShowLine,
	children,
}: {
	line: number | null;
	onShowLine: (line: number) => void;
	children?: ReactNode;
}) {
	if (line === null && !children) return null;
	return (
		<div className={styles.lineRow}>
			{line !== null && <span>{t('inspector.line', { line })}</span>}
			<div className={styles.keys}>
				{line !== null && (
					<button type="button" className={styles.key} onClick={() => onShowLine(line)}>
						{t('inspector.showInScript')}
					</button>
				)}
				{children}
			</div>
		</div>
	);
}
