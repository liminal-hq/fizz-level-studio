// The classic toolbar: one 40 px row under the menus of the buttons for the common commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { ClassicToolbar } from '@liminal-hq/fizz-studio-ribbon/ClassicToolbar';
import type { RibbonCommand } from '@liminal-hq/fizz-studio-ribbon/types';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useBridgeSnapshot } from '../commands/commandBridge';
import { runCommand } from '../commands/registry';
import { buildToolbar, panelToggles } from '../commands/toolbarModel';
import { t } from '../i18n/messages';
import { APP_ICONS } from '../icons/AppIcons';
import { spacingText } from '../tools/spacingText';
import { brushSwatch } from '../tools/swatch';
import { Tooltip } from '../ui/Tooltip';
import { wrapControlInTooltip } from '../ui/ribbonTooltip';
import styles from './AppToolbar.module.css';

export interface AppToolbarProps {
	/** Controls at the far right end, such as the workspace switcher while there is no menu bar. */
	end?: ReactNode;
}

/**
 * New, Open, Save and Close level, then Undo and Redo, then the brush chip, then (at the right) the
 * panel toggles. Every button is a registry command run through `runCommand`; the model is built
 * from the commands each time they change.
 */
export function AppToolbar({ end }: AppToolbarProps) {
	const snapshot = useBridgeSnapshot();
	const model = useMemo(() => buildToolbar(snapshot), [snapshot]);
	const toggles = useMemo(() => panelToggles(snapshot), [snapshot]);
	const onCommand = useCallback(
		(command: RibbonCommand) => void runCommand(command.id, snapshot),
		[snapshot],
	);
	const { brush, spacing } = snapshot.facts;
	return (
		<div className={styles.host} data-app-toolbar="">
			<ClassicToolbar
				model={model}
				label={t('toolbar.label')}
				onCommand={onCommand}
				wrapControl={wrapControlInTooltip}
				after={
					brush && (
						<Tooltip label={t('toolbar.brushTip')}>
							<button
								type="button"
								className={styles.chip}
								data-group={brush.group}
								onClick={() => void runCommand('panel.palette.show', snapshot)}
							>
								<span className={styles.swatch} style={brushSwatch(brush)} aria-hidden="true">
									{brush.kind.charAt(0).toUpperCase()}
								</span>
								{brush.group === 'item'
									? t('brush.chipSpaced', { kind: brush.kind, spacing: spacingText(spacing) })
									: t('brush.chip', { kind: brush.kind })}
							</button>
						</Tooltip>
					)
				}
				end={
					<>
						{toggles.length > 0 && (
							<div className={styles.panels} role="group" aria-label={t('toolbar.panels')}>
								{toggles.map((toggle) => {
									const Icon = APP_ICONS[`panel.${toggle.panel}`];
									return (
										<Tooltip
											key={toggle.command}
											label={toggle.label}
											keys={toggle.keys}
											reason={toggle.enabled ? undefined : toggle.reason}
										>
											<button
												type="button"
												className={styles.toggle}
												aria-pressed={toggle.pressed}
												aria-label={toggle.label}
												disabled={!toggle.enabled}
												onClick={() => void runCommand(toggle.command, snapshot)}
											>
												<Icon size={14} />
											</button>
										</Tooltip>
									);
								})}
							</div>
						)}
						{end}
					</>
				}
			/>
		</div>
	);
}
