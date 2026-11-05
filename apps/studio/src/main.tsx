// Entry point: renders the app into the window Rust created
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getCurrentWindow } from '@tauri-apps/api/window';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LocaleRoot } from './i18n/LocaleRoot';
import { schemeSources } from './services/appearanceClient';
import { initLogger } from './services/logger';
import { followColourScheme } from './theme/followColourScheme';
import { applyPlatform } from './theme/platform';
import './theme/tokens.css';

const label = getCurrentWindow().label;

initLogger(label);
applyPlatform();
// The theme follows the settings document's colour mode, and the system's light or dark.
followColourScheme(schemeSources);

const root = document.getElementById('root');
if (!root) {
	throw new Error('The page has no #root element.');
}

createRoot(root).render(
	<StrictMode>
		<LocaleRoot>
			<App windowLabel={label} />
		</LocaleRoot>
	</StrictMode>,
);

console.info('The window is ready.');

// A developer measurement of the frame stream; never started in a release build.
if (import.meta.env.DEV && import.meta.env.VITE_FIZZ_PROBE === 'frames') {
	void import('./dev/frameProbe').then((probe) => probe.runFrameProbe());
}
