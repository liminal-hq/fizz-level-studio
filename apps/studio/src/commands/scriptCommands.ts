// The script editor's commands: Copy, Select all, Find, Fold all and Unfold all
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Owned by the chrome package. The Script panel publishes the handlers under these ids; the registry
// adds the definitions through `extraCommands`. The contract commit holds only the ids.

import type { CommandDef } from './registry';

export const SCRIPT_COPY = 'script.copy';
export const SCRIPT_SELECT_ALL = 'script.selectAll';
export const SCRIPT_FIND = 'script.find';
export const SCRIPT_FOLD_ALL = 'script.foldAll';
export const SCRIPT_UNFOLD_ALL = 'script.unfoldAll';

/** The script editor's commands. */
export function scriptCommands(): CommandDef[] {
	return [];
}
