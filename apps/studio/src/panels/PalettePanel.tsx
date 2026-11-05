// The Palette: the level's tile words and the language's item and enemy words, to choose from
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WordDoc } from '@liminal-hq/fizz-studio-protocol/generated/WordDoc';
import { t } from '../i18n/messages';
import styles from './PalettePanel.module.css';

export interface PalettePanelProps {
	/** The tile words of the open level (`LevelView.palette`). */
	tiles: readonly string[];
	/** The language's documented words, from the backend; the items and enemies come from here. */
	words: readonly WordDoc[];
	/** The tile Paint lays down, and the item Stamp places. */
	tile: string;
	item: string;
	/** Choosing a tile also makes Paint the current tool. */
	onPickTile: (word: string) => void;
	/** Choosing an item also makes Stamp the current tool. */
	onPickItem: (word: string) => void;
}

function noteOf(words: readonly WordDoc[], word: string): string | undefined {
	return words.find((doc) => doc.word === word && doc.kind === 'tile')?.note || undefined;
}

/**
 * Buttons for the words a person can paint or place with. A word is a pressed toggle, so the
 * current choice is spoken as well as shown. Enemies are listed for reference only.
 */
export function PalettePanel({
	tiles,
	words,
	tile,
	item,
	onPickTile,
	onPickItem,
}: PalettePanelProps) {
	const items = words.filter((doc) => doc.kind === 'item');
	const enemies = words.filter((doc) => doc.kind === 'enemy');
	return (
		<section className={styles.panel} aria-labelledby="palette-panel-title">
			<h2 id="palette-panel-title" className={styles.title}>
				{t('palette.title')}
			</h2>
			<h3 className={styles.subtitle}>{t('palette.tiles')}</h3>
			<ul className={styles.words} role="list">
				{tiles.map((word) => (
					<li key={word}>
						<button
							type="button"
							className={styles.word}
							aria-pressed={word === tile}
							title={noteOf(words, word)}
							onClick={() => onPickTile(word)}
						>
							{word}
						</button>
					</li>
				))}
			</ul>
			{words.length === 0 ? (
				<p className={styles.note}>{t('palette.unavailable')}</p>
			) : (
				<>
					<h3 className={styles.subtitle}>{t('palette.items')}</h3>
					<ul className={styles.words} role="list">
						{items.map((doc) => (
							<li key={doc.word}>
								<button
									type="button"
									className={styles.word}
									aria-pressed={doc.word === item}
									title={doc.note || undefined}
									onClick={() => onPickItem(doc.word)}
								>
									{doc.word}
								</button>
							</li>
						))}
					</ul>
					<h3 className={styles.subtitle}>{t('palette.enemies')}</h3>
					<ul className={styles.words} role="list">
						{enemies.map((doc) => (
							<li key={doc.word} className={styles.plain} title={doc.note || undefined}>
								{doc.word}
							</li>
						))}
					</ul>
					<p className={styles.note}>{t('palette.enemiesNote')}</p>
				</>
			)}
		</section>
	);
}
