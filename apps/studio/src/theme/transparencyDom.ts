// Writes the transparency settings onto the root: the glass values, the surface switches and the see-through window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { TransparencySettings } from '@liminal-hq/fizz-studio-protocol/generated/TransparencySettings';
import { GLASS_SURFACES, glassValues, windowAlpha, type GlassSurface } from './transparency';

/** The custom properties the settings set inline on the root (`theme/tokens.css` reads them). */
export const GLASS_PROPERTIES = {
	blur: '--fls-glass-blur',
	saturation: '--fls-glass-saturation',
	alpha: '--fls-glass-alpha',
	menuAlpha: '--fls-menu-alpha',
	windowAlpha: '--fls-window-alpha',
} as const;

/** The `data-*` attribute on the root that carries each surface's switch, as a dataset key. */
const SURFACE_DATA: Record<GlassSurface, string> = {
	docks: 'flsGlassDocks',
	floating: 'flsGlassFloating',
	menus: 'flsGlassMenus',
	dialogs: 'flsGlassDialogs',
	title_bar: 'flsGlassTitleBar',
};

/** The colours the window's floor is worked out from, read from the tokens in force; `null` where the page cannot read them. */
function readWindowColours(root: HTMLElement): { text: string | null; surface: string | null } {
	if (typeof globalThis.getComputedStyle !== 'function') return { text: null, surface: null };
	const style = globalThis.getComputedStyle(root);
	const read = (name: string): string | null => {
		const value = style.getPropertyValue(name).trim();
		return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
	};
	return { text: read('--fls-text-primary'), surface: read('--fls-solid-window') };
}

/**
 * Sets the glass blur, saturation, panel and menu opacity on `root` (inline, so the tokens'
 * reduced-transparency and forced-colour rules override them with `!important`), marks each
 * surface `on` or `off`, and marks the window `see-through` with its opacity when `seeThrough`
 * says it may let the desktop through. Returns the window's opacity, or `null` when it is solid.
 */
export function applyTransparency(
	root: HTMLElement,
	transparency: TransparencySettings,
	seeThrough: boolean,
): number | null {
	const values = glassValues(transparency);
	root.style.setProperty(GLASS_PROPERTIES.blur, values.blur);
	root.style.setProperty(GLASS_PROPERTIES.saturation, values.saturation);
	root.style.setProperty(GLASS_PROPERTIES.alpha, values.alpha);
	root.style.setProperty(GLASS_PROPERTIES.menuAlpha, values.menuAlpha);
	for (const surface of GLASS_SURFACES) {
		root.dataset[SURFACE_DATA[surface]] = transparency[surface] ? 'on' : 'off';
	}
	if (!seeThrough) {
		delete root.dataset.flsWindow;
		root.style.removeProperty(GLASS_PROPERTIES.windowAlpha);
		return null;
	}
	const { text, surface } = readWindowColours(root);
	const alpha = windowAlpha(transparency.panel_opacity, text, surface);
	root.style.setProperty(GLASS_PROPERTIES.windowAlpha, String(alpha));
	root.dataset.flsWindow = 'see-through';
	return alpha;
}
