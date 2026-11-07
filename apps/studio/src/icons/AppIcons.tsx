// The icons on the application menu's rows and menus, and on the tool keys, drawn in the current text colour
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The icon style and set of Waypoint's menus: a 16 unit box, round strokes and a 1.4 stroke. Where
// Waypoint (apps/waypoint/src/icons/MenuIcons.tsx) has a glyph for the same meaning it is copied
// as drawn, and marked "Waypoint" below; the others are drawn here in the same style. The panel
// rows reuse the rail's own panel icons, and the tear off row the panel headers'.

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { PANEL_SPECS, type PanelId } from '../panels/float/panelSpecs';
import { FloatIcon, PANEL_ICONS, TearOffIcon, ZoneIcon } from '../panels/dock/panelIcons';
import type { ToolId } from '../tools/tool';

export type IconComponent = ComponentType<{ size?: number }>;

function Svg({ size = 16, children }: { size?: number; children: ReactNode }) {
	const props: SVGProps<SVGSVGElement> = {
		width: size,
		height: size,
		viewBox: '0 0 16 16',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.4,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
		'aria-hidden': true,
		focusable: 'false',
	};
	return <svg {...props}>{children}</svg>;
}

const PAGE = 'M4 2h5l3 3v9H4zM9 2v3h3';

/** A page with a plus: a new level (Waypoint's new file). */
export const NewLevelIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M9.5 2.5h-5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7zM9.5 2.5v3h3M8 7.5v4M6 9.5h4" />
	</Svg>
);

/** An open folder: open a level (Waypoint). */
export const OpenLevelIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M1.5 12.5v-8h4l1.5 1.5h6.5v2M1.5 12.5l2-5.5h11.5l-2 5.5z" />
	</Svg>
);

/** A disk: save. */
export const SaveIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M3 2.5h8l2 2V13a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 13zM5.5 2.5v3h4v-3M5.5 13.5v-4h5v4" />
	</Svg>
);

/** A gear with eight teeth around a hub: preferences (Waypoint's settings gear). */
export const PreferencesIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M6.90 3.23 L7.08 1.46 L8.92 1.46 L9.10 3.23 L10.60 3.84 L11.97 2.73 L13.27 4.03 L12.16 5.40 L12.77 6.90 L14.54 7.08 L14.54 8.92 L12.77 9.10 L12.16 10.60 L13.27 11.97 L11.97 13.27 L10.60 12.16 L9.10 12.77 L8.92 14.54 L7.08 14.54 L6.90 12.77 L5.40 12.16 L4.03 13.27 L2.73 11.97 L3.84 10.60 L3.23 9.10 L1.46 8.92 L1.46 7.08 L3.23 6.90 L3.84 5.40 L2.73 4.03 L4.03 2.73 L5.40 3.84z" />
		<circle cx="8" cy="8" r="2" />
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

/** A curved arrow turning back: undo (Waypoint). */
export const UndoIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M5.5 3L2.5 6l3 3M2.5 6h7a3.5 3.5 0 0 1 0 7H6" />
	</Svg>
);

/** A curved arrow turning forward: redo (Waypoint). */
export const RedoIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M10.5 3l3 3-3 3M13.5 6h-7a3.5 3.5 0 0 0 0 7H10" />
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

/** An anticlockwise arrow: reset the layout (Waypoint's reset). */
export const ResetLayoutIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.8v3h3" />
	</Svg>
);

/** An eye: show the level only, and the View menu (Waypoint). */
export const EyeIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
		<circle cx="8" cy="8" r="1.8" />
	</Svg>
);

/** A prompt and a cursor line: the command palette (Waypoint). */
export const CommandPaletteIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M3 4.5 7 8l-4 3.5M8.5 12H13" />
	</Svg>
);

/** A window with an arrow going back in: dock a panel back. */
export const DockBackIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M13.5 2.5 9 7M9 3.5V7h3.5" />
		<path d="M11.5 9.5v2.8a1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2V5.7a1.2 1.2 0 0 1 1.2-1.2h2.8" />
	</Svg>
);

/** A circle with an i: about (Waypoint's info). */
export const AboutIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="8" r="6" />
		<path d="M8 7.2v4M8 4.9v.1" />
	</Svg>
);

/** A question mark in a circle: the Help row (Waypoint's help). */
export const HelpIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="8" r="6" />
		<path d="M6.2 6.3a1.9 1.9 0 0 1 3.7.5c0 1.2-1.9 1.5-1.9 2.7M8 11.4v.1" />
	</Svg>
);

/** A keyboard: the Keyboard shortcuts row (Waypoint's keyboard). */
/** A magnifier with a plus: Zoom in. */
export const ZoomInIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="7" cy="7" r="4.5" />
		<path d="M10.4 10.4 14 14M7 5v4M5 7h4" />
	</Svg>
);

/** A magnifier with a minus: Zoom out. */
export const ZoomOutIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="7" cy="7" r="4.5" />
		<path d="M10.4 10.4 14 14M5 7h4" />
	</Svg>
);

/** Four corners: Fit the level to the room. */
export const ZoomFitIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M2 5.5V3a1 1 0 0 1 1-1h2.5M10.5 2H13a1 1 0 0 1 1 1v2.5M14 10.5V13a1 1 0 0 1-1 1h-2.5M5.5 14H3a1 1 0 0 1-1-1v-2.5" />
	</Svg>
);

/** A window with a row of menus along its top: the menu bar. */
export const MenuBarIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="1.5" y="2.5" width="13" height="11" rx="1.4" />
		<path d="M1.5 6h13M3.8 4.3h.1M6 4.3h.1M8.2 4.3h.1" />
	</Svg>
);

/** Three bars side by side: a workspace. */
export const WorkspaceIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="1.5" y="2.5" width="13" height="11" rx="1.4" />
		<path d="M5.8 2.5v11M10.2 2.5v11" />
	</Svg>
);

/** Three dots one above another: a panel's menu. */
export const MoreIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="3.5" r="0.9" />
		<circle cx="8" cy="8" r="0.9" />
		<circle cx="8" cy="12.5" r="0.9" />
	</Svg>
);

export const KeyboardIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="1.5" y="4" width="13" height="8" rx="1.4" />
		<path d="M4 6.8h.1M6.4 6.8h.1M8.8 6.8h.1M11.2 6.8h.1M4.5 9.4h7" />
	</Svg>
);

/** A clock with a turning-back arrow: the Undo history submenu and its rows (Waypoint's history). */
export const HistoryIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5v3h3M8 5v3.2l2 1.3" />
	</Svg>
);

/** A pencil: the Edit menu (Waypoint's edit). */
export const EditMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M10.5 3l2.5 2.5-7.5 7.5-3.2.7.7-3.2zM9 4.5L11.5 7" />
	</Svg>
);

/** A window with a title bar: the Window menu (Waypoint). */
export const WindowMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="2" y="3" width="12" height="10" rx="1.5" />
		<path d="M2 6.5h12" />
	</Svg>
);

/** A question mark in a circle: the Help menu (Waypoint). */
export const HelpMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="8" r="6" />
		<path d="M6.2 6.3a1.9 1.9 0 0 1 3.7.5c0 1.2-1.9 1.5-1.9 2.7M8 11.4v.1" />
	</Svg>
);

/** A palette with three dabs of paint: the Appearance page (Waypoint's palette). */
export const AppearanceIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M8 2.5a5.5 5.5 0 1 0 0 11c1 0 1.4-.7 1.2-1.4-.3-.9.2-1.6 1.1-1.6h1.2a2.5 2.5 0 0 0 2.5-2.5C14 4.9 11.3 2.5 8 2.5z" />
		<path d="M5 8h.01M6.5 5.5h.01M9.5 5.5h.01" />
	</Svg>
);

/** Two overlapping panes, the front one see-through to the one behind: the Transparency page. */
export const TransparencyIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="2" y="2" width="8" height="8" rx="1.5" />
		<rect x="6" y="6" width="8" height="8" rx="1.5" strokeDasharray="1.6 1.6" />
	</Svg>
);

/** A page: the File menu. */
export const FileMenuIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d={PAGE} />
	</Svg>
);

/** A pen nib: the Paint tool. */
export const PaintToolIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M2.5 13.5 4 8.6l5.8-5.8a1.4 1.4 0 0 1 2 0l1.4 1.4a1.4 1.4 0 0 1 0 2L7.4 12z" />
		<path d="M2.5 13.5 6 10M8.6 4l3.4 3.4" />
	</Svg>
);

/** An eraser on its side: the Erase tool. */
export const EraseToolIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M5.8 13.5 2.6 10.3a1.2 1.2 0 0 1 0-1.7l6-6a1.2 1.2 0 0 1 1.7 0l3.1 3.1a1.2 1.2 0 0 1 0 1.7l-6 6.1z" />
		<path d="M5.4 5.8l4.8 4.8M5.8 13.5h7.7" />
	</Svg>
);

/** An eyedropper: the Pick tool. */
export const PickToolIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M9.4 4.2 11.6 2a1.5 1.5 0 0 1 2.1 0l.3.3a1.5 1.5 0 0 1 0 2.1l-2.2 2.2" />
		<path d="M8.4 3.2l4.4 4.4" />
		<path d="M9.6 4.4 3.8 10.2a1 1 0 0 0-.3.6L3 13l2.2-.5a1 1 0 0 0 .6-.3l5.8-5.8" />
	</Svg>
);

/** A dashed rectangle: the Select tool's marquee. */
export const SelectToolIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="2.5" y="3.5" width="11" height="9" rx="1" strokeDasharray="2 2" />
	</Svg>
);

/** A rubber stamp: the Stamp tool. */
export const StampToolIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="8" cy="3.6" r="1.8" />
		<path d="M7 5.3v2.7M9 5.3v2.7" />
		<path d="M3 10a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1H3zM3.5 13.5h9" />
	</Svg>
);

/** A magnifier over a cell: the Inspect tool. */
export const InspectToolIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<circle cx="6.8" cy="6.8" r="4.3" />
		<rect x="5.3" y="5.3" width="3" height="3" rx="0.4" />
		<path d="M10 10l3.5 3.5" />
	</Svg>
);

/** The icon on each tool's key. */
export const TOOL_ICONS: Record<ToolId, IconComponent> = {
	paint: PaintToolIcon,
	erase: EraseToolIcon,
	pick: PickToolIcon,
	select: SelectToolIcon,
	stamp: StampToolIcon,
	inspect: InspectToolIcon,
};

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
	| 'help'
	| 'shortcuts'
	| 'history'
	| 'dock.left'
	| 'dock.right'
	| 'dock.bottom'
	| 'float'
	| 'zoomIn'
	| 'zoomOut'
	| 'zoomFit'
	| 'menuBar'
	| 'workspace'
	| 'more'
	| `panel.${PanelId}`
	| `tool.${ToolId}`
	| 'menu.file'
	| 'menu.edit'
	| 'menu.view'
	| 'menu.window'
	| 'menu.help';

const PANEL_ICON_ENTRIES = PANEL_SPECS.map(
	(spec) => [`panel.${spec.id}`, PANEL_ICONS[spec.id]] as const,
);
const TOOL_ICON_ENTRIES = (Object.keys(TOOL_ICONS) as ToolId[]).map(
	(id) => [`tool.${id}`, TOOL_ICONS[id]] as const,
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
	help: HelpIcon,
	shortcuts: KeyboardIcon,
	history: HistoryIcon,
	'dock.left': ({ size }) => <ZoneIcon zone="left" size={size} />,
	'dock.right': ({ size }) => <ZoneIcon zone="right" size={size} />,
	'dock.bottom': ({ size }) => <ZoneIcon zone="bottom" size={size} />,
	float: FloatIcon,
	zoomIn: ZoomInIcon,
	zoomOut: ZoomOutIcon,
	zoomFit: ZoomFitIcon,
	menuBar: MenuBarIcon,
	workspace: WorkspaceIcon,
	more: MoreIcon,
	...(Object.fromEntries(PANEL_ICON_ENTRIES) as Record<`panel.${PanelId}`, IconComponent>),
	...(Object.fromEntries(TOOL_ICON_ENTRIES) as Record<`tool.${ToolId}`, IconComponent>),
	'menu.file': FileMenuIcon,
	'menu.edit': EditMenuIcon,
	'menu.view': EyeIcon,
	'menu.window': WindowMenuIcon,
	'menu.help': HelpMenuIcon,
};
