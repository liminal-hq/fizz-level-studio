// The app's title bar: the shared chrome with the window's title in the middle
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { TitleBar } from '@liminal-hq/fizz-studio-chrome/TitleBar';
import { TitleBarTitle } from '@liminal-hq/fizz-studio-chrome/TitleBar/TitleBarTitle';

export function AppTitleBar({ title }: { title: string }) {
	return <TitleBar center={<TitleBarTitle>{title}</TitleBarTitle>} />;
}
