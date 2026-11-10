// The script as an editor: a CodeMirror view over the backend's text, with its problems marked
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { ViewDiagnostic } from '@liminal-hq/fizz-studio-protocol/generated/ViewDiagnostic';
import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { useEffect, useRef } from 'react';
import { t } from '../../i18n/messages';
import { diagnosticsTransaction } from './scriptDiagnostics';
import { scriptExtensions } from './scriptExtensions';
import { revealTransaction, syncTransaction } from './scriptSync';

/** A request to mark a line and bring it into view. Asking again for the same line does it again. */
export interface RevealRequest {
	line: number;
	/** Changes with every request, so the same line can be asked for twice. */
	serial: number;
	/** True to move the keyboard focus into the editor as well. */
	focus: boolean;
}

export interface ScriptEditorProps {
	/** `LevelSnapshot.text`, shown exactly as it is. */
	text: string;
	diagnostics: readonly ViewDiagnostic[];
	words: readonly WordDoc[];
	reveal?: RevealRequest | null;
	/** False while the backend has no way to take a typed change; the text then stays read-only. */
	editable?: boolean;
	className?: string;
	/** Told of the view once it exists, and with null when it goes: how the panel reaches the editor's own commands. */
	onView?: (view: EditorView | null) => void;
}

/**
 * Owns one editor view. The text always follows the prop, applied as the smallest change so the
 * caret and the selections stay where they are when the level changes underneath them; the
 * problems are the backend's, drawn as marks on their lines.
 */
export function ScriptEditor({
	text,
	diagnostics,
	words,
	reveal = null,
	editable = false,
	className,
	onView,
}: ScriptEditorProps) {
	const onViewRef = useRef(onView);
	onViewRef.current = onView;
	const host = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const features = useRef(new Compartment());
	const label = t('script.text');

	useEffect(() => {
		if (!host.current) return;
		const created = new EditorView({
			parent: host.current,
			state: EditorState.create({
				doc: text,
				extensions: features.current.of(scriptExtensions({ editable, words, label })),
			}),
		});
		view.current = created;
		onViewRef.current?.(created);
		return () => {
			onViewRef.current?.(null);
			created.destroy();
			view.current = null;
		};
		// The view is made once; the effects below carry every later change into it.
	}, []);

	useEffect(() => {
		view.current?.dispatch({
			effects: features.current.reconfigure(scriptExtensions({ editable, words, label })),
		});
	}, [editable, words, label]);

	useEffect(() => {
		const current = view.current;
		if (!current) return;
		const change = syncTransaction(current.state, text);
		if (change) current.dispatch(change);
	}, [text]);

	useEffect(() => {
		const current = view.current;
		if (!current) return;
		current.dispatch(diagnosticsTransaction(current.state, diagnostics));
	}, [diagnostics, text]);

	useEffect(() => {
		const current = view.current;
		if (!current || !reveal) return;
		current.dispatch(revealTransaction(current.state, reveal.line));
		if (reveal.focus) current.focus();
	}, [reveal]);

	return <div ref={host} className={className} />;
}
