// A script line field with word completion from the language's documented words
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import {
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type ChangeEvent,
	type KeyboardEvent,
	type MouseEvent,
} from 'react';
import { t, tn, type MessageId } from '../i18n/messages';
import { acceptWord, completionsFor } from './completion';
import styles from './LineComposer.module.css';

export interface LineComposerProps {
	/** The documented words, from the backend. */
	words: readonly WordDoc[];
}

const KIND_LABELS: Record<string, MessageId> = {
	statement: 'compose.kind.statement',
	section: 'compose.kind.section',
	segment: 'compose.kind.segment',
	tile: 'compose.kind.tile',
	item: 'compose.kind.item',
	enemy: 'compose.kind.enemy',
};

/**
 * A text field that offers the words that continue what is typed. It follows the combobox pattern:
 * the field keeps focus, the suggestions are a listbox, the arrow keys move through them and Tab or
 * Enter accepts the highlighted one. Escape closes the list. It only completes; the line is not
 * sent anywhere, because the studio's edits to a script come from the tools for now.
 */
export function LineComposer({ words }: LineComposerProps) {
	const base = useId();
	const input = useRef<HTMLInputElement>(null);
	const pendingCaret = useRef<number | null>(null);
	const [text, setText] = useState('');
	const [caret, setCaret] = useState(0);
	const [active, setActive] = useState(0);
	const [dismissed, setDismissed] = useState(false);

	const completion = completionsFor(text, caret, words);
	const open = !dismissed && completion.items.length > 0;
	const highlighted = Math.min(active, Math.max(completion.items.length - 1, 0));
	const optionId = (index: number) => `${base}-option-${index}`;
	const current = open ? completion.items[highlighted] : undefined;

	useLayoutEffect(() => {
		if (pendingCaret.current === null || !input.current) return;
		input.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
		pendingCaret.current = null;
	});

	const choose = (word: string) => {
		const next = acceptWord(text, completion, word);
		setText(next.text);
		setCaret(next.caret);
		setActive(0);
		setDismissed(true);
		pendingCaret.current = next.caret;
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		setText(event.target.value);
		setCaret(event.target.selectionStart ?? event.target.value.length);
		setActive(0);
		setDismissed(false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			event.stopPropagation();
			setDismissed(true);
			return;
		}
		if (!open) return;
		const count = completion.items.length;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setActive((highlighted + 1) % count);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActive((highlighted - 1 + count) % count);
		} else if ((event.key === 'Tab' && !event.shiftKey) || event.key === 'Enter') {
			if (!current) return;
			event.preventDefault();
			choose(current.word);
		}
	};

	// The caret moves without the text changing (arrow keys, a click), which can change the word.
	const followCaret = (event: { currentTarget: HTMLInputElement }) => {
		const next = event.currentTarget.selectionStart ?? text.length;
		if (next !== caret) {
			setCaret(next);
			setActive(0);
			setDismissed(false);
		}
	};

	const keepFocus = (event: MouseEvent) => event.preventDefault();
	const kindLabel = (kind: string) => (KIND_LABELS[kind] ? t(KIND_LABELS[kind]) : kind);

	return (
		<div className={styles.composer}>
			<label className={styles.label} htmlFor={`${base}-input`}>
				{t('compose.label')}
			</label>
			<input
				ref={input}
				id={`${base}-input`}
				className={styles.input}
				type="text"
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={`${base}-list`}
				aria-activedescendant={current ? optionId(highlighted) : undefined}
				aria-describedby={`${base}-hint`}
				autoComplete="off"
				spellCheck={false}
				value={text}
				onChange={onChange}
				onKeyDown={onKeyDown}
				onKeyUp={followCaret}
				onClick={followCaret}
			/>
			<p id={`${base}-hint`} className={styles.hint}>
				{t('compose.hint')}
			</p>
			<ul
				id={`${base}-list`}
				className={styles.list}
				role="listbox"
				aria-label={t('compose.suggestions')}
				hidden={!open}
			>
				{open &&
					completion.items.map((doc, index) => (
						<li
							key={`${doc.kind}-${doc.word}`}
							id={optionId(index)}
							className={styles.option}
							role="option"
							aria-selected={index === highlighted}
							onMouseDown={keepFocus}
							onClick={() => {
								choose(doc.word);
								input.current?.focus();
							}}
						>
							<span className={styles.word}>{doc.word}</span>
							<span className={styles.kind}>{kindLabel(doc.kind)}</span>
						</li>
					))}
			</ul>
			<p className={styles.syntax} role="status">
				{open ? (
					<>
						<span className={styles.count}>{tn('compose.count', completion.items.length)}</span>
						{current && <code>{current.syntax}</code>}
					</>
				) : null}
			</p>
		</div>
	);
}
