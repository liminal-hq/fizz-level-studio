// The icons on the application menu's rows and menus, drawn in the current text colour
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The same 16 unit box, round strokes and stroke width as the chrome's icons and the dock's rail
// icons. The panel rows reuse the rail's own panel icons, and the tear off row the panel headers'.

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import { PANEL_ICONS, TearOffIcon } from '../panels/dock/panelIcons';

export type IconComponent = ComponentType<{ size?: number }>;

function Svg({ size = 16, children }: { size?: number; children: ReactNode }) {
	const props: SVGProps<SVGSVGElement> = {
		width: size,
		height: size,
		viewBox: '0 0 16 16',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.25,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
		'aria-hidden': true,
		focusable: 'false',
	};
	return <svg {...props}>{children}</svg>;
}

const PAGE = 'M4 2h5l3 3v9H4zM9 2v3h3';

/** A page with a plus: a new level. */
export const NewLevelIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d={PAGE} />
		<path d="M8 8.2v3.6M6.2 10h3.6" />
	</Svg>
);

/** A folder: open a level. */
export const OpenLevelIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
	</Svg>
);

/** A disk: save. */
export const SaveIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M3 2.5h8l2 2V13a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 13zM5.5 2.5v3h4v-3M5.5 13.5v-4h5v4" />
	</Svg>
);

/** A gear: preferences. */
export const PreferencesIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="8" r="2.2" />
		<path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2" />
	</Svg>
);

/** A page with a cross: close the level. */
export const CloseLevelIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d={PAGE} />
		<path d="M6.5 8.5l3 3M9.5 8.5l-3 3" />
	</Svg>
);

/** A power symbol: quit. */
export const QuitIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M8 2v5.5M4.8 4.2a5 5 0 1 0 6.4 0" />
	</Svg>
);

/** A curved arrow turning back: undo. */
export const UndoIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M5.5 3.5 3 6l2.5 2.5M3 6h5.5a3.5 3.5 0 0 1 0 7H6" />
	</Svg>
);

/** A curved arrow turning forward: redo. */
export const RedoIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M10.5 3.5 13 6l-2.5 2.5M13 6H7.5a3.5 3.5 0 0 0 0 7H10" />
	</Svg>
);

/** Four corners spread out to the edges: maximise a panel. */
export const MaximisePanelIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M2 6V2h4M10 2h4v4M2 10v4h4M14 10v4h-4" />
	</Svg>
);

/** The same corners pulled in: restore a panel. */
export const RestorePanelIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M2 6h4V2M10 2v4h4M2 10h4v4M10 14v-4h4" />
	</Svg>
);

/** An anticlockwise arrow: reset the layout. */
export const ResetLayoutIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.8v3h3" />
	</Svg>
);

/** An eye: show the level only, and the View menu. */
export const EyeIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
		<circle cx="8" cy="8" r="2" />
	</Svg>
);

/** A magnifier with a chevron: the command palette. */
export const CommandPaletteIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="7" cy="7" r="4.5" />
		<path d="M10.3 10.3 13.5 13.5M5.6 5.6 7.4 7 5.6 8.4" />
	</Svg>
);

/** A window with an arrow going back in: dock a panel back. */
export const DockBackIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M13.5 2.5 9 7M9 3.5V7h3.5" />
		<path d="M11.5 9.5v2.8a1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2V5.7a1.2 1.2 0 0 1 1.2-1.2h2.8" />
	</Svg>
);

/** A circle with an i: about. */
export const AboutIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="8" r="5.5" />
		<path d="M8 7.4v3.4M8 5.3v.1" />
	</Svg>
);

/** A pencil: the Edit menu. */
export const EditMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M3 13l.6-2.8L10.8 3a1.4 1.4 0 0 1 2 2l-7.2 7.2zM9.5 4.3l2.2 2.2" />
	</Svg>
);

/** A window with a title bar: the Window menu. */
export const WindowMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="2" y="3" width="12" height="10" rx="1.5" />
		<path d="M2 6h12" />
	</Svg>
);

/** A question mark in a circle: the Help menu. */
export const HelpMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="8" r="5.5" />
		<path d="M6.4 6.5a1.7 1.7 0 1 1 2.4 1.5c-.5.3-.8.6-.8 1.2M8 11.3v.1" />
	</Svg>
);

/** A page: the File menu. */
export const FileMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d={PAGE} />
	</Svg>
);

/** The name of an icon a command or menu asks for. */
export type IconId =
	| 'new'
	| 'open'
	| 'save'
	| 'preferences'
	| 'close'
	| 'quit'
	| 'undo'
	| 'redo'
	| 'maximise'
	| 'restore'
	| 'resetLayout'
	| 'levelFirst'
	| 'commandPalette'
	| 'tearOff'
	| 'dockBack'
	| 'about'
	| `panel.${PanelId}`
	| 'menu.file'
	| 'menu.edit'
	| 'menu.view'
	| 'menu.window'
	| 'menu.help';

const PANEL_ICON_ENTRIES = PANEL_SPECS.map(
	(spec) => [`panel.${spec.id}`, PANEL_ICONS[spec.id]] as const,
);

export const APP_ICONS: Record<IconId, IconComponent> = {
	new: NewLevelIcon,
	open: OpenLevelIcon,
	save: SaveIcon,
	preferences: PreferencesIcon,
	close: CloseLevelIcon,
	quit: QuitIcon,
	undo: UndoIcon,
	redo: RedoIcon,
	maximise: MaximisePanelIcon,
	restore: RestorePanelIcon,
	resetLayout: ResetLayoutIcon,
	levelFirst: EyeIcon,
	commandPalette: CommandPaletteIcon,
	tearOff: TearOffIcon,
	dockBack: DockBackIcon,
	about: AboutIcon,
	...(Object.fromEntries(PANEL_ICON_ENTRIES) as Record<`panel.${PanelId}`, IconComponent>),
	'menu.file': FileMenuIcon,
	'menu.edit': EditMenuIcon,
	'menu.view': EyeIcon,
	'menu.window': WindowMenuIcon,
	'menu.help': HelpMenuIcon,
};
