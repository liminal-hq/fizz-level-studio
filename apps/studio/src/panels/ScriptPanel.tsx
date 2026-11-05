// A read-only view of the level's script with line numbers and its problems linked to their lines
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import type { ViewDiagnostic } from '@liminal-hq/fizz-studio-protocol/generated/ViewDiagnostic';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/messages';
import { LineComposer } from './LineComposer';
import styles from './ScriptPanel.module.css';

export interface ScriptPanelProps {
	/** `LevelSnapshot.text`, shown exactly as it is. */
	text: string;
	diagnostics: readonly ViewDiagnostic[];
	/** A line (counted from 1) to mark and bring into view, such as one chosen elsewhere. */
	focusLine?: number | null;
	/** The documented words, from the backend; when given, a field offers completion from them. */
	words?: readonly WordDoc[];
}

/** The script's lines. A trailing newline ends the last line rather than starting an empty one. */
export function scriptLines(text: string): string[] {
	if (text === '') return [];
	const lines = text.split('\n');
	if (lines[lines.length - 1] === '') lines.pop();
	return lines;
}

/**
 * The script as plain text with line numbers. It highlights nothing it does not parse: the only
 * marks are the lines named by a problem and the line the person chose.
 */
export function ScriptPanel({ text, diagnostics, focusLine = null, words }: ScriptPanelProps) {
	const lines = scriptLines(text);
	const [chosen, setChosen] = useState<number | null>(null);
	const lineRefs = useRef(new Map<number, HTMLLIElement>());
	const active = chosen ?? focusLine;
	const problemLines = new Set(diagnostics.map((problem) => problem.line));

	useEffect(() => {
		if (focusLine !== null) setChosen(focusLine);
	}, [focusLine]);

	useEffect(() => {
		if (chosen === null) return;
		const element = lineRefs.current.get(chosen);
		element?.scrollIntoView?.({ block: 'nearest' });
	}, [chosen]);

	return (
		<section className={styles.panel} aria-labelledby="script-panel-title">
			<h2 id="script-panel-title" className={styles.title}>
				{t('script.title')}
			</h2>
			<ol className={styles.text} aria-label={t('script.text')}>
				{lines.map((line, index) => {
					const number = index + 1;
					const classes = [styles.line];
					if (problemLines.has(number)) classes.push(styles.problem);
					if (active === number) classes.push(styles.active);
					return (
						<li
							key={number}
							className={classes.join(' ')}
							value={number}
							tabIndex={-1}
							ref={(element) => {
								if (element) lineRefs.current.set(number, element);
								else lineRefs.current.delete(number);
							}}
						>
							<span className={styles.number} aria-hidden="true">
								{number}
							</span>
							<code className={styles.code}>{line}</code>
						</li>
					);
				})}
			</ol>
			{words && words.length > 0 && <LineComposer words={words} />}
			<h3 className={styles.subtitle}>{t('script.diagnostics')}</h3>
			{diagnostics.length === 0 ? (
				<p className={styles.none}>{t('script.noProblems')}</p>
			) : (
				<ul className={styles.problems} role="list">
					{diagnostics.map((problem, index) => (
						<li key={`${problem.line}-${problem.code}-${index}`}>
							<button
								type="button"
								className={styles.link}
								onClick={() => {
									setChosen(problem.line);
									lineRefs.current.get(problem.line)?.focus();
								}}
							>
								{t('script.problem', {
									line: problem.line,
									code: problem.code,
									message: problem.message,
								})}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
