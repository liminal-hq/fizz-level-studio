// The application menu's rows and what choosing one does, shared by the title bar button and the menu bar
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useMemo } from 'react';
import { appMenuItems } from '../commands/appMenuModel';
import { useBridgeSnapshot } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';

export function useAppMenu() {
	const snapshot = useBridgeSnapshot();
	const items = useMemo(() => appMenuItems(snapshot), [snapshot]);
	const onSelect = useCallback(
		(item: { id: string }) => {
			runCommand(item.id, snapshot);
		},
		[snapshot],
	);
	return { items, onSelect };
}
