// The eye and the lock the Layers panel's toggles draw, in the current text colour
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
	return (
		<svg
			width={16}
			height={16}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.4}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{children}
		</svg>
	);
}

/** An open eye: the layer shows. */
export function EyeOpenIcon() {
	return (
		<Svg>
			<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
			<circle cx="8" cy="8" r="2" />
		</Svg>
	);
}

/** A closed eye with a slash: the layer is hidden. */
export function EyeClosedIcon() {
	return (
		<Svg>
			<path d="M1.5 8S4 3.5 8 3.5c1 0 1.9.3 2.7.7M14.5 8S12 12.5 8 12.5c-1 0-1.9-.3-2.7-.7" />
			<path d="M2.5 13.5l11-11" />
		</Svg>
	);
}

/** A shut padlock: the layer is locked. */
export function LockClosedIcon() {
	return (
		<Svg>
			<rect x="3.5" y="7" width="9" height="6.5" rx="1.4" />
			<path d="M5.5 7V5.3a2.5 2.5 0 0 1 5 0V7" />
		</Svg>
	);
}

/** An open padlock: the layer can be changed. */
export function LockOpenIcon() {
	return (
		<Svg>
			<rect x="3.5" y="7" width="9" height="6.5" rx="1.4" />
			<path d="M5.5 7V5.3a2.5 2.5 0 0 1 4.8-1" />
		</Svg>
	);
}
