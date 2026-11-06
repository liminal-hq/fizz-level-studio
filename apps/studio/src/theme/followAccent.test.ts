// Tests for following the system's accent, transparency and contrast hints
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import {
	followAccent,
	SYSTEM_CHOICE,
	type AccentSources,
	type AppearanceChoice,
	type AppearanceHints,
} from './followAccent';
import { TRANSPARENCY_DEFAULTS } from './transparency';

const NORMAL: AppearanceHints = { accent: null, reducedTransparency: false, contrast: 'normal' };

/** Sources the test drives by hand. */
function fakeSources(
	available: boolean,
	hints: AppearanceHints,
	choice: AppearanceChoice = SYSTEM_CHOICE,
	seeThrough?: boolean,
) {
	let onHints: (hints: AppearanceHints) => void = () => {};
	let onChoice: (choice: AppearanceChoice) => void = () => {};
	let onFocus: (focused: boolean) => void = () => {};
	const stop = vi.fn();
	const stopChoice = vi.fn();
	const sources: AccentSources = {
		accentAvailable: async () => available,
		hints: async () => hints,
		choice: async () => choice,
		onChoiceChanged: (listener) => {
			onChoice = listener;
			return stopChoice;
		},
		onHintsChanged: (listener) => {
			onHints = listener;
			return stop;
		},
		...(seeThrough === undefined
			? {}
			: {
					seeThroughAvailable: async () => seeThrough,
					focused: async () => true,
					onFocusChanged: (listener: (focused: boolean) => void) => {
						onFocus = listener;
						return () => {};
					},
				}),
	};
	return {
		sources,
		stop,
		stopChoice,
		change: (next: AppearanceHints) => onHints(next),
		choose: (next: AppearanceChoice) => onChoice(next),
		focus: (focused: boolean) => onFocus(focused),
	};
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
			choice: () => Promise.reject(new Error('no plugin')),
			onChoiceChanged: () => () => {},
		};
		followAccent(failing, root)();
		await settle();
		expect(root.style.getPropertyValue('--fls-accent')).toBe('');
	});

	it('stops following', () => {
		const fake = fakeSources(true, NORMAL);
		followAccent(fake.sources, document.createElement('div'))();
		expect(fake.stop).toHaveBeenCalled();
		expect(fake.stopChoice).toHaveBeenCalled();
	});

	describe('the person’s choice', () => {
		const SYSTEM = { ...NORMAL, accent: '#3584e4' };
		const accentOf = async (choice: AppearanceChoice) => {
			const root = document.createElement('div');
			followAccent(fakeSources(true, SYSTEM, choice).sources, root);
			await settle();
			return root.style.getPropertyValue('--fls-accent');
		};

		it('uses the system accent for system', async () => {
			expect(
				await accentOf({
					accent: { kind: 'system' },
					glass: 'system',
					transparency: TRANSPARENCY_DEFAULTS,
				}),
			).toBe('#3584e4');
		});

		it('clears the accent for the studio cyan, whatever the system has', async () => {
			expect(
				await accentOf({
					accent: { kind: 'studio' },
					glass: 'system',
					transparency: TRANSPARENCY_DEFAULTS,
				}),
			).toBe('');
		});

		it('uses the Afterglow presets', async () => {
			expect(
				await accentOf({
					accent: { kind: 'afterglow-orange' },
					glass: 'system',
					transparency: TRANSPARENCY_DEFAULTS,
				}),
			).toBe('#ffaa40');
			expect(
				await accentOf({
					accent: { kind: 'afterglow-purple' },
					glass: 'system',
					transparency: TRANSPARENCY_DEFAULTS,
				}),
			).toBe('#a78bfa');
		});

		it('uses a custom colour, even where the system supplies none', async () => {
			const root = document.createElement('div');
			followAccent(
				fakeSources(false, NORMAL, {
					accent: { kind: 'custom', hex: '#123abc' },
					glass: 'system',
					transparency: TRANSPARENCY_DEFAULTS,
				}).sources,
				root,
			);
			await settle();
			expect(root.style.getPropertyValue('--fls-accent')).toBe('#123abc');
		});

		it('follows a change made in another window', async () => {
			const root = document.createElement('div');
			const fake = fakeSources(true, SYSTEM);
			followAccent(fake.sources, root);
			await settle();
			fake.choose({
				accent: { kind: 'afterglow-orange' },
				glass: 'off',
				transparency: TRANSPARENCY_DEFAULTS,
			});
			expect(root.style.getPropertyValue('--fls-accent')).toBe('#ffaa40');
			expect(root.dataset.flsTransparency).toBe('reduced');
			fake.choose(SYSTEM_CHOICE);
			expect(root.style.getPropertyValue('--fls-accent')).toBe('#3584e4');
			expect(root.dataset.flsTransparency).toBeUndefined();
		});

		it('does not let a late read undo a newer choice', async () => {
			const root = document.createElement('div');
			const fake = fakeSources(true, SYSTEM, SYSTEM_CHOICE);
			followAccent(fake.sources, root);
			fake.choose({
				accent: { kind: 'afterglow-purple' },
				glass: 'system',
				transparency: TRANSPARENCY_DEFAULTS,
			});
			await settle();
			expect(root.style.getPropertyValue('--fls-accent')).toBe('#a78bfa');
		});

		it('draws solid panels for glass off, and glass for on even when the system asks for less', async () => {
			const reduced = { ...NORMAL, reducedTransparency: true };
			const run = async (glass: AppearanceChoice['glass']) => {
				const root = document.createElement('div');
				followAccent(
					fakeSources(true, reduced, {
						accent: { kind: 'system' },
						glass,
						transparency: TRANSPARENCY_DEFAULTS,
					}).sources,
					root,
				);
				await settle();
				return root;
			};
			expect((await run('system')).dataset.flsTransparency).toBe('reduced');
			const off = await run('off');
			expect(off.dataset.flsTransparency).toBe('reduced');
			expect(off.dataset.flsGlass).toBeUndefined();
			const on = await run('on');
			expect(on.dataset.flsTransparency).toBeUndefined();
			expect(on.dataset.flsGlass).toBe('on');
		});
	});

	describe('the transparency settings', () => {
		const WINDOW = { ...TRANSPARENCY_DEFAULTS, window_enabled: true };
		const choice = (over: Partial<AppearanceChoice> = {}): AppearanceChoice => ({
			...SYSTEM_CHOICE,
			transparency: WINDOW,
			...over,
		});

		it('writes the glass values and switches on the root, and follows a change', async () => {
			const root = document.createElement('div');
			const fake = fakeSources(true, NORMAL);
			followAccent(fake.sources, root);
			await settle();
			expect(root.style.getPropertyValue('--fls-glass-blur')).toBe('16px');
			expect(root.dataset.flsGlassDocks).toBe('on');
			fake.choose({
				...SYSTEM_CHOICE,
				transparency: {
					...TRANSPARENCY_DEFAULTS,
					blur: 30,
					saturation: 180,
					panel_opacity: 60,
					menus: true,
				},
			});
			expect(root.style.getPropertyValue('--fls-glass-blur')).toBe('30px');
			expect(root.style.getPropertyValue('--fls-glass-saturation')).toBe('180%');
			expect(root.style.getPropertyValue('--fls-glass-alpha')).toBe('0.6');
			expect(root.dataset.flsGlassMenus).toBe('on');
		});

		it('lets the desktop through only where the window can, while it is in front', async () => {
			const root = document.createElement('div');
			const fake = fakeSources(true, NORMAL, choice(), true);
			followAccent(fake.sources, root);
			await settle();
			expect(root.dataset.flsWindow).toBe('see-through');
			fake.focus(false);
			expect(root.dataset.flsWindow).toBeUndefined();
			fake.choose(choice({ transparency: { ...WINDOW, solid_when_unfocused: false } }));
			expect(root.dataset.flsWindow).toBe('see-through');
		});

		it('keeps the window solid where it cannot be see-through, or glass is off', async () => {
			const cannot = document.createElement('div');
			followAccent(fakeSources(true, NORMAL, choice(), false).sources, cannot);
			const unknown = document.createElement('div');
			followAccent(fakeSources(true, NORMAL, choice()).sources, unknown);
			const off = document.createElement('div');
			followAccent(fakeSources(true, NORMAL, choice({ glass: 'off' }), true).sources, off);
			const reduced = document.createElement('div');
			followAccent(
				fakeSources(true, { ...NORMAL, reducedTransparency: true }, choice(), true).sources,
				reduced,
			);
			await settle();
			for (const root of [cannot, unknown, off, reduced]) {
				expect(root.dataset.flsWindow).toBeUndefined();
			}
		});
	});
});
