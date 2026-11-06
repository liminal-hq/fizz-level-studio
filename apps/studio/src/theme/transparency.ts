// The transparency settings' defaults and ranges, as the settings crate has them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import defaults from '@liminal-hq/fizz-studio-protocol/fixtures/default-transparency';
import type { TransparencySettings } from '@liminal-hq/fizz-studio-protocol/generated/TransparencySettings';

/**
 * `TransparencySettings::default()` in Rust. The fixture is the one both sides read, and a Rust
 * test fails when it drifts from the crate's defaults.
 */
export const TRANSPARENCY_DEFAULTS: TransparencySettings = defaults as TransparencySettings;

/** The ends of each range, inclusive: the settings crate refuses anything outside them. */
export const GLASS_BLUR_MAX = 40;
export const GLASS_SATURATION_MIN = 100;
export const GLASS_SATURATION_MAX = 200;
export const PANEL_OPACITY_MIN = 40;
export const MENU_OPACITY_MIN = 60;
export const OPACITY_MAX = 100;
