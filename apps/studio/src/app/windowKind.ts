// Which kind of window a label names, mirroring the parser in the protocol crate
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** The kinds of window the app opens; the same set as `WindowKind` in `window.rs`. */
export type WindowKind = 'main' | 'panel' | 'new-world' | 'preferences' | 'about' | 'tear-ghost';

/** A window number: digits only, from 1, written without leading zeros. */
function isNumbered(text: string): boolean {
	return /^[1-9][0-9]*$/.test(text);
}

/**
 * The kind of window a label names, or `null` for a label that is not one of ours. Mirrors
 * `WindowId::parse` in `crates/fizz-studio-protocol/src/window.rs`: `main-N`, `panel-NAME-N`
 * (NAME lowercase letters, digits and hyphens), `new-world`, `preferences`, `about`, `tear-ghost`.
 */
export function windowKindFromLabel(label: string): WindowKind | null {
	switch (label) {
		case 'new-world':
		case 'preferences':
		case 'about':
		case 'tear-ghost':
			return label;
	}
	if (label.startsWith('main-')) {
		return isNumbered(label.slice('main-'.length)) ? 'main' : null;
	}
	if (label.startsWith('panel-')) {
		const rest = label.slice('panel-'.length);
		const split = rest.lastIndexOf('-');
		if (split < 0) return null;
		const panel = rest.slice(0, split);
		return /^[a-z0-9-]+$/.test(panel) && isNumbered(rest.slice(split + 1)) ? 'panel' : null;
	}
	return null;
}

/**
 * The panel a panel window's label names (`panel-script-1` is `script`), or `null` for a label that
 * is not a panel window.
 */
export function panelFromLabel(label: string): string | null {
	if (windowKindFromLabel(label) !== 'panel') return null;
	return label.slice('panel-'.length, label.lastIndexOf('-'));
}
