// Which setting governs each surface and the token its stylesheet must paint with: the one table the spec, the unit test and the live check share
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GlassSurface } from './transparency';

/** What decides how much of what is behind a surface shows through. */
export type GlassGovernor =
	/** The surface switch, and the panel opacity (`--fls-glass-alpha`) while it is on. */
	| GlassSurface
	/** Never glass: always the solid fill (notices, the level canvas, field and control washes). */
	| 'solid';

export interface GlassSurfaceRule {
	surface: string;
	governor: GlassGovernor;
	/** The stylesheets (from `apps/studio/` or `packages/`) that paint the surface, and the token each must read. */
	files: readonly string[];
	token: string;
}

/** The governing setting and token of each surface; `spec/DESKTOP.md` has the same table in words. */
export const GLASS_SURFACES_TABLE: readonly GlassSurfaceRule[] = [
	{
		surface: 'Title bar',
		governor: 'title_bar',
		files: ['../../packages/chrome/src/TitleBar/TitleBar.module.css'],
		token: '--fls-title-bar-opacity',
	},
	{
		surface: 'Menu row (menu bar with the command search and the workspace switcher)',
		governor: 'title_bar',
		files: ['src/app/AppMenuBar.module.css'],
		token: '--fls-chrome-strip-bg',
	},
	{
		surface: 'Commands row and ribbon',
		governor: 'title_bar',
		files: ['../../packages/ribbon/src/Ribbon.module.css'],
		token: '--fls-ribbon-bg',
	},
	{
		surface: 'Docks and the peek flyout',
		governor: 'docks',
		files: ['src/panels/dock/DockZone.module.css', 'src/panels/dock/PeekPanel.module.css'],
		token: '--fls-glass-docks-bg',
	},
	{
		surface: 'Rails and the status line',
		governor: 'docks',
		files: ['src/panels/dock/DockRail.module.css', 'src/canvas/LevelCanvas.module.css'],
		token: '--fls-glass-docks-bg',
	},
	{
		surface: 'Floating panels, the tool picker, the zoom pill and the command palette',
		governor: 'floating',
		files: [
			'src/panels/float/FloatingPanel.module.css',
			'src/tools/ToolPicker.module.css',
			'src/canvas/ZoomControl.module.css',
			'src/commands/CommandPalette.module.css',
		],
		token: '--fls-glass-floating-bg',
	},
	{
		surface: 'Context menus, the panel menu and the app menu',
		governor: 'menus',
		files: ['../../packages/chrome/src/ContextMenu/ContextMenu.module.css'],
		token: '--fls-bg-menu',
	},
	{
		surface: 'The drag ghost',
		governor: 'menus',
		files: ['src/app/TearGhostScreen.module.css'],
		token: '--fls-bg-menu',
	},
	{
		surface: 'Dialogs',
		governor: 'dialogs',
		files: ['../../packages/chrome/src/Dialog/Dialog.module.css'],
		token: '--fls-dialog-opacity',
	},
];
