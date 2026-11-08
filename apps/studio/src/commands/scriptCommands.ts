// The script editor's commands: Copy, Select all, Find, Fold all and Unfold all
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The Script panel publishes the handlers under these ids and the editor's selection as the fact the
// menu reads; the registry adds the definitions through `extraCommands`, so they show in the command
// palette as well as in the editor's right-click menu. Their keys are CodeMirror's own, shown as
// `shortcut` (the editor handles them, so the app-wide dispatcher must not).

import type { CommandDef } from './registry';

export const SCRIPT_COPY = 'script.copy';
export const SCRIPT_SELECT_ALL = 'script.selectAll';
export const SCRIPT_FIND = 'script.find';
export const SCRIPT_FOLD_ALL = 'script.foldAll';
export const SCRIPT_UNFOLD_ALL = 'script.unfoldAll';

/** The script editor's commands: they apply while the Script panel is showing its editor. */
export function scriptCommands(): CommandDef[] {
	return [
		{
			id: SCRIPT_COPY,
			icon: 'copy',
			group: 'edit',
			label: 'script.copy',
			shortcut: 'Ctrl+C',
			visible: (facts) => facts.editorOpen,
			enabled: (facts) => facts.editorOpen,
		},
		{
			id: SCRIPT_SELECT_ALL,
			icon: 'selectAll',
			group: 'edit',
			label: 'script.selectAll',
			shortcut: 'Ctrl+A',
			visible: (facts) => facts.editorOpen,
			enabled: (facts) => facts.editorOpen,
		},
		{
			id: SCRIPT_FIND,
			icon: 'search',
			group: 'edit',
			label: 'script.find',
			shortcut: 'Ctrl+F',
			visible: (facts) => facts.editorOpen,
			enabled: (facts) => facts.editorOpen,
		},
		{
			id: SCRIPT_FOLD_ALL,
			icon: 'foldAll',
			group: 'edit',
			label: 'script.foldAll',
			shortcut: 'Ctrl+Alt+[',
			visible: (facts) => facts.editorOpen,
			enabled: (facts) => facts.editorOpen,
		},
		{
			id: SCRIPT_UNFOLD_ALL,
			icon: 'unfoldAll',
			group: 'edit',
			label: 'script.unfoldAll',
			shortcut: 'Ctrl+Alt+]',
			visible: (facts) => facts.editorOpen,
			enabled: (facts) => facts.editorOpen,
		},
	];
}
