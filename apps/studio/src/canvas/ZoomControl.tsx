// The floating zoom control: a glass pill of zoom out, the factor, zoom in and Fit, over the level
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// It lies in the bottom-right corner of the part of the level no dock covers, and only its own box
// takes the pointer. The factor ("4×") is kept, not a percentage: zoom is a whole number from 1 to 16.

import { useSurfaceMenu } from '../app/useSurfaceMenu';
import { t } from '../i18n/messages';
import { ZoomFitIcon, ZoomInIcon, ZoomOutIcon } from '../icons/AppIcons';
import { Tooltip } from '../ui/Tooltip';
import styles from './ZoomControl.module.css';

export type ZoomKind = 'in' | 'out' | 'fit';

export interface ZoomControlProps {
	/** The whole-number zoom now, 1 to 16. */
	zoom: number;
	canIn: boolean;
	canOut: boolean;
	onZoom: (kind: ZoomKind) => void;
}

/**
 * Zoom out, the factor, zoom in, and a Fit button, in one pill. The factor is a polite status, so a
 * zoom made from the keyboard is announced. The buttons only ask: the caller zooms.
 */
export function ZoomControl({ zoom, canIn, canOut, onZoom }: ZoomControlProps) {
	const pillMenu = useSurfaceMenu<HTMLDivElement>(() => ({ kind: 'zoom' }));
	return (
		<div
			className={styles.pill}
			role="group"
			aria-label={t('canvas.zoomGroup')}
			data-zoom-control=""
			{...pillMenu}
		>
			<Tooltip label={t('canvas.zoomOut')} reason={canOut ? undefined : t('canvas.zoomMin')}>
				<button
					type="button"
					className={styles.button}
					data-keycap-exempt=""
					aria-label={t('canvas.zoomOut')}
					disabled={!canOut}
					onClick={() => onZoom('out')}
				>
					<ZoomOutIcon size={14} />
				</button>
			</Tooltip>
			<span className={styles.factor} role="status" aria-live="polite">
				<span className={styles.hidden}>{t('canvas.zoomLevel', { zoom })}</span>
				<span aria-hidden="true">{t('canvas.zoomFactor', { zoom })}</span>
			</span>
			<Tooltip label={t('canvas.zoomIn')} reason={canIn ? undefined : t('canvas.zoomMax')}>
				<button
					type="button"
					className={styles.button}
					data-keycap-exempt=""
					aria-label={t('canvas.zoomIn')}
					disabled={!canIn}
					onClick={() => onZoom('in')}
				>
					<ZoomInIcon size={14} />
				</button>
			</Tooltip>
			<Tooltip label={t('canvas.zoomFit')}>
				<button
					type="button"
					className={`${styles.button} ${styles.fit}`}
					data-keycap-exempt=""
					aria-label={t('canvas.zoomFit')}
					onClick={() => onZoom('fit')}
				>
					<ZoomFitIcon size={14} />
					<span>{t('canvas.zoomFitShort')}</span>
				</button>
			</Tooltip>
		</div>
	);
}
