// Entry point: renders the app into the window Rust created
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getCurrentWindow } from '@tauri-apps/api/window';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initLogger } from './services/logger';
import { applyPlatform } from './theme/platform';
import './theme/tokens.css';

const label = getCurrentWindow().label;

initLogger(label);
applyPlatform();

const root = document.getElementById('root');
if (!root) {
	throw new Error('The page has no #root element.');
}

createRoot(root).render(
	<StrictMode>
		<App windowLabel={label} />
	</StrictMode>,
);

console.info('The window is ready.');
