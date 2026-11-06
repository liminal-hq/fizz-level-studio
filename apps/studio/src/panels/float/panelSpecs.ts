// The editor's floating panels: their ids, titles and smallest sizes, and a layout for a plain browser
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { PanelLayout } from '@liminal-hq/fizz-studio-protocol/generated/PanelLayout';
import type { MessageId } from '../../i18n/messages';
import { defaultWorkspace } from '../dock/dockModel';
import type { Size } from './panelGeometry';

/** The window kind whose layout the editor saves. */
export const EDITOR_KIND = 'main';

export type PanelId = 'palette' | 'objects' | 'history' | 'proposals' | 'script';

export interface PanelSpec {
	id: PanelId;
	title: MessageId;
	min: Size;
	/** The panel can be maximised to fill the workspace. A new panel, such as a sprite editor, opts in. */
	expandable?: boolean;
}

/** The panels in the order the Panels menu lists them. */
/** Whether a panel can be maximised. */
export function isExpandable(id: string): boolean {
	return PANEL_SPECS.some((spec) => spec.id === id && spec.expandable === true);
}

export const PANEL_SPECS: readonly PanelSpec[] = [
	{ id: 'palette', title: 'palette.title', min: { w: 200, h: 120 } },
	{ id: 'objects', title: 'objects.list', min: { w: 200, h: 120 } },
	{ id: 'history', title: 'history.title', min: { w: 240, h: 96 } },
	{ id: 'proposals', title: 'ghosts.title', min: { w: 200, h: 120 }, expandable: true },
	{ id: 'script', title: 'script.title', min: { w: 320, h: 200 }, expandable: true },
];

/**
 * The arrangement used until Rust answers, and where the settings plugin does not exist (the
 * webview served alone): the floating rectangles of the fixed default workspace. They come from
 * the fixture that the settings crate's `default_layout("main")` is tested against, so the two
 * cannot drift apart.
 */
export function fallbackLayout(): PanelLayout {
	const panels: PanelLayout['panels'] = {};
	for (const [id, entry] of Object.entries(defaultWorkspace().panels)) panels[id] = entry.float;
	return { panels };
}
