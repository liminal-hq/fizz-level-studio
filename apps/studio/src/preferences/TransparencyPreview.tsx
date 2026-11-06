// A live sample of the transparency settings: a small window with a docked panel, a floating panel and a menu over a busy level and desktop
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { TransparencySettings } from '@liminal-hq/fizz-studio-protocol/generated/TransparencySettings';
import type { CSSProperties } from 'react';
import { t } from '../i18n/messages';
import { glassValues, windowAlpha } from '../theme/transparency';
import { readWindowColours } from '../theme/transparencyDom';
import styles from './TransparencyPreview.module.css';

export interface TransparencyPreviewProps {
	/** The values to show, a slider's value while it is dragged included. */
	transparency: TransparencySettings;
	/** Glass is off (the master switch, or the system asking for less): every surface is solid. */
	solid: boolean;
	/** Whether this system can draw a see-through window; the sample window stays solid where not. */
	seeThrough: boolean;
}

/** The tiles of the sample level, by the canvas tile token each one wears. */
const LEVEL_TILES = [
	'solid',
	'crystal',
	'door-red',
	'nature',
	'water',
	'hazard',
	'door-blue',
	'platform',
	'gate',
	'exit',
	'door-green',
	'building',
] as const;

/**
 * Draws the sample with the same tokens as the real surfaces, its values set on this box alone, so
 * what it shows while a slider is dragged is what every window draws once it is let go. The level
 * and the desktop behind it are made busy on purpose, so the blur and the saturation show.
 */
export function TransparencyPreview({ transparency, solid, seeThrough }: TransparencyPreviewProps) {
	const values = glassValues(transparency);
	const windowOn = !solid && seeThrough && transparency.window_enabled;
	const colours = windowOn ? readWindowColours(document.documentElement) : null;
	const style = {
		['--fls-preview-blur' as string]: solid ? '0px' : values.blur,
		['--fls-preview-saturation' as string]: solid ? '100%' : values.saturation,
		['--fls-preview-alpha' as string]: solid ? '1' : values.alpha,
		['--fls-preview-menu-alpha' as string]: solid ? '1' : values.menuAlpha,
		['--fls-preview-window-alpha' as string]: windowOn
			? String(windowAlpha(transparency.panel_opacity, colours!.text, colours!.surface))
			: '1',
	} as CSSProperties;
	const surface = (on: boolean) => (on && !solid ? 'on' : 'off');

	return (
		<div
			className={styles.preview}
			style={style}
			role="img"
			aria-label={t('preferences.transparency.preview.label')}
			data-testid="transparency-preview"
		>
			<div className={styles.desktop} aria-hidden="true">
				<div className={styles.window} data-see-through={windowOn || undefined}>
					<div
						className={styles.titleBar}
						data-glass={surface(transparency.title_bar)}
						data-testid="preview-title-bar"
					>
						{t('preferences.transparency.preview.title')}
					</div>
					<div className={styles.body}>
						<div
							className={styles.dock}
							data-glass={surface(transparency.docks)}
							data-testid="preview-dock"
						>
							<span className={styles.heading}>{t('preferences.transparency.preview.dock')}</span>
							<span>{t('preferences.transparency.preview.text')}</span>
						</div>
						<div className={styles.stage}>
							<div className={styles.level}>
								{LEVEL_TILES.map((tile, i) => (
									<span key={`${tile}-${i}`} className={styles.tile} data-tile={tile} />
								))}
							</div>
							<div
								className={styles.floating}
								data-glass={surface(transparency.floating)}
								data-testid="preview-floating"
							>
								<span className={styles.heading}>
									{t('preferences.transparency.preview.floating')}
								</span>
								<span>{t('preferences.transparency.preview.text')}</span>
							</div>
							<div
								className={styles.menu}
								data-glass={surface(transparency.menus)}
								data-testid="preview-menu"
							>
								<span className={styles.menuRow} data-lit>
									{t('preferences.transparency.preview.menuItem')}
								</span>
								<span className={styles.menuRow}>
									{t('preferences.transparency.preview.menuItemOther')}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
