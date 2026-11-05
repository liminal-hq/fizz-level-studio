// Tests for the colour scheme rules and for following the settings and the system
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ColourMode } from '@liminal-hq/fizz-studio-protocol/generated/ColourMode';
import { describe, expect, it, vi } from 'vitest';
import { applyColourScheme, resolveColourScheme, type SystemScheme } from './colourScheme';
import { followColourScheme, type SchemeSources } from './followColourScheme';

describe('resolveColourScheme', () => {
	it('lets a forced choice win over the system', () => {
		expect(resolveColourScheme('light', 'dark')).toBe('light');
		expect(resolveColourScheme('dark', 'light')).toBe('dark');
	});

	it('follows the system in system mode', () => {
		expect(resolveColourScheme('system', 'dark')).toBe('dark');
		expect(resolveColourScheme('system', 'light')).toBe('light');
	});

	it('leaves the page to the browser when the system has no preference', () => {
		expect(resolveColourScheme('system', 'noPreference')).toBeNull();
	});
});

describe('applyColourScheme', () => {
	it('sets and clears the attribute the tokens read', () => {
		const root = document.createElement('div');
		applyColourScheme('dark', root);
		expect(root.dataset.flsTheme).toBe('dark');
		applyColourScheme(null, root);
		expect(root.dataset.flsTheme).toBeUndefined();
	});
});

/** Sources the test drives by hand. */
function fakeSources(mode: ColourMode, system: SystemScheme) {
	let onMode: (mode: ColourMode) => void = () => {};
	let onSystem: (scheme: SystemScheme) => void = () => {};
	const stops = { mode: vi.fn(), system: vi.fn() };
	const sources: SchemeSources = {
		mode: async () => mode,
		onModeChanged: (listener) => {
			onMode = listener;
			return stops.mode;
		},
		system: async () => system,
		onSystemChanged: (listener) => {
			onSystem = listener;
			return stops.system;
		},
	};
	return {
		sources,
		stops,
		changeMode: (m: ColourMode) => onMode(m),
		changeSystem: (s: SystemScheme) => onSystem(s),
	};
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('followColourScheme', () => {
	it('applies the system scheme at start and when it changes', async () => {
		const root = document.createElement('div');
		const fake = fakeSources('system', 'dark');
		followColourScheme(fake.sources, root);
		await settle();
		expect(root.dataset.flsTheme).toBe('dark');
		fake.changeSystem('light');
		expect(root.dataset.flsTheme).toBe('light');
	});

	it('applies a choice made in the settings, and system mode goes back to following', async () => {
		const root = document.createElement('div');
		const fake = fakeSources('system', 'light');
		followColourScheme(fake.sources, root);
		await settle();
		fake.changeMode('dark');
		expect(root.dataset.flsTheme).toBe('dark');
		fake.changeSystem('light');
		expect(root.dataset.flsTheme).toBe('dark');
		fake.changeMode('system');
		expect(root.dataset.flsTheme).toBe('light');
	});

	it('does not let a late read undo a newer event', async () => {
		const root = document.createElement('div');
		const fake = fakeSources('system', 'light');
		followColourScheme(fake.sources, root);
		fake.changeSystem('dark');
		await settle();
		expect(root.dataset.flsTheme).toBe('dark');
	});

	it('leaves the page alone when neither source can answer', async () => {
		const root = document.createElement('div');
		const stop = followColourScheme(
			{
				mode: () => Promise.reject(new Error('no plugin')),
				onModeChanged: () => () => {},
				system: () => Promise.reject(new Error('no plugin')),
				onSystemChanged: () => () => {},
			},
			root,
		);
		await settle();
		expect(root.dataset.flsTheme).toBeUndefined();
		stop();
	});

	it('stops listening when stopped', () => {
		const fake = fakeSources('system', 'light');
		followColourScheme(fake.sources, document.createElement('div'))();
		expect(fake.stops.mode).toHaveBeenCalled();
		expect(fake.stops.system).toHaveBeenCalled();
	});
});
