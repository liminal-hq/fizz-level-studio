// The locales the studio has catalogues for, and how a requested tag picks among them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** The languages that ship, as BCP 47 tags. `en-CA` is the source catalogue and the fallback. */
export const LOCALES = ['en-CA'] as const;

/**
 * Developer-only pseudo-locales: `en-XA` is English with accented letters and about a third more
 * text, `ar-XB` is the same in a right-to-left wrapper. They prove the catalogue loader, text
 * expansion and mirrored layout, and are accepted only in a developer build.
 */
export const PSEUDO_LOCALES = ['en-XA', 'ar-XB'] as const;

export type ShippedLocale = (typeof LOCALES)[number];
export type PseudoLocale = (typeof PSEUDO_LOCALES)[number];
export type Locale = ShippedLocale | PseudoLocale;

/** The catalogue every missing message falls back to. */
export const FALLBACK_LOCALE: ShippedLocale = 'en-CA';

export function isPseudoLocale(tag: string): tag is PseudoLocale {
	return (PSEUDO_LOCALES as readonly string[]).includes(tag);
}

/** Whether `tag` has a catalogue, counting the pseudo-locales only for a developer build. */
export function isAvailableLocale(tag: string, developer: boolean): tag is Locale {
	return (LOCALES as readonly string[]).includes(tag) || (developer && isPseudoLocale(tag));
}

/** What `Intl` should be given for a locale: a pseudo-locale borrows a real one that shows what it proves. */
export function intlTagFor(locale: Locale): string {
	switch (locale) {
		case 'en-XA':
			return 'en-CA';
		case 'ar-XB':
			// Arabic numerals and separators, so a right-to-left window shows them as they come out.
			return 'ar';
		default:
			return locale;
	}
}

/** The plural rules that fit a locale's catalogue: a pseudo-locale's text is still English. */
export function pluralTagFor(locale: Locale): string {
	return isPseudoLocale(locale) ? 'en' : locale;
}

/** Whether a locale's text runs right to left. */
export function isRightToLeftLocale(locale: Locale): boolean {
	return locale === 'ar-XB';
}

/**
 * The locale to use for a requested tag. A tag that is not available here (a pseudo-locale in a
 * release build, or anything without a catalogue) settles on the fallback.
 */
export function resolveLocale(requested: string | undefined, developer: boolean): Locale {
	return requested !== undefined && isAvailableLocale(requested, developer)
		? requested
		: FALLBACK_LOCALE;
}
