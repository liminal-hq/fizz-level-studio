// Asks each appearance and tear-off plugin what it can do on this desktop
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getStatus as systemAppearanceStatus } from '@liminal-hq/plugin-system-appearance';
import { getStatus as windowEffectsStatus } from '@liminal-hq/plugin-window-effects';
import { getStatus as windowManagerStatus } from '@liminal-hq/plugin-window-manager';
import { getStatus as windowTearoffStatus } from '@liminal-hq/plugin-window-tearoff';

/** One plugin's answer: what it reported, or why it could not. */
export type PluginAnswer = { ok: true; status: unknown } | { ok: false; error: string };

async function ask(status: () => Promise<unknown>): Promise<PluginAnswer> {
	try {
		return { ok: true, status: await status() };
	} catch (error) {
		return { ok: false, error: String(error) };
	}
}

/** Every plugin's status command, by plugin name. A plugin that fails is reported, not thrown. */
export async function pluginStatuses(): Promise<Record<string, PluginAnswer>> {
	const [appearance, manager, effects, tearoff] = await Promise.all([
		ask(systemAppearanceStatus),
		ask(windowManagerStatus),
		ask(windowEffectsStatus),
		ask(windowTearoffStatus),
	]);
	return {
		'system-appearance': appearance,
		'window-manager': manager,
		'window-effects': effects,
		'window-tearoff': tearoff,
	};
}
