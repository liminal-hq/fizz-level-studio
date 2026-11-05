// What follows the pointer during a drag: a chip with the panel's title, and the tab insertion line
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { CSSProperties } from 'react';
import type { DockDragState } from './useDockDrag';
import styles from './DragGhost.module.css';

export interface DragGhostProps {
	drag: DockDragState;
	title: string;
}

/** Both are fixed to the window and ignore the pointer, so the hit test sees what is beneath. */
export function DragGhost({ drag, title }: DragGhostProps) {
	const line = drag.target?.kind === 'zone' ? drag.target.line : null;
	return (
		<>
			{drag.ghost && (
				<span
					className={styles.ghost}
					data-drag-ghost=""
					aria-hidden="true"
					style={
						{
							'--fls-ghost-x': `${drag.point.x}px`,
							'--fls-ghost-y': `${drag.point.y}px`,
						} as CSSProperties
					}
				>
					{title}
				</span>
			)}
			{line && (
				<span
					className={styles.line}
					data-insertion-line=""
					aria-hidden="true"
					style={
						{
							'--fls-line-x': `${line.x}px`,
							'--fls-line-top': `${line.top}px`,
							'--fls-line-height': `${line.height}px`,
						} as CSSProperties
					}
				/>
			)}
		</>
	);
}
