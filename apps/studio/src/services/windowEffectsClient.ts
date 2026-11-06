// What the window-effects plugin says this system can do for a see-through window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getStatus, hasFeature } from '@liminal-hq/plugin-window-effects';

/** Whether a window can let the desktop through at all, and whether anything can blur behind it. */
export interface WindowEffectsAvailability {
	seeThrough: boolean;
	blur: boolean;
}

/** The source the Preferences window reads; the real one asks the plugin. */
export interface WindowEffectsSource {
	availability(): Promise<WindowEffectsAvailability>;
}

/** Asks the plugin. Blur is any of the materials: the compositor's blur, Mica, or Acrylic. */
export const windowEffectsSource: WindowEffectsSource = {
	async availability() {
		const status = await getStatus();
		return {
			seeThrough: hasFeature(status, 'opacity'),
			blur:
				hasFeature(status, 'blur') || hasFeature(status, 'mica') || hasFeature(status, 'acrylic'),
		};
	},
};
