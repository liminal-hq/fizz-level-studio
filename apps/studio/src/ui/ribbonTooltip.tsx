// The ribbon and toolbar's tooltip: the in-app one around each control, built from the registry's item
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { RibbonControlWrap } from '@liminal-hq/fizz-studio-ribbon/types';
import { Tooltip } from './Tooltip';

/**
 * Draws a ribbon or toolbar control inside the in-app tooltip. An item from the registry carries its
 * label, its shortcut text (`key`) and, while its command cannot run, the reason (`desc`), so the
 * tooltip shows all three without the ribbon knowing about commands.
 */
export const wrapControlInTooltip: RibbonControlWrap = (item, control) => (
	<Tooltip label={item.label} keys={item.key} reason={item.desc}>
		{control}
	</Tooltip>
);
