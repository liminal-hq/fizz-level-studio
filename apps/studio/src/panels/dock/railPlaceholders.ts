// The rail entries for panels that are drawn but cannot be used yet
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import type { IconId } from '../../icons/AppIcons';

/** A dimmed rail entry: it names a panel that is still to come, and the tooltip says why it does nothing. */
export interface RailPlaceholder {
	id: string;
	title: string;
	icon: IconId;
	reason: string;
}

/** The placeholders to draw on each zone's rail. */
export type RailPlaceholders = Partial<Record<ZoneId, readonly RailPlaceholder[]>>;
