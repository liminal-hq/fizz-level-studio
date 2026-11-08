// The Transparency page: the glass of the panels and menus, the see-through window, a reset and a live preview
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { ButtonRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/ButtonRow';
import { SegmentedRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SegmentedRow';
import { SettingsGroup } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SettingsGroup';
import { SettingsSection } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SettingsSection';
import { SliderRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/SliderRow';
import { ToggleRow } from '@liminal-hq/fizz-studio-chrome/SettingsShell/ToggleRow';
import type { TransparencySettings } from '@liminal-hq/fizz-studio-protocol/generated/TransparencySettings';
import { useState } from 'react';
import { t, type MessageId } from '../i18n/messages';
import type { WindowEffectsAvailability } from '../services/windowEffectsClient';
import { resolveGlass } from '../theme/accentChoice';
import {
	GLASS_BLUR_MAX,
	GLASS_SATURATION_MAX,
	GLASS_SATURATION_MIN,
	MENU_OPACITY_MIN,
	OPACITY_MAX,
	PANEL_OPACITY_MIN,
	transparencyAtDefaults,
} from '../theme/transparency';
import type { SystemAppearance } from './AppearancePage';
import styles from './TransparencyPage.module.css';
import { TransparencyPreview } from './TransparencyPreview';
import type { PreferencesEditor, PreferencesField } from './usePreferencesSettings';

export interface TransparencyPageProps {
	editor: PreferencesEditor;
	system: SystemAppearance;
	/** What the window-effects plugin says this system can do; `null` until it answers, or when it cannot. */
	effects: WindowEffectsAvailability | null;
}

type SliderKey = 'blur' | 'saturation' | 'panel_opacity' | 'menu_opacity';

interface SliderDef {
	key: SliderKey;
	field: PreferencesField;
	label: MessageId;
	description: MessageId;
	min: number;
	max: number;
	unit: MessageId;
}

/** The sliders of the Panels and menus group, before the surface switches. */
const SLIDERS: SliderDef[] = [
	{
		key: 'blur',
		field: 'blur',
		label: 'preferences.transparency.blur.label',
		description: 'preferences.transparency.blur.description',
		min: 0,
		max: GLASS_BLUR_MAX,
		unit: 'preferences.unit.pixels',
	},
	{
		key: 'saturation',
		field: 'saturation',
		label: 'preferences.transparency.saturation.label',
		description: 'preferences.transparency.saturation.description',
		min: GLASS_SATURATION_MIN,
		max: GLASS_SATURATION_MAX,
		unit: 'preferences.unit.percent',
	},
	{
		key: 'panel_opacity',
		field: 'panelOpacity',
		label: 'preferences.transparency.panelOpacity.label',
		description: 'preferences.transparency.panelOpacity.description',
		min: PANEL_OPACITY_MIN,
		max: OPACITY_MAX,
		unit: 'preferences.unit.percent',
	},
];

/** The menu opacity, after the surface switches and dimmed while menus are solid. */
const MENU_OPACITY: SliderDef = {
	key: 'menu_opacity',
	field: 'menuOpacity',
	label: 'preferences.transparency.menuOpacity.label',
	description: 'preferences.transparency.menuOpacity.description',
	min: MENU_OPACITY_MIN,
	max: OPACITY_MAX,
	unit: 'preferences.unit.percent',
};

type SurfaceKey = 'docks' | 'floating' | 'menus' | 'dialogs' | 'title_bar';

const SURFACES: {
	key: SurfaceKey;
	field: PreferencesField;
	label: MessageId;
	description: MessageId;
}[] = [
	{
		key: 'docks',
		field: 'docks',
		label: 'preferences.transparency.docks.label',
		description: 'preferences.transparency.docks.description',
	},
	{
		key: 'floating',
		field: 'floating',
		label: 'preferences.transparency.floating.label',
		description: 'preferences.transparency.floating.description',
	},
	{
		key: 'menus',
		field: 'menus',
		label: 'preferences.transparency.menus.label',
		description: 'preferences.transparency.menus.description',
	},
	{
		key: 'dialogs',
		field: 'dialogs',
		label: 'preferences.transparency.dialogs.label',
		description: 'preferences.transparency.dialogs.description',
	},
	{
		key: 'title_bar',
		field: 'titleBar',
		label: 'preferences.transparency.titleBar.label',
		description: 'preferences.transparency.titleBar.description',
	},
];

/**
 * Transparency over the `transparency` settings, with the Appearance page's Glass panels as the
 * master switch. The sliders preview while they are dragged, in the sample and nowhere else, and
 * save when they are let go; every window then draws the saved values. What the system can do
 * decides what the Window group offers: where windows cannot be see-through the switch says so and
 * is dimmed, and where nothing can blur behind a window the Desktop blur row is left out and the
 * reason is shown instead.
 */
export function TransparencyPage({ editor, system, effects }: TransparencyPageProps) {
	const { values, errors, change, reset } = editor;
	// The values sliders hold while they are dragged, before they are saved.
	const [drag, setDrag] = useState<Partial<Record<SliderKey, number>>>({});
	if (!values) return null;
	const saved = values.transparency;
	// Only the sliders held now: a key left in `drag` with no value would overwrite the saved one.
	const shown: TransparencySettings = { ...saved, ...drag };
	const solid = resolveGlass(values.glass, system.reducedTransparency) === 'solid';
	const seeThrough = effects?.seeThrough === true;
	const windowOff = !seeThrough || !saved.window_enabled;

	const save = (field: PreferencesField, next: Partial<TransparencySettings>) =>
		void change(field, (settings) => ({
			transparency: { ...settings.transparency, ...next },
		}));

	const slider = (row: SliderDef, disabled = false) => (
		<SliderRow
			key={row.key}
			label={t(row.label)}
			description={t(row.description)}
			error={errors[row.field]}
			value={saved[row.key]}
			min={row.min}
			max={row.max}
			unit={t(row.unit)}
			disabled={disabled}
			onInput={(value) => setDrag((current) => ({ ...current, [row.key]: value }))}
			onChange={(value) => {
				setDrag(({ [row.key]: _released, ...held }) => held);
				save(row.field, { [row.key]: value });
			}}
		/>
	);

	return (
		<SettingsSection>
			{solid ? (
				<p className={styles.note} role="status">
					{t('preferences.transparency.solidNote')}
				</p>
			) : null}
			<TransparencyPreview transparency={shown} solid={solid} seeThrough={seeThrough} />
			<SettingsGroup title={t('preferences.group.transparencyPanels')}>
				{SLIDERS.map((row) => slider(row))}
				{SURFACES.map((row) => (
					<ToggleRow
						key={row.key}
						label={t(row.label)}
						description={t(row.description)}
						error={errors[row.field]}
						checked={saved[row.key]}
						onChange={(on) => save(row.field, { [row.key]: on })}
					/>
				))}
				{slider(MENU_OPACITY, !saved.menus)}
			</SettingsGroup>
			<SettingsGroup title={t('preferences.group.transparencyWindow')}>
				<ToggleRow
					label={t('preferences.transparency.window.label')}
					description={t('preferences.transparency.window.description')}
					error={errors.windowEnabled}
					checked={saved.window_enabled}
					disabled={!seeThrough}
					unavailableReason={
						effects && !seeThrough ? t('preferences.transparency.window.unavailable') : undefined
					}
					onChange={(window_enabled) => save('windowEnabled', { window_enabled })}
				/>
				{effects && seeThrough && !effects.blur ? (
					<p className={styles.note}>{t('preferences.transparency.windowBlur.unavailable')}</p>
				) : (
					<SegmentedRow
						label={t('preferences.transparency.windowBlur.label')}
						description={t('preferences.transparency.windowBlur.description')}
						error={errors.windowBlur}
						value={saved.window_blur}
						disabled={windowOff}
						options={[
							{ value: 'off', label: t('preferences.transparency.windowBlur.off') },
							{ value: 'low', label: t('preferences.transparency.windowBlur.low') },
							{ value: 'high', label: t('preferences.transparency.windowBlur.high') },
						]}
						onChange={(window_blur) => save('windowBlur', { window_blur })}
					/>
				)}
				<ToggleRow
					label={t('preferences.transparency.solidUnfocused.label')}
					description={t('preferences.transparency.solidUnfocused.description')}
					error={errors.solidUnfocused}
					checked={saved.solid_when_unfocused}
					disabled={windowOff}
					onChange={(solid_when_unfocused) => save('solidUnfocused', { solid_when_unfocused })}
				/>
			</SettingsGroup>
			<SettingsGroup>
				<ButtonRow
					label={t('preferences.reset.label')}
					description={t('preferences.reset.descriptionTransparency')}
					error={errors.resetTransparency}
					actionLabel={t('preferences.reset.action')}
					disabled={transparencyAtDefaults(saved)}
					onAction={() => {
						setDrag({});
						void reset('transparency');
					}}
				/>
			</SettingsGroup>
		</SettingsSection>
	);
}
