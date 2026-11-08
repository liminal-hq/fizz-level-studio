// A labelled number field with Decrease and Increase keycaps, for a thing's x or y
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Arrows step by one, Page Up and Page Down by ten, Home and End go to the ends, Enter or leaving
// the field commits what was typed, and Escape puts back what was there. A press commits at once, so
// a run of presses is a run of edits that the caller merges into one undo step. The field shows the
// value the level has, not what was last asked for: a refused edit leaves it where it was.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../i18n/messages';
import { Tooltip } from '../ui/Tooltip';
import styles from './CoordField.module.css';

export interface CoordFieldProps {
	/** The field's visible label and the word in its button names: `x` or `y`. */
	label: string;
	/** The value the level has. */
	value: number;
	min: number;
	max: number;
	/** True when only whole numbers make sense (an item sits on a cell). */
	whole: boolean;
	/**
	 * Called with the new value, always inside `min` to `max`, and never with the current one. It may
	 * answer a promise that settles when the level has taken or refused the change, so the field knows
	 * when what it asked for is no longer pending.
	 */
	onCommit: (value: number) => void | Promise<unknown>;
	disabled?: boolean;
}

/** The value as typed text: a whole number bare, a fraction as it is. */
function text(value: number): string {
	return String(value);
}

export function CoordField({ label, value, min, max, whole, onCommit, disabled }: CoordFieldProps) {
	const id = useId();
	// What the person is typing, or null while the field shows the level's value.
	const [draft, setDraft] = useState<string | null>(null);
	// The last value asked for and not yet seen in the level, so a quick run of presses counts on
	// from the last press rather than from a value that has not come back yet.
	const asked = useRef<number | null>(null);
	const pending = useRef(0);
	useEffect(() => {
		// The level caught up with what was asked: nothing more is waited for.
		if (pending.current === 0) asked.current = null;
	}, [value]);

	const clamp = (n: number) => Math.min(Math.max(whole ? Math.round(n) : n, min), max);
	const commit = (n: number) => {
		const next = clamp(n);
		if (!Number.isFinite(next) || next === (asked.current ?? value)) return;
		asked.current = next;
		const answer = onCommit(next);
		if (answer && typeof answer.then === 'function') {
			pending.current += 1;
			const settled = () => {
				pending.current -= 1;
				// Once nothing is in flight the level's own value is the one to count on from.
				if (pending.current === 0) asked.current = null;
			};
			answer.then(settled, settled);
		}
	};
	const step = (by: number) => {
		setDraft(null);
		commit((asked.current ?? value) + by);
	};
	const finishDraft = () => {
		if (draft === null) return;
		setDraft(null);
		const typed = Number(draft);
		if (draft.trim() !== '' && Number.isFinite(typed)) commit(typed);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		const by: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
		if (event.key in by) {
			event.preventDefault();
			step(by[event.key]!);
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			setDraft(null);
			commit(event.key === 'Home' ? min : max);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			finishDraft();
		} else if (event.key === 'Escape' && draft !== null) {
			// Putting the typing back is this field's; the canvas keeps Escape for deselecting.
			event.preventDefault();
			event.stopPropagation();
			setDraft(null);
		}
	};
	const current = asked.current ?? value;
	return (
		<div className={styles.field}>
			<label className={styles.label} htmlFor={id}>
				{label}
			</label>
			<div className={styles.control} role="group" aria-label={label}>
				<Tooltip label={t('inspector.decrease', { axis: label })}>
					<button
						type="button"
						className={styles.step}
						aria-controls={id}
						aria-label={t('inspector.decrease', { axis: label })}
						disabled={disabled || current <= min}
						onClick={() => step(-1)}
					>
						{t('spacing.lessGlyph')}
					</button>
				</Tooltip>
				<input
					id={id}
					className={styles.input}
					type="number"
					inputMode="decimal"
					min={min}
					max={max}
					step={whole ? 1 : 'any'}
					disabled={disabled}
					value={draft ?? text(value)}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={finishDraft}
					onKeyDown={onKeyDown}
				/>
				<Tooltip label={t('inspector.increase', { axis: label })}>
					<button
						type="button"
						className={styles.step}
						aria-controls={id}
						aria-label={t('inspector.increase', { axis: label })}
						disabled={disabled || current >= max}
						onClick={() => step(1)}
					>
						{t('spacing.moreGlyph')}
					</button>
				</Tooltip>
			</div>
		</div>
	);
}
