// The note shown when a change is refused because it would alter a locked layer
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import { formatLocale } from '../../i18n/active';
import type { MessageId } from '../../i18n/messages';
import { layerNames } from './layerNames';

/** The layers as a sentence part in the person's language: `Treats`, `Treats and Edits`. */
export function layerList(ids: readonly string[], sections: readonly ViewSection[]): string {
	return new Intl.ListFormat(formatLocale(), { style: 'long', type: 'conjunction' }).format(
		layerNames(ids, sections),
	);
}

/** The message and its values for a refusal that names `layers`. */
export function lockedProblem(
	layers: readonly string[],
	sections: readonly ViewSection[],
): { id: MessageId; values: { layers: string } } {
	return {
		id: layers.length > 1 ? 'level.lockedMany' : 'level.locked',
		values: { layers: layerList(layers, sections) },
	};
}
