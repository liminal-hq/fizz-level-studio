// The Preferences window: a settings shell with its pages, General, Appearance and Transparency
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { SettingsShell } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SettingsShell';
import type { SettingsSectionDef } from '@liminal-hq/fizz-studio-chrome/SettingsShell/types';
import { useEffect, useMemo, useState } from 'react';
import { AppWindow } from '../app/AppWindow';
import { t } from '../i18n/messages';
import { AppearanceIcon, PreferencesIcon, TransparencyIcon } from '../icons/AppIcons';
import { accentSources, schemeSources } from '../services/appearanceClient';
import { settingsClient, type SettingsClient } from '../services/settingsClient';
import {
	windowEffectsSource,
	type WindowEffectsAvailability,
	type WindowEffectsSource,
} from '../services/windowEffectsClient';
import type { AccentSources } from '../theme/followAccent';
import type { SchemeSources } from '../theme/followColourScheme';
import { GeneralPage } from './GeneralPage';
import { AppearancePage, type SystemAppearance } from './AppearancePage';
import styles from './PreferencesScreen.module.css';
import { TransparencyPage } from './TransparencyPage';
import { usePreferencesSettings } from './usePreferencesSettings';

export interface PreferencesScreenProps {
	/** The settings; defaults to the settings plugin. */
	client?: SettingsClient;
	/** What the system reports; default to the system-appearance plugin. */
	accent?: Pick<AccentSources, 'accentAvailable' | 'hints'>;
	scheme?: Pick<SchemeSources, 'system'>;
	/** What this system can do for a see-through window; defaults to the window-effects plugin. */
	effects?: WindowEffectsSource;
}

const NO_SYSTEM: SystemAppearance = {
	accent: null,
	scheme: 'noPreference',
	reducedTransparency: false,
};

export function PreferencesScreen({
	client = settingsClient,
	accent = accentSources,
	scheme = schemeSources,
	effects = windowEffectsSource,
}: PreferencesScreenProps) {
	const editor = usePreferencesSettings(client);
	const [system, setSystem] = useState<SystemAppearance>(NO_SYSTEM);
	const [activeId, setActiveId] = useState('general');
	const [available, setAvailable] = useState<WindowEffectsAvailability | null>(null);

	useEffect(() => {
		let gone = false;
		effects
			.availability()
			.then((read) => {
				if (!gone) setAvailable(read);
			})
			.catch(() => {});
		return () => {
			gone = true;
		};
	}, [effects]);

	useEffect(() => {
		let gone = false;
		void Promise.all([
			accent.accentAvailable().catch(() => false),
			accent.hints().catch(() => null),
			scheme.system().catch(() => 'noPreference' as const),
		]).then(([available, hints, systemScheme]) => {
			if (gone) return;
			setSystem({
				accent: available ? (hints?.accent ?? null) : null,
				scheme: systemScheme,
				reducedTransparency: hints?.reducedTransparency ?? false,
			});
		});
		return () => {
			gone = true;
		};
	}, [accent, scheme]);

	const sections = useMemo<SettingsSectionDef[]>(
		() => [
			{
				id: 'general',
				label: t('preferences.page.general'),
				icon: <PreferencesIcon />,
				render: () => <GeneralPage editor={editor} />,
			},
			{
				id: 'appearance',
				label: t('preferences.page.appearance'),
				icon: <AppearanceIcon />,
				render: () => <AppearancePage editor={editor} system={system} />,
			},
			{
				id: 'transparency',
				label: t('preferences.page.transparency'),
				icon: <TransparencyIcon />,
				render: () => <TransparencyPage editor={editor} system={system} effects={available} />,
			},
		],
		[editor, system, available],
	);

	return (
		<AppWindow titleId="window.preferences.title">
			<div className={styles.screen}>
				{editor.unavailable ? (
					<p role="alert" className={styles.unavailable}>
						{t('preferences.unavailable')}
					</p>
				) : null}
				<div className={styles.body}>
					<SettingsShell
						sections={sections}
						activeId={activeId}
						onSelect={setActiveId}
						labels={{ navigation: t('preferences.navigation') }}
					/>
				</div>
			</div>
		</AppWindow>
	);
}
