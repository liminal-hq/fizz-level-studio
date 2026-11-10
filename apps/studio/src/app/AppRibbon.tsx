// The ribbon: tabs of grouped commands under the menus, 124 px open and 34 px folded
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Ribbon } from '@liminal-hq/fizz-studio-ribbon/Ribbon';
import type { RibbonCommand } from '@liminal-hq/fizz-studio-ribbon/types';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useBridgeSnapshot } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
import { buildRibbon, contextualTabs } from '../commands/ribbonModel';
import { t } from '../i18n/messages';
import { useSurfaceMenu } from './useSurfaceMenu';
import { ChevronDownIcon, ChevronUpIcon } from '../icons/AppIcons';
import { Tooltip } from '../ui/Tooltip';
import { wrapControlInTooltip } from '../ui/ribbonTooltip';
import styles from './AppRibbon.module.css';

export interface AppRibbonProps {
	/** Controls at the right end of the tab row, before the fold button: the workspace switcher. */
	end?: ReactNode;
}

/**
 * The ribbon over the commands now. Home holds the everyday groups, Level and View the rest, and a
 * Script tab appears (without taking the focus) while the Script panel is the one in use. The
 * `ui.ribbon_folded` setting folds it to its tab row; a tab opens its panel over the level, and Pin
 * keeps it open. Every item is a registry command run through `runCommand`.
 */
export function AppRibbon({ end }: AppRibbonProps) {
	const snapshot = useBridgeSnapshot();
	const model = useMemo(() => buildRibbon(snapshot), [snapshot]);
	const contextual = useMemo(() => contextualTabs(snapshot), [snapshot]);
	const folded = snapshot.facts.ribbonFolded;
	const onCommand = useCallback(
		(command: RibbonCommand) => {
			// The tab and the Pin are the ribbon's own; the File button reports the command it chose.
			if (command.id === 'tab' || command.id === 'mode') return;
			runCommand(command.id === 'file' ? String(command.value) : command.id, snapshot);
		},
		[snapshot],
	);
	const Chevron = folded ? ChevronDownIcon : ChevronUpIcon;
	const rowMenu = useSurfaceMenu<HTMLDivElement>(() => ({ kind: 'commandsRow', row: 'ribbon' }));
	return (
		<div className={styles.host} data-app-ribbon="" data-folded={folded || undefined} {...rowMenu}>
			<Ribbon
				model={model}
				contextual={contextual}
				variant={folded ? 'collapsed' : 'full'}
				onCommand={onCommand}
				wrapControl={wrapControlInTooltip}
				labels={{
					ribbon: t('ribbon.label'),
					toolbar: t('ribbon.toolbar'),
					tabs: t('ribbon.tabs'),
					pin: t('ribbon.pin'),
					unpin: t('ribbon.unpin'),
					decrease: t('ribbon.decrease'),
					increase: t('ribbon.increase'),
				}}
				end={
					<>
						{end}
						<Tooltip label={t(folded ? 'ribbon.unfold' : 'ribbon.fold')}>
							<button
								type="button"
								className={styles.fold}
								aria-pressed={folded}
								aria-label={t(folded ? 'ribbon.unfold' : 'ribbon.fold')}
								onClick={() => void runCommand('view.ribbon.fold', snapshot)}
							>
								<Chevron size={14} />
							</button>
						</Tooltip>
					</>
				}
			/>
		</div>
	);
}
