// Tests for following the system's accent, transparency and contrast hints
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { followAccent, type AccentSources, type AppearanceHints } from './followAccent';

const NORMAL: AppearanceHints = { accent: null, reducedTransparency: false, contrast: 'normal' };

/** Sources the test drives by hand. */
function fakeSources(available: boolean, hints: AppearanceHints) {
	let onHints: (hints: AppearanceHints) => void = () => {};
	const stop = vi.fn();
	const sources: AccentSources = {
		accentAvailable: async () => available,
		hints: async () => hints,
		onHintsChanged: (listener) => {
			onHints = listener;
			return stop;
		},
	};
	return { sources, stop, change: (next: AppearanceHints) => onHints(next) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('followAccent', () => {
	it('sets the derived accent when the system supplies one', async () => {
		const root = document.createElement('div');
		const fake = fakeSources(true, { ...NORMAL, accent: '#3584e4' });
		followAccent(fake.sources, root);
		await settle();
		expect(root.style.getPropertyValue('--fls-accent')).toBe('#3584e4');
		expect(root.style.getPropertyValue('--fls-accent-ink')).toBe('#ffffff');
	});

	it('leaves the defaults when the accent feature is unavailable', async () => {
		const root = document.createElement('div');
		followAccent(fakeSources(false, { ...NORMAL, accent: '#3584e4' }).sources, root);
		await settle();
		expect(root.style.getPropertyValue('--fls-accent')).toBe('');
	});

	it('follows a change and clears when the accent goes away', async () => {
		const root = document.createElement('div');
		const fake = fakeSources(true, NORMAL);
		followAccent(fake.sources, root);
		await settle();
		fake.change({ ...NORMAL, accent: '#e62d42' });
		expect(root.style.getPropertyValue('--fls-accent')).toBe('#e62d42');
		fake.change(NORMAL);
		expect(root.style.getPropertyValue('--fls-accent')).toBe('');
	});

	it('does not let a late read undo a newer event', async () => {
		const root = document.createElement('div');
		const fake = fakeSources(true, { ...NORMAL, accent: '#3584e4' });
		followAccent(fake.sources, root);
		fake.change({ ...NORMAL, accent: '#e62d42' });
		await settle();
		expect(root.style.getPropertyValue('--fls-accent')).toBe('#e62d42');
	});

	it('marks reduced transparency and more contrast on the root', async () => {
		const root = document.createElement('div');
		const fake = fakeSources(true, NORMAL);
		followAccent(fake.sources, root);
		await settle();
		fake.change({ accent: null, reducedTransparency: true, contrast: 'more' });
		expect(root.dataset.flsTransparency).toBe('reduced');
		expect(root.dataset.flsContrast).toBe('more');
		fake.change(NORMAL);
		expect(root.dataset.flsTransparency).toBeUndefined();
		expect(root.dataset.flsContrast).toBeUndefined();
	});

	it('survives a plugin that is absent', async () => {
		const root = document.createElement('div');
		const failing: AccentSources = {
			accentAvailable: () => Promise.reject(new Error('no plugin')),
			hints: () => Promise.reject(new Error('no plugin')),
			onHintsChanged: () => () => {},
		};
		followAccent(failing, root)();
		await settle();
		expect(root.style.getPropertyValue('--fls-accent')).toBe('');
	});

	it('stops following', () => {
		const fake = fakeSources(true, NORMAL);
		followAccent(fake.sources, document.createElement('div'))();
		expect(fake.stop).toHaveBeenCalled();
	});
});
