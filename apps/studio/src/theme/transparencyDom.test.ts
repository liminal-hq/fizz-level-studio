// Tests for writing the transparency settings onto the root
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { FALLBACK_FLOOR, TRANSPARENCY_DEFAULTS } from './transparency';
import { applyTransparency } from './transparencyDom';

describe('applyTransparency', () => {
	it('sets the glass values and the surface switches on the root', () => {
		const root = document.createElement('div');
		applyTransparency(root, { ...TRANSPARENCY_DEFAULTS, blur: 24, saturation: 150 }, false);
		expect(root.style.getPropertyValue('--fls-glass-blur')).toBe('24px');
		expect(root.style.getPropertyValue('--fls-glass-saturation')).toBe('150%');
		expect(root.style.getPropertyValue('--fls-glass-alpha')).toBe('0.88');
		expect(root.style.getPropertyValue('--fls-menu-alpha')).toBe('0.96');
		expect(root.dataset.flsGlassDocks).toBe('on');
		expect(root.dataset.flsGlassFloating).toBe('on');
		expect(root.dataset.flsGlassMenus).toBe('off');
		expect(root.dataset.flsGlassDialogs).toBe('off');
		expect(root.dataset.flsGlassTitleBar).toBe('off');
		expect(root.dataset.flsWindow).toBeUndefined();
	});

	it('follows a change of the switches', () => {
		const root = document.createElement('div');
		applyTransparency(root, TRANSPARENCY_DEFAULTS, false);
		applyTransparency(
			root,
			{ ...TRANSPARENCY_DEFAULTS, docks: false, menus: true, title_bar: true },
			false,
		);
		expect(root.dataset.flsGlassDocks).toBe('off');
		expect(root.dataset.flsGlassMenus).toBe('on');
		expect(root.dataset.flsGlassTitleBar).toBe('on');
	});

	it('marks the window see-through with an opacity no lower than the floor, and takes it off again', () => {
		const root = document.createElement('div');
		const alpha = applyTransparency(root, { ...TRANSPARENCY_DEFAULTS, panel_opacity: 40 }, true);
		// A test has no tokens to read, so the floor is the fallback.
		expect(alpha).toBe(FALLBACK_FLOOR);
		expect(root.dataset.flsWindow).toBe('see-through');
		expect(root.style.getPropertyValue('--fls-window-alpha')).toBe(String(FALLBACK_FLOOR));
		expect(applyTransparency(root, TRANSPARENCY_DEFAULTS, false)).toBeNull();
		expect(root.dataset.flsWindow).toBeUndefined();
		expect(root.style.getPropertyValue('--fls-window-alpha')).toBe('');
	});
});
