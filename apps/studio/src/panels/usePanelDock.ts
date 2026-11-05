// Whether a panel is docked in the main window or torn off into a window of its own
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import {
	panelLabel,
	panelWindowClient,
	type PanelWindowClient,
} from '../services/panelWindowClient';

export interface PanelDock {
	/** True while the panel's own window is open. */
	tornOff: boolean;
	tearOff(): void;
	dockBack(): void;
}

/**
 * Follows one panel's window. It learns which panel windows are open when it starts, hears each one
 * close (a close button, Dock back, or the app closing it), and assumes nothing else: a failed
 * command leaves the panel where it was.
 */
export function usePanelDock(
	panel: string,
	client: PanelWindowClient = panelWindowClient,
): PanelDock {
	const [tornOff, setTornOff] = useState(false);
	const label = panelLabel(panel);

	useEffect(() => {
		let live = true;
		const stop = client.onClosed((closed) => {
			if (closed === label) setTornOff(false);
		});
		void client
			.open()
			.then((open) => live && setTornOff(open.includes(label)))
			.catch(() => {});
		return () => {
			live = false;
			stop();
		};
	}, [client, label]);

	const tearOff = useCallback(() => {
		client
			.tearOff(panel)
			.then(() => setTornOff(true))
			.catch(() => {});
	}, [client, panel]);

	const dockBack = useCallback(() => {
		client
			.dockBack(panel)
			.then(() => setTornOff(false))
			.catch(() => {});
	}, [client, panel]);

	return { tornOff, tearOff, dockBack };
}
