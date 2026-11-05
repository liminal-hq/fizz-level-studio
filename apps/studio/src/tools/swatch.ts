// The colour a brush swatch shows, read from the theme's tokens rather than written here
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { CSSProperties } from 'react';
import { tileToken } from '../canvas/tileColours';
import type { Brush } from './brush';

/** The style that colours a swatch for a brush: a tile's own token, or the item or enemy token. */
export function brushSwatch(brush: Brush): CSSProperties {
	const token =
		brush.group === 'item'
			? '--fls-canvas-item'
			: brush.group === 'enemy'
				? '--fls-canvas-spawn'
				: tileToken(brush.kind);
	return { background: `var(${token})` };
}
