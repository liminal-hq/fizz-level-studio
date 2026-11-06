// Small icons for the panels and for the dock's controls, drawn in the current text colour
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ComponentType, ReactNode, SVGProps } from 'react';
import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { PanelId } from '../float/panelSpecs';

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

/** The Palette: a brush tile grid. */
export const PaletteIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
		<rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
		<rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
		<rect x="9" y="9" width="4.5" height="4.5" rx="1" />
	</Svg>
);

/** The Objects list: three rows with markers. */
export const ObjectsIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
		<circle cx="3.5" cy="4" r="0.9" />
		<circle cx="3.5" cy="8" r="0.9" />
		<circle cx="3.5" cy="12" r="0.9" />
	</Svg>
);

/** History: a clock hand turning back. */
export const HistoryIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8M8 5v3.2l2 1.3" />
	</Svg>
);

/** Proposals: a dashed ghost outline. */
export const ProposalsIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path
			d="M3.5 13.5V7a4.5 4.5 0 0 1 9 0v6.5l-1.5-1.2-1.5 1.2-1.5-1.2-1.5 1.2-1.5-1.2z"
			strokeDasharray="2 1.6"
		/>
	</Svg>
);

/** The Script: angle brackets. */
export const ScriptIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M6 4L2.5 8 6 12M10 4l3.5 4L10 12" />
	</Svg>
);

export const PANEL_ICONS: Record<PanelId, IconComponent> = {
	palette: PaletteIcon,
	objects: ObjectsIcon,
	history: HistoryIcon,
	proposals: ProposalsIcon,
	script: ScriptIcon,
};

/** A window with the named edge filled: the dock's place for a panel. */
export function ZoneIcon({ zone, size }: { zone: ZoneId; size?: number }) {
	const strip = {
		left: <path d="M5.5 3v10" />,
		right: <path d="M10.5 3v10" />,
		bottom: <path d="M2 10h12" />,
	}[zone];
	return (
		<Svg size={size}>
			<rect x="2" y="3" width="12" height="10" rx="1.5" />
			{strip}
		</Svg>
	);
}

/** A window above a smaller one: a panel floating over the level. */
export const FloatIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<rect x="2" y="2.5" width="8" height="7" rx="1.2" />
		<rect x="6" y="6.5" width="8" height="7" rx="1.2" />
	</Svg>
);

/** A window with an arrow leaving it: a panel torn off into a window of its own. */
export const TearOffIcon: IconComponent = ({ size }) => (
	<Svg size={size}>
		<path d="M9 2.5h4.5V7M13.5 2.5 8 8" />
		<path d="M11.5 9.5v2.8a1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2V5.7a1.2 1.2 0 0 1 1.2-1.2h2.8" />
	</Svg>
);
