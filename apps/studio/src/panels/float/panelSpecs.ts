// The editor's floating panels: their ids, titles and smallest sizes, and a layout for a plain browser
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { PanelLayout } from '@liminal-hq/fizz-studio-protocol/generated/PanelLayout';
import type { MessageId } from '../../i18n/messages';
import type { Size } from './panelGeometry';

/** The window kind whose layout the editor saves. */
export const EDITOR_KIND = 'main';

export type PanelId = 'palette' | 'objects' | 'history' | 'proposals' | 'script';

export interface PanelSpec {
	id: PanelId;
	title: MessageId;
	min: Size;
}

/** The panels in the order the Panels menu lists them. */
export const PANEL_SPECS: readonly PanelSpec[] = [
	{ id: 'palette', title: 'palette.title', min: { w: 200, h: 120 } },
	{ id: 'objects', title: 'objects.list', min: { w: 200, h: 120 } },
	{ id: 'history', title: 'history.title', min: { w: 240, h: 96 } },
	{ id: 'proposals', title: 'ghosts.title', min: { w: 200, h: 120 } },
	{ id: 'script', title: 'script.title', min: { w: 320, h: 200 } },
];

/**
 * The arrangement used until Rust answers, and where the settings plugin does not exist (the
 * webview served alone). It matches `default_layout("main")` in the settings crate, which is the
 * one that is saved and reset.
 */
export function fallbackLayout(): PanelLayout {
	const place = (x: number, y: number, w: number, h: number, collapsed: boolean, z: number) => ({
		x,
		y,
		w,
		h,
		collapsed,
		visible: true,
		z,
	});
	return {
		panels: {
			palette: place(76, 8, 252, 300, false, 1),
			objects: place(336, 126, 260, 300, false, 2),
			history: place(336, 8, 380, 110, false, 3),
			proposals: place(76, 316, 252, 200, true, 4),
			script: place(812, 8, 460, 420, false, 5),
		},
	};
}
