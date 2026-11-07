// The application menu's rows and what choosing one does, shared by the title bar button and the menu bar
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useMemo } from 'react';
import { buildAppMenu, buildMenuBar, commandIdOfRow } from '../commands/appMenuModel';
import { useBridgeSnapshot } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';

/**
 * The rows the title bar's app menu (`flat`, the default) or the menu bar (`bar`) shows, and what
 * choosing one runs: always a command, through `runCommand`.
 */
export function useAppMenu(kind: 'flat' | 'bar' = 'flat') {
	const snapshot = useBridgeSnapshot();
	const items = useMemo(
		() => (kind === 'bar' ? buildMenuBar(snapshot) : buildAppMenu(snapshot)),
		[kind, snapshot],
	);
	const onSelect = useCallback(
		(item: { id: string }) => {
			runCommand(commandIdOfRow(item.id), snapshot);
		},
		[snapshot],
	);
	return { items, onSelect };
}
