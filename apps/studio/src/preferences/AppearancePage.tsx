// The Appearance page: colour mode, accent and glass, with a live sample of the result
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { ButtonRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/ButtonRow';
import { ColourRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/ColourRow';
import { SegmentedRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SegmentedRow';
import { SelectRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SelectRow';
import { SettingsGroup } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SettingsGroup';
import { SettingsSection } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SettingsSection';
import { TextRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/TextRow';
import type { AccentChoice } from '@liminal-hq/fizz-studio-protocol/generated/AccentChoice';
import { t } from '../i18n/messages';
import { DEFAULT_ACCENT, isHexColour, type Scheme } from '../theme/accent';
import { resolveAccentHex, resolveGlass } from '../theme/accentChoice';
import { resolveColourScheme, type SystemScheme } from '../theme/colourScheme';
import { AccentPreview } from './AccentPreview';
import type { PreferencesEditor } from './usePreferencesSettings';

/** What the system reports that the page needs to show an honest sample. */
export interface SystemAppearance {
	accent: string | null;
	scheme: SystemScheme;
	reducedTransparency: boolean;
}

export interface AppearancePageProps {
	editor: PreferencesEditor;
	system: SystemAppearance;
}

type AccentKind = AccentChoice['kind'];

/** The choice for a kind picked from the list; a custom one starts from the colour in force. */
function choiceOf(kind: AccentKind, current: AccentChoice, shown: string): AccentChoice {
	if (kind === 'custom') {
		return { kind, hex: current.kind === 'custom' ? current.hex : shown };
	}
	return { kind };
}

export function AppearancePage({ editor, system }: AppearancePageProps) {
	const { values, errors, change, reset } = editor;
	if (!values) return null;
	const { accent } = values;
	const scheme: Scheme =
		resolveColourScheme(values.colour_mode, system.scheme) ??
		(window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
	const shown = resolveAccentHex(accent, system.accent) ?? DEFAULT_ACCENT[scheme];
	const customHex = accent.kind === 'custom' ? accent.hex : shown;
	const solid = resolveGlass(values.glass, system.reducedTransparency) === 'solid';

	return (
		<SettingsSection>
			<SettingsGroup title={t('preferences.group.colours')}>
				<SegmentedRow
					label={t('preferences.mode.label')}
					description={t('preferences.mode.description')}
					error={errors.colourMode}
					value={values.colour_mode}
					options={[
						{ value: 'system', label: t('preferences.follow') },
						{ value: 'light', label: t('preferences.mode.light') },
						{ value: 'dark', label: t('preferences.mode.dark') },
					]}
					onChange={(colour_mode) => void change('colourMode', { colour_mode })}
				/>
				<SelectRow
					label={t('preferences.accent.label')}
					description={t('preferences.accent.description')}
					error={errors.accent}
					value={accent.kind}
					options={[
						{ value: 'system', label: t('preferences.follow') },
						{ value: 'studio', label: t('preferences.accent.studio') },
						{ value: 'afterglow-orange', label: t('preferences.accent.orange') },
						{ value: 'afterglow-purple', label: t('preferences.accent.purple') },
						{ value: 'custom', label: t('preferences.accent.custom') },
					]}
					onChange={(kind) => void change('accent', { accent: choiceOf(kind, accent, shown) })}
				/>
				{accent.kind === 'custom' ? (
					<>
						<ColourRow
							label={t('preferences.accentColour.label')}
							description={t('preferences.accentColour.description')}
							value={isHexColour(customHex) ? customHex.toLowerCase() : shown}
							onChange={(hex) => void change('accentHex', { accent: { kind: 'custom', hex } })}
						/>
						<TextRow
							label={t('preferences.accentHex.label')}
							description={t('preferences.accentHex.description')}
							error={errors.accentHex}
							value={customHex}
							size={9}
							onCommit={(text) =>
								void change('accentHex', {
									accent: { kind: 'custom', hex: text.trim().toLowerCase() },
								})
							}
						/>
					</>
				) : null}
				<AccentPreview
					accent={resolveAccentHex(accent, system.accent)}
					scheme={scheme}
					solid={solid}
				/>
			</SettingsGroup>
			<SettingsGroup title={t('preferences.group.effects')}>
				<SegmentedRow
					label={t('preferences.glass.label')}
					description={t('preferences.glass.description')}
					error={errors.glass}
					value={values.glass}
					options={[
						{ value: 'system', label: t('preferences.follow') },
						{ value: 'on', label: t('preferences.glass.on') },
						{ value: 'off', label: t('preferences.glass.off') },
					]}
					onChange={(glass) => void change('glass', { glass })}
				/>
			</SettingsGroup>
			<SettingsGroup>
				<ButtonRow
					label={t('preferences.reset.label')}
					description={t('preferences.reset.description')}
					actionLabel={t('preferences.reset.action')}
					onAction={() => void reset('appearance')}
				/>
			</SettingsGroup>
		</SettingsSection>
	);
}
