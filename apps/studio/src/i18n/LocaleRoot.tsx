// Brings in the catalogue for the locale before a window draws, and rebuilds the content when it changes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useLocaleVersion } from './active';
import { activateLocale } from './loadCatalogue';

interface LocaleRootProps {
	/**
	 * The locale tag to show. A developer build reads `VITE_FIZZ_LOCALE` (for example `en-XA`) when
	 * this is not supplied; a release build always shows English until the settings plugin lands.
	 */
	locale?: string;
	/** Whether the pseudo-locales exist: a developer build unless supplied. */
	developer?: boolean;
	children: ReactNode;
}

/** The locale a developer asked for in the environment; ignored outside a developer build. */
function environmentLocale(developer: boolean): string | undefined {
	const tag: unknown = developer ? import.meta.env.VITE_FIZZ_LOCALE : undefined;
	return typeof tag === 'string' && tag !== '' ? tag : undefined;
}

/**
 * Mounted once per window. It draws nothing until the catalogue is in, so no window shows
 * untranslated text and then switches. Components read their messages with `t()` while they render,
 * so a change of locale loads the new catalogue first and then rebuilds the content in it.
 */
export function LocaleRoot({ locale, developer, children }: LocaleRootProps) {
	const [loaded, setLoaded] = useState(false);
	const version = useLocaleVersion();
	const isDeveloper = developer ?? import.meta.env.DEV;
	const requested = locale ?? environmentLocale(isDeveloper);

	useEffect(() => {
		let live = true;
		void activateLocale({ requested, developer: isDeveloper }).then(() => live && setLoaded(true));
		return () => {
			live = false;
		};
	}, [requested, isDeveloper]);

	if (!loaded) return null;
	return <Fragment key={version}>{children}</Fragment>;
}
