// Keeps the accent colour and the transparency and contrast hints in step with the system
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { applyAccent, deriveAccent, isHexColour } from './accent';

/** What the studio reads from the system's appearance preferences. */
export interface AppearanceHints {
	/** The system accent as `#rrggbb`, or null when the system has none. */
	accent: string | null;
	reducedTransparency: boolean;
	contrast: 'normal' | 'more';
}

/** The sources the accent depends on; the real ones are in `services/appearanceClient.ts`. */
export interface AccentSources {
	/** Whether this desktop can supply an accent colour at all (the plugin's status says). */
	accentAvailable(): Promise<boolean>;
	/** The system's appearance hints, now, and on every change that is newer than the last. */
	hints(): Promise<AppearanceHints>;
	onHintsChanged(listener: (hints: AppearanceHints) => void): () => void;
}

/**
 * Sets the derived accent colours as custom properties on the root, and `data-fls-transparency` and
 * `data-fls-contrast` for the tokens to read. With no accent from the system, or no plugin, the
 * properties are cleared and the defaults in `tokens.css` apply. It subscribes before it reads, so a
 * change that lands during start-up is not lost, and a read that comes back after a newer event does
 * not undo it. Returns the function that stops following.
 */
export function followAccent(
	sources: AccentSources,
	root: HTMLElement = document.documentElement,
): () => void {
	let available = false;
	let hints: AppearanceHints | null = null;
	let heard = false;

	const apply = () => {
		const accent = available && hints && isHexColour(hints.accent) ? hints.accent : null;
		applyAccent(accent === null ? null : deriveAccent(accent), root);
		if (hints?.reducedTransparency) root.dataset.flsTransparency = 'reduced';
		else delete root.dataset.flsTransparency;
		if (hints?.contrast === 'more') root.dataset.flsContrast = 'more';
		else delete root.dataset.flsContrast;
	};

	const stop = sources.onHintsChanged((next) => {
		hints = next;
		heard = true;
		apply();
	});
	void sources
		.accentAvailable()
		.then((read) => {
			available = read;
			apply();
		})
		.catch(() => {});
	void sources
		.hints()
		.then((read) => {
			if (!heard) hints = read;
			apply();
		})
		.catch(() => {});

	return stop;
}
