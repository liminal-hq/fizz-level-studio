// Keeps the accent colour, the glass and the transparency and contrast hints in step with the system and the settings
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { AccentChoice } from '@liminal-hq/fizz-studio-protocol/generated/AccentChoice';
import type { GlassMode } from '@liminal-hq/fizz-studio-protocol/generated/GlassMode';
import type { TransparencySettings } from '@liminal-hq/fizz-studio-protocol/generated/TransparencySettings';
import { applyAccent, deriveAccent } from './accent';
import { resolveAccentHex, resolveGlass } from './accentChoice';
import { TRANSPARENCY_DEFAULTS, windowSeeThrough } from './transparency';
import { applyTransparency } from './transparencyDom';

/** What the studio reads from the system's appearance preferences. */
export interface AppearanceHints {
	/** The system accent as `#rrggbb`, or null when the system has none. */
	accent: string | null;
	reducedTransparency: boolean;
	contrast: 'normal' | 'more';
}

/** The person's accent, glass and transparency choices from the settings document. */
export interface AppearanceChoice {
	accent: AccentChoice;
	glass: GlassMode;
	transparency: TransparencySettings;
}

/** What a window follows before the settings have answered: the system, and the default glass. */
export const SYSTEM_CHOICE: AppearanceChoice = {
	accent: { kind: 'system' },
	glass: 'system',
	transparency: TRANSPARENCY_DEFAULTS,
};

/** The sources the accent depends on; the real ones are in `services/appearanceClient.ts`. */
export interface AccentSources {
	/** Whether this desktop can supply an accent colour at all (the plugin's status says). */
	accentAvailable(): Promise<boolean>;
	/** The system's appearance hints, now, and on every change that is newer than the last. */
	hints(): Promise<AppearanceHints>;
	onHintsChanged(listener: (hints: AppearanceHints) => void): () => void;
	/** The saved accent and glass choices, now, and on every change that is newer than the last. */
	choice(): Promise<AppearanceChoice>;
	onChoiceChanged(listener: (choice: AppearanceChoice) => void): () => void;
	/**
	 * Whether this window can let the desktop through at all (the window-effects plugin's
	 * `opacity`). Left out, it cannot, and the window stays solid.
	 */
	seeThroughAvailable?(): Promise<boolean>;
	/** Whether this window is in front, now and on every change. Left out, it counts as in front. */
	focused?(): Promise<boolean>;
	onFocusChanged?(listener: (focused: boolean) => void): () => void;
}

/**
 * Sets the derived accent colours as custom properties on the root, and `data-fls-transparency`,
 * `data-fls-glass` and `data-fls-contrast` for the tokens to read. The accent is the person's choice:
 * the system's (when it has one and the plugin can read it), a studio preset, or a custom colour; the
 * studio cyan, or no accent from the system, clears the properties so the defaults in `tokens.css`
 * apply. Glass `off` draws solid panels, `on` keeps the blur even when the system asks for less
 * transparency, and `system` follows that hint. The Transparency settings are written onto the root
 * too (`applyTransparency`): the glass values, each surface's switch, and the see-through window
 * while it is switched on, glass is drawn, the system can, and the window is in front (or may be
 * see-through behind others). It subscribes before it reads, so a
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
	let choice: AppearanceChoice = SYSTEM_CHOICE;
	let choiceHeard = false;
	let seeThroughAvailable: boolean | null = null;
	let focused = true;
	let focusHeard = false;

	const apply = () => {
		const system = available && hints ? hints.accent : null;
		const accent = resolveAccentHex(choice.accent, system);
		applyAccent(accent === null ? null : deriveAccent(accent), root);
		const solid = resolveGlass(choice.glass, hints?.reducedTransparency ?? false) === 'solid';
		if (solid) root.dataset.flsTransparency = 'reduced';
		else delete root.dataset.flsTransparency;
		if (choice.glass === 'on') root.dataset.flsGlass = 'on';
		else delete root.dataset.flsGlass;
		if (hints?.contrast === 'more') root.dataset.flsContrast = 'more';
		else delete root.dataset.flsContrast;
		const transparency = choice.transparency ?? TRANSPARENCY_DEFAULTS;
		applyTransparency(
			root,
			transparency,
			windowSeeThrough({
				enabled: transparency.window_enabled,
				glass: solid ? 'solid' : 'glass',
				available: seeThroughAvailable,
				focused,
				solidWhenUnfocused: transparency.solid_when_unfocused,
			}),
		);
	};

	const stop = sources.onHintsChanged((next) => {
		hints = next;
		heard = true;
		apply();
	});
	const stopChoice = sources.onChoiceChanged((next) => {
		choice = next;
		choiceHeard = true;
		apply();
	});
	const stopFocus = sources.onFocusChanged?.((next) => {
		focused = next;
		focusHeard = true;
		apply();
	});
	void sources
		.choice()
		.then((read) => {
			if (!choiceHeard) choice = read;
			apply();
		})
		.catch(() => {});
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

	void sources
		.seeThroughAvailable?.()
		.then((read) => {
			seeThroughAvailable = read;
			apply();
		})
		.catch(() => {});
	void sources
		.focused?.()
		.then((read) => {
			if (!focusHeard) focused = read;
			apply();
		})
		.catch(() => {});

	return () => {
		stop();
		stopChoice();
		stopFocus?.();
	};
}
