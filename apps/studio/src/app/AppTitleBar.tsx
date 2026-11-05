// The app's title bar: the shared chrome with the window's title in the middle
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { TitleBar } from '@liminal-hq/fizz-studio-chrome/TitleBar';
import { TitleBarTitle } from '@liminal-hq/fizz-studio-chrome/TitleBar/TitleBarTitle';
import type { ReactNode } from 'react';
import { chromeLabels } from '../i18n/chromeLabels';
import { t, type MessageId } from '../i18n/messages';

export interface AppTitleBarProps {
	/** The catalogue key of the title when no document is named. Defaults to the main title. */
	titleId?: MessageId;
	/** The open document's name; the title then reads “Name — Fizz Level Studio”. */
	documentName?: string;
	/** Marks the document with a “•” when it has unsaved changes. */
	dirty?: boolean;
	/** The start slot: the Main window puts its application menu here. */
	start?: ReactNode;
}

export function AppTitleBar({
	titleId = 'window.main.title',
	documentName,
	dirty,
	start,
}: AppTitleBarProps) {
	const title =
		documentName === undefined
			? t(titleId)
			: t(dirty ? 'window.main.titledDirty' : 'window.main.titled', { name: documentName });
	return (
		<TitleBar
			labels={chromeLabels()}
			start={start}
			center={<TitleBarTitle>{title}</TitleBarTitle>}
		/>
	);
}
