// The script panel: the level's script in an editor, with its problems listed and linked to lines
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ViewDiagnostic } from '@liminal-hq/fizz-studio-protocol/generated/ViewDiagnostic';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { selectAll } from '@codemirror/commands';
import { foldAll, unfoldAll } from '@codemirror/language';
import { openSearchPanel } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import { useCommandBridge } from '../commands/commandBridge';
import {
	SCRIPT_COPY,
	SCRIPT_FIND,
	SCRIPT_FOLD_ALL,
	SCRIPT_SELECT_ALL,
	SCRIPT_UNFOLD_ALL,
} from '../commands/scriptCommands';
import { t } from '../i18n/messages';
import styles from './ScriptPanel.module.css';
import { ScriptEditor, type RevealRequest } from './script/ScriptEditor';

export interface ScriptPanelProps {
	/** `LevelSnapshot.text`, shown exactly as it is. */
	text: string;
	diagnostics: readonly ViewDiagnostic[];
	/** The documented words, from the backend, for hover text. */
	words?: readonly WordDoc[];
	/** A line (counted from 1) to mark and bring into view, such as one chosen elsewhere. */
	focusLine?: number | null;
	/** Changes each time `focusLine` is asked for, so choosing the same line again shows it again. */
	focusSerial?: number;
	/** True once the backend can take a typed change. Until then the script is read-only. */
	editable?: boolean;
}

const NO_WORDS: readonly WordDoc[] = [];

/**
 * The script in a code editor that fills the panel (the panel's owner sizes it) with line numbers, find, folding, hover documentation and the
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
}: ScriptPanelProps) {
	const [reveal, setReveal] = useState<RevealRequest | null>(null);
	const serial = useRef(0);
	const view = useRef<EditorView | null>(null);

	// The editor's own commands, for its right-click menu and the command palette: they run on the
	// editor's view, which is focused first so the browser's copy acts on its selection.
	const bridge = useCommandBridge();
	useEffect(() => {
		const onView = (run: (editor: EditorView) => void) => () => {
			const editor = view.current;
			if (!editor) return;
			editor.focus();
			run(editor);
		};
		return bridge?.setHandlers({
			[SCRIPT_COPY]: onView(() => void document.execCommand('copy')),
			[SCRIPT_SELECT_ALL]: onView((editor) => void selectAll(editor)),
			[SCRIPT_FIND]: onView((editor) => void openSearchPanel(editor)),
			[SCRIPT_FOLD_ALL]: onView((editor) => void foldAll(editor)),
			[SCRIPT_UNFOLD_ALL]: onView((editor) => void unfoldAll(editor)),
		});
	}, [bridge]);

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
		<div className={styles.panel}>
			<ScriptEditor
				className={styles.editor}
				text={text}
				diagnostics={diagnostics}
				words={words}
				reveal={reveal}
				editable={editable}
				onView={(editor) => (view.current = editor)}
			/>
			<div className={styles.footer}>
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
									onClick={() => ask(problem.line, true)}
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
			</div>
		</div>
	);
}
