// The locale in force: its catalogue, the `Intl` tags and a version that changes when it does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useSyncExternalStore } from 'react';
import { FALLBACK_LOCALE, intlTagFor, pluralTagFor, type Locale } from './locales';
import type { MessageId, PluralId } from './messages';

/** A plural form of a group, such as `items.count.one`. */
export type PluralFormId = `${PluralId}.${'zero' | 'one' | 'two' | 'few' | 'many' | 'other'}`;

/** A catalogue: some or all of the messages in one locale. A missing one falls back to English. */
export type Catalogue = Partial<Record<MessageId | PluralFormId, string>>;

interface ActiveLocale {
	locale: Locale;
	messages: Catalogue;
	version: number;
}

let active: ActiveLocale = { locale: FALLBACK_LOCALE, messages: {}, version: 0 };
const listeners = new Set<() => void>();

/** The locale messages are in now. */
export function activeLocale(): Locale {
	return active.locale;
}

/** The messages `t` reads before it falls back to English. */
export function activeMessages(): Catalogue {
	return active.messages;
}

/** The tag to hand `Intl.NumberFormat`, `Intl.DateTimeFormat` and the rest. */
export function formatLocale(): string {
	return intlTagFor(active.locale);
}

/** The tag to hand `Intl.PluralRules`, for the language the catalogue is in. */
export function pluralLocale(): string {
	return pluralTagFor(active.locale);
}

/** Changes whenever `setActiveLocale` is called, for `useSyncExternalStore`. */
export function localeVersion(): number {
	return active.version;
}

export function subscribeLocale(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Re-renders the component that calls it whenever the locale in force changes. */
export function useLocaleVersion(): number {
	return useSyncExternalStore(subscribeLocale, localeVersion);
}

/** Makes `messages` (already loaded) the catalogue in force, and tells whoever is listening. */
export function setActiveLocale(locale: Locale, messages: Catalogue): void {
	active = { locale, messages, version: active.version + 1 };
	for (const listener of [...listeners]) listener();
}

/** Puts the English catalogue back; for tests. */
export function resetActiveLocale(): void {
	setActiveLocale(FALLBACK_LOCALE, {});
}
