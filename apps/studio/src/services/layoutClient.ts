// The floating-panel layout: the settings document's `layout`, through the settings plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	getPanelLayout,
	resetPanelLayout,
	savePanelLayout,
	type PanelLayout,
} from '@liminal-hq/fizz-studio-plugin-settings';

/** The saved arrangement of a kind of window's panels. Rust owns it and its defaults. */
export interface LayoutClient {
	/** What is in force: the saved places laid over the defaults. */
	get(kind: string): Promise<PanelLayout>;
	/** Saves the arrangement; resolves with what is now in force. */
	save(kind: string, layout: PanelLayout): Promise<PanelLayout>;
	/** Forgets the saved arrangement; resolves with the defaults. */
	reset(kind: string): Promise<PanelLayout>;
}

/** The real client. */
export const layoutClient: LayoutClient = {
	get: getPanelLayout,
	save: savePanelLayout,
	reset: resetPanelLayout,
};
