// The app's title bar: the shared chrome with the window's title in the middle
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { TitleBar } from '@liminal-hq/fizz-studio-chrome/TitleBar';
import { TitleBarTitle } from '@liminal-hq/fizz-studio-chrome/TitleBar/TitleBarTitle';
import { chromeLabels } from '../i18n/chromeLabels';
import { t } from '../i18n/messages';

export function AppTitleBar() {
	return (
		<TitleBar
			labels={chromeLabels()}
			center={<TitleBarTitle>{t('window.main.title')}</TitleBarTitle>}
		/>
	);
}
