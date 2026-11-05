// A chooser for one word, drawn in the page: a button that opens a list of options, not a native menu
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A native `<select>` opens a popup the window system owns, and on Linux the first click outside it only
// closes it, so the first click on the canvas after choosing a word painted nothing. This list is part
// of the page, so a click on the canvas is just a click on the canvas.

import { useEffect, useId, useRef, useState } from 'react';
import styles from './WordChooser.module.css';

export interface WordChooserProps {
	/** The visible name of what is chosen, such as "Tile". */
	label: string;
	value: string;
	options: readonly string[];
	onChoose: (word: string) => void;
}

export function WordChooser({ label, value, options, onChoose }: WordChooserProps) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const listId = useId();

	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent) => {
			if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener('pointerdown', close, true);
		return () => document.removeEventListener('pointerdown', close, true);
	}, [open]);

	const choose = (word: string) => {
		onChoose(word);
		setOpen(false);
	};

	return (
		<div
			className={styles.root}
			ref={root}
			onKeyDown={(event) => {
				if (event.key === 'Escape' && open) {
					event.stopPropagation();
					setOpen(false);
				}
			}}
		>
			<span className={styles.label}>{label}</span>
			<button
				type="button"
				className={styles.button}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-label={`${label}: ${value}`}
				onClick={() => setOpen((was) => !was)}
			>
				{value}
			</button>
			{open && (
				<ul id={listId} className={styles.list} role="listbox" aria-label={label}>
					{options.map((word) => (
						<li key={word} role="presentation">
							<button
								type="button"
								role="option"
								aria-selected={word === value}
								className={styles.option}
								onClick={() => choose(word)}
							>
								{word}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
