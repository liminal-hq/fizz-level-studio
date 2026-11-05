// The button that folds a dock to its rail, or opens the rail again
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ZoneId } from '@liminal-hq/fizz-studio-protocol/generated/ZoneId';
import { ChevronRightIcon } from '@liminal-hq/fizz-studio-chrome/icons/icons';
import { t } from '../../i18n/messages';
import styles from './FoldButton.module.css';

export interface FoldButtonProps {
	zone: ZoneId;
	/** True on a folded dock's rail, where the button opens it. */
	folded: boolean;
	onClick: () => void;
}

/**
 * A keycap with a chevron that points the way the dock goes: towards its edge to fold it, away
 * from its edge to open it.
 */
export function FoldButton({ zone, folded, onClick }: FoldButtonProps) {
	const label = folded ? t(`dock.unfold.${zone}`) : t(`dock.fold.${zone}`);
	// The chevron points right by default; a dock folds towards its own edge.
	const turn = { left: 'left', right: 'right', bottom: 'down' }[zone];
	const opens = { left: 'right', right: 'left', bottom: 'up' }[zone];
	return (
		<button
			type="button"
			className={styles.key}
			aria-label={label}
			title={label}
			aria-expanded={!folded}
			onClick={onClick}
		>
			<span className={styles.chevron} data-points={folded ? opens : turn}>
				<ChevronRightIcon size={14} />
			</span>
		</button>
	);
}
