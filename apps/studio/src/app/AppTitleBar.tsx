// The app's title bar: the shared chrome with the window's title in the middle, also set as the native title
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { TitleBar } from '@liminal-hq/fizz-studio-chrome/TitleBar';
import { TitleBarTitle } from '@liminal-hq/fizz-studio-chrome/TitleBar/TitleBarTitle';
import { useEffect, type ReactNode } from 'react';
import { chromeLabels } from '../i18n/chromeLabels';
import { t, type MessageId } from '../i18n/messages';
import { setWindowTitle } from '../services/windowTitleClient';

export interface AppTitleBarProps {
	/** The catalogue key of the title when no document is named. Defaults to the start screen's. */
	titleId?: MessageId;
	/** The open document's name; the title then reads just the name. */
	documentName?: string;
	/** Marks the document with a “•” when it has unsaved changes. */
	dirty?: boolean;
	/** The start slot: the Main window puts its application menu here. */
	start?: ReactNode;
}

export function AppTitleBar({
	titleId = 'window.main.start',
	documentName,
	dirty,
	start,
}: AppTitleBarProps) {
	const title =
		documentName === undefined
			? t(titleId)
			: t(dirty ? 'window.main.titledDirty' : 'window.main.titled', { name: documentName });
	// The operating system's title for this window (taskbar, Alt+Tab) follows the title bar's text.
	useEffect(() => {
		document.title = title;
		void setWindowTitle(title).catch(() => {});
	}, [title]);
	// Always mixed with `--fls-title-bar-opacity`, as the menu bar is: it is 1 (solid) until the
	// Transparency settings put the title bar under glass (theme/tokens.css).
	return (
		<TitleBar
			transparent
			labels={chromeLabels()}
			start={start}
			center={<TitleBarTitle>{title}</TitleBarTitle>}
		/>
	);
}
