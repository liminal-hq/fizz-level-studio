// Keeps a window's colour scheme in step with the settings document and the system
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ColourMode } from '@liminal-hq/fizz-studio-protocol/generated/ColourMode';
import { applyColourScheme, resolveColourScheme, type SystemScheme } from './colourScheme';

/** The two sources the scheme depends on; the real ones are in `services/appearanceClient.ts`. */
export interface SchemeSources {
	/** The settings document's colour mode, now, and on every change that is newer than the last. */
	mode(): Promise<ColourMode>;
	onModeChanged(listener: (mode: ColourMode) => void): () => void;
	/** The system's colour scheme, now, and on every change that is newer than the last. */
	system(): Promise<SystemScheme>;
	onSystemChanged(listener: (scheme: SystemScheme) => void): () => void;
}

/**
 * Applies the scheme now and again whenever the choice or the system changes. It subscribes before
 * it reads, so a change that lands during start-up is not lost, and a read that comes back after a
 * newer event does not undo it. A source that cannot answer (no plugin, a test) leaves its default:
 * `system` mode and no system preference, which leaves the page to the browser. Returns the function
 * that stops following.
 */
export function followColourScheme(
	sources: SchemeSources,
	root: HTMLElement = document.documentElement,
): () => void {
	let mode: ColourMode = 'system';
	let system: SystemScheme = 'noPreference';
	let modeHeard = false;
	let systemHeard = false;
	const apply = () => applyColourScheme(resolveColourScheme(mode, system), root);

	const stopMode = sources.onModeChanged((next) => {
		mode = next;
		modeHeard = true;
		apply();
	});
	const stopSystem = sources.onSystemChanged((next) => {
		system = next;
		systemHeard = true;
		apply();
	});
	void sources
		.mode()
		.then((read) => {
			if (!modeHeard) mode = read;
			apply();
		})
		.catch(() => {});
	void sources
		.system()
		.then((read) => {
			if (!systemHeard) system = read;
			apply();
		})
		.catch(() => {});

	return () => {
		stopMode();
		stopSystem();
	};
}
