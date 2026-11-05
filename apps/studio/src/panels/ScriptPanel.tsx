// The script panel: the level's script in an editor, with its problems listed and linked to lines
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ViewDiagnostic } from '@liminal-hq/fizz-studio-protocol/generated/ViewDiagnostic';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/messages';
import { LineComposer } from './LineComposer';
import styles from './ScriptPanel.module.css';
import { ScriptEditor, type RevealRequest } from './script/ScriptEditor';

export interface ScriptPanelProps {
	/** `LevelSnapshot.text`, shown exactly as it is. */
	text: string;
	diagnostics: readonly ViewDiagnostic[];
	/** The documented words, from the backend, for hover text and completion. */
	words?: readonly WordDoc[];
	/** A line (counted from 1) to mark and bring into view, such as one chosen elsewhere. */
	focusLine?: number | null;
	/** Changes each time `focusLine` is asked for, so choosing the same line again shows it again. */
	focusSerial?: number;
	/** True once the backend can take a typed change. Until then the script is read-only. */
	editable?: boolean;
	/** Shows a Tear off button that calls this; left out where the panel cannot be torn off. */
	onTearOff?: () => void;
}

const NO_WORDS: readonly WordDoc[] = [];

/**
 * The script in a code editor with line numbers, find, folding, hover documentation and the
 * parser's problems marked on their lines. Below it, each problem is a button that marks its line
 * and moves the keyboard into the editor there.
 */
export function ScriptPanel({
	text,
	diagnostics,
	words = NO_WORDS,
	focusLine = null,
	focusSerial = 0,
	editable = false,
	onTearOff,
}: ScriptPanelProps) {
	const [reveal, setReveal] = useState<RevealRequest | null>(null);
	const serial = useRef(0);

	const ask = (line: number, focus: boolean) => {
		serial.current += 1;
		setReveal({ line, serial: serial.current, focus });
	};

	useEffect(() => {
		if (focusLine !== null) {
			serial.current += 1;
			setReveal({ line: focusLine, serial: serial.current, focus: false });
		}
	}, [focusLine, focusSerial]);

	return (
		<section className={styles.panel} aria-labelledby="script-panel-title">
			<div className={styles.header}>
				<h2 id="script-panel-title" className={styles.title}>
					{t('script.title')}
				</h2>
				{onTearOff && (
					<button type="button" className={styles.tearOff} onClick={onTearOff}>
						{t('panel.tearOff')}
					</button>
				)}
			</div>
			<ScriptEditor
				className={styles.editor}
				text={text}
				diagnostics={diagnostics}
				words={words}
				reveal={reveal}
				editable={editable}
			/>
			{words.length > 0 && <LineComposer words={words} />}
			<h3 className={styles.subtitle}>{t('script.diagnostics')}</h3>
			{diagnostics.length === 0 ? (
				<p className={styles.none}>{t('script.noProblems')}</p>
			) : (
				<ul className={styles.problems} role="list">
					{diagnostics.map((problem, index) => (
						<li key={`${problem.line}-${problem.code}-${index}`}>
							<button type="button" className={styles.link} onClick={() => ask(problem.line, true)}>
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
