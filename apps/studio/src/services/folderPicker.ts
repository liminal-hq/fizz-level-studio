// The native dialog for choosing a folder
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { open } from '@tauri-apps/plugin-dialog';

/** Asks for a folder; the dialog's title comes from the caller. */
export type PickFolder = (texts: { title: string }) => Promise<string | null>;

/** Shows the native folder dialog; resolves to the chosen path, or `null`. */
export const pickFolder: PickFolder = async ({ title }) => {
	const chosen = await open({ title, multiple: false, directory: true });
	return typeof chosen === 'string' ? chosen : null;
};
