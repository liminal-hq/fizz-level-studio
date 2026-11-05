// The orange lines that show which edges a dragged panel is locked to
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { CSSProperties } from 'react';
import styles from './SnapGuides.module.css';
import type { Guide } from './snap';

export interface SnapGuidesProps {
	guides: readonly Guide[];
}

/** Draws each guide across the whole area. It is decoration: the pointer passes through it. */
export function SnapGuides({ guides }: SnapGuidesProps) {
	return (
		<div className={styles.layer} aria-hidden="true">
			{guides.map((guide) => (
				<span
					key={`${guide.axis}-${guide.at}`}
					className={guide.axis === 'x' ? styles.vertical : styles.horizontal}
					style={{ '--fls-guide-at': `${guide.at}px` } as CSSProperties}
				/>
			))}
		</div>
	);
}
