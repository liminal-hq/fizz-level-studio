// The native file dialog for choosing a level file
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { open } from '@tauri-apps/plugin-dialog';

/** What the main window needs to ask for a file; the dialog's texts come from the caller. */
export type PickLevelFile = (texts: {
	title: string;
	filterName: string;
}) => Promise<string | null>;

/** Shows the native open dialog filtered to `.fizz`; resolves to the chosen path, or `null`. */
export const pickLevelFile: PickLevelFile = async ({ title, filterName }) => {
	const chosen = await open({
		title,
		multiple: false,
		directory: false,
		filters: [{ name: filterName, extensions: ['fizz'] }],
	});
	return typeof chosen === 'string' ? chosen : null;
};
