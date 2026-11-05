// The plugin's commands: read the settings, change them, and keep the recent worlds
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{PanelLayout, SettingsError, SettingsPatch, SettingsSnapshot};
use fizz_studio_settings::resolve_layout;
use tauri::State;

use crate::Store;

/// The settings in force and their revision.
#[tauri::command]
pub fn settings_get(store: State<'_, Store>) -> SettingsSnapshot {
    store.snapshot()
}

/// Lays `patch` over the settings if `based_on` is the revision in force. A stale revision rejects
/// with `{ kind: "stale", based_on, current }` and changes nothing; read the settings again and
/// retry. Returns what is now in force.
#[tauri::command]
pub fn settings_update(
    store: State<'_, Store>,
    patch: SettingsPatch,
    based_on: u64,
) -> Result<SettingsSnapshot, SettingsError> {
    store.update(&patch, based_on)
}

/// Puts a world's path at the front of the recent list.
#[tauri::command]
pub fn recent_touch(
    store: State<'_, Store>,
    path: String,
) -> Result<SettingsSnapshot, SettingsError> {
    store.touch_recent(&path)
}

/// Empties the recent list.
#[tauri::command]
pub fn recent_clear(store: State<'_, Store>) -> Result<SettingsSnapshot, SettingsError> {
    store.clear_recent()
}

/// The floating-panel layout in force for a window kind (`main` for the editor): the saved
/// placements laid over the defaults.
#[tauri::command]
pub fn layout_get(store: State<'_, Store>, kind: String) -> PanelLayout {
    resolve_layout(&store.snapshot().settings, &kind)
}

/// Saves the panel layout of a window kind. The newest save wins. Returns the layout now in force.
#[tauri::command]
pub fn layout_set(
    store: State<'_, Store>,
    kind: String,
    layout: PanelLayout,
) -> Result<PanelLayout, SettingsError> {
    let snapshot = store.set_layout(&kind, layout)?;
    Ok(resolve_layout(&snapshot.settings, &kind))
}

/// Forgets the saved layout of a window kind and returns the defaults.
#[tauri::command]
pub fn layout_reset(store: State<'_, Store>, kind: String) -> Result<PanelLayout, SettingsError> {
    let snapshot = store.reset_layout(&kind)?;
    Ok(resolve_layout(&snapshot.settings, &kind))
}
