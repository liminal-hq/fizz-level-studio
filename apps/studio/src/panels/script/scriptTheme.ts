// The script editor's theme, written entirely in the studio's `--fls-*` tokens
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The tokens change with the light and dark schemes, so this one theme serves both: no colour is
// written here, only a reference to a token.

import { EditorView } from '@codemirror/view';

const wash = (percent: number) => `color-mix(in srgb, var(--fls-accent) ${percent}%, transparent)`;

export const scriptTheme = EditorView.theme({
	'&': {
		color: 'var(--fls-text-primary)',
		backgroundColor: 'var(--fls-editor-bg, var(--fls-bg-content))',
		fontSize: '0.85rem',
		height: '100%',
	},
	'&.cm-focused': {
		outline: '2px solid var(--fls-focus-ring)',
		outlineOffset: '-2px',
	},
	'.cm-scroller': {
		fontFamily: "ui-monospace, 'Cascadia Code', 'DejaVu Sans Mono', Consolas, monospace",
		lineHeight: '1.5',
	},
	'.cm-content': { caretColor: 'var(--fls-text-primary)' },
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fls-text-primary)' },
	'.cm-selectionBackground, .cm-content ::selection': { backgroundColor: wash(24) },
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
		backgroundColor: wash(34),
	},
	'.cm-activeLine': { backgroundColor: wash(8) },
	'.cm-revealedLine': {
		backgroundColor: wash(20),
		boxShadow: 'inset 3px 0 0 var(--fls-accent)',
	},
	'.cm-selectionMatch': { backgroundColor: wash(16) },
	'.cm-matchingBracket': {
		backgroundColor: wash(24),
		outline: '1px solid var(--fls-accent)',
	},
	'.cm-nonmatchingBracket': { outline: '1px solid var(--fls-danger)' },
	'.cm-searchMatch': {
		backgroundColor: 'color-mix(in srgb, var(--fls-warning) 30%, transparent)',
		outline: '1px solid var(--fls-warning)',
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: 'color-mix(in srgb, var(--fls-warning) 50%, transparent)',
	},
	'.cm-gutters': {
		color: 'var(--fls-text-muted)',
		backgroundColor: 'var(--fls-editor-gutter-bg, var(--fls-bg-window))',
		borderRight: '1px solid var(--fls-border-subtle)',
	},
	'.cm-activeLineGutter': {
		color: 'var(--fls-text-primary)',
		backgroundColor: wash(8),
	},
	'.cm-foldPlaceholder': {
		color: 'var(--fls-text-secondary)',
		backgroundColor: 'var(--fls-control-bg)',
		border: '1px solid var(--fls-border-subtle)',
	},
	'.cm-lintRange-error': {
		backgroundImage: 'none',
		textDecoration: 'underline wavy var(--fls-danger)',
		textUnderlineOffset: '3px',
	},
	'.cm-lint-marker-error': {
		content: 'none',
		width: '0.7em',
		height: '0.7em',
		borderRadius: '50%',
		backgroundColor: 'var(--fls-danger)',
		backgroundImage: 'none',
	},
	'.cm-tooltip': {
		// Above the docks, rails and floating panels, which the popup now sits over (see popupPlacement).
		zIndex: 'var(--fls-z-menu)',
		color: 'var(--fls-text-primary)',
		backgroundColor: 'var(--fls-bg-raised)',
		border: '1px solid var(--fls-border-subtle)',
		borderRadius: '6px',
	},
	// The documentation popup is for reading, not for pointing at. If it can take the pointer, it can
	// sit under the mouse, take the hover from the word, vanish, and reappear: a flicker.
	'.cm-tooltip:has(.fls-doc)': { pointerEvents: 'none' },
	'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
		color: 'var(--fls-text-primary)',
		backgroundColor: 'var(--fls-bg-selected)',
	},
	'.cm-completionDetail': { color: 'var(--fls-text-muted)' },
	'.cm-completionInfo': {
		color: 'var(--fls-text-primary)',
		backgroundColor: 'var(--fls-bg-raised)',
		border: '1px solid var(--fls-border-subtle)',
	},
	'.fls-doc': { padding: '0.4rem 0.6rem', maxWidth: '26rem', lineHeight: '1.4' },
	'.fls-doc-word': { fontWeight: '700' },
	'.fls-doc-kind': { marginLeft: '0.5rem', color: 'var(--fls-text-muted)' },
	'.fls-doc-note': { margin: '0.3rem 0 0' },
	'.fls-doc-label': {
		display: 'block',
		marginTop: '0.4rem',
		fontSize: '0.75rem',
		color: 'var(--fls-text-muted)',
	},
	'.fls-doc code': { fontFamily: 'inherit', color: 'var(--fls-syntax-keyword)' },
	'.cm-panels': {
		color: 'var(--fls-text-primary)',
		backgroundColor: 'var(--fls-editor-gutter-bg, var(--fls-bg-window))',
	},
	'.cm-panels-top': { borderBottom: '1px solid var(--fls-border-subtle)' },
	'.cm-panels-bottom': { borderTop: '1px solid var(--fls-border-subtle)' },
	'.cm-panel.cm-search input, .cm-panel.cm-gotoLine input': {
		color: 'var(--fls-text-primary)',
		backgroundColor: 'var(--fls-bg-raised)',
		border: '1px solid var(--fls-border-subtle)',
		borderRadius: '4px',
	},
	'.cm-panel.cm-search input:focus-visible, .cm-panel.cm-gotoLine input:focus-visible': {
		outline: '2px solid var(--fls-focus-ring)',
		outlineOffset: '1px',
	},
	'.cm-panel button': {
		color: 'var(--fls-text-primary)',
		backgroundColor: 'var(--fls-control-bg)',
		backgroundImage: 'none',
		border: '1px solid var(--fls-border-subtle)',
		borderRadius: '4px',
	},
	'.cm-panel button:hover': { backgroundColor: 'var(--fls-control-bg-hover)' },
	'.cm-panel button:focus-visible': {
		outline: '2px solid var(--fls-focus-ring)',
		outlineOffset: '1px',
	},
	'.cm-panel label': { color: 'var(--fls-text-secondary)' },
});
