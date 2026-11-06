// The General page: the title bar choices, today whether the menus sit in a bar below it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { ButtonRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/ButtonRow';
import { SettingsGroup } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SettingsGroup';
import { SettingsSection } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SettingsSection';
import { ToggleRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/ToggleRow';
import { t } from '../i18n/messages';
import type { PreferencesEditor } from './usePreferencesSettings';

export interface GeneralPageProps {
	editor: PreferencesEditor;
}

export function GeneralPage({ editor }: GeneralPageProps) {
	const { values, errors, change, reset } = editor;
	if (!values) return null;
	return (
		<SettingsSection>
			<SettingsGroup title={t('preferences.group.titleBar')}>
				<ToggleRow
					label={t('preferences.menuBar.label')}
					description={t('preferences.menuBar.description')}
					error={errors.menuBar}
					checked={values.ui.menu_bar}
					onChange={(menu_bar) => void change('menuBar', { ui: { ...values.ui, menu_bar } })}
				/>
			</SettingsGroup>
			<SettingsGroup>
				<ButtonRow
					label={t('preferences.reset.label')}
					description={t('preferences.reset.descriptionGeneral')}
					actionLabel={t('preferences.reset.action')}
					onAction={() => void reset('general')}
				/>
			</SettingsGroup>
		</SettingsSection>
	);
}
