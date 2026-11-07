// Registers the worlds plugin: open levels as sessions, one writer, snapshots to every window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod commands;
mod open;
mod recovery;
#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, RunEvent, Runtime};

pub use open::Worlds;
pub use recovery::{RecoveryConfig, AUTOSAVE_INTERVAL};

/// Sent to every window after every change to an open level, with a `LevelSnapshot`. A window
/// ignores a snapshot at or below the revision it has already applied for that level.
pub const CHANGED_EVENT: &str = "level://changed";

/// Sent to every window when a file changed outside the studio in the same lines as unsaved changes.
/// The session is left as it was; the payload is a [`LevelConflict`].
pub const CONFLICT_EVENT: &str = "level://conflict";

/// Sent to every window when a level's locked layers change, whoever changed them; the payload is
/// a [`LevelLayers`].
pub const LAYERS_EVENT: &str = "level://layers";

/// The locked layers of one open level, by layer id in panel order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LevelLayers {
    pub id: String,
    pub locked: Vec<String>,
}

/// What the person is shown to settle a conflicting outside edit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LevelConflict {
    /// The level whose file changed.
    pub id: String,
    /// The text with conflict markers where both sides changed the same lines.
    pub marked: String,
    /// The locked layers the outside change would have altered, when the studio refused it for that
    /// reason (then `marked` is the outside text, and the studio kept its own). Empty for a
    /// conflict over the same lines.
    #[serde(default)]
    pub locked: Vec<String>,
}

/// Registers the plugin, keeping recovery copies under the app's data directory every
/// [`AUTOSAVE_INTERVAL`].
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    init_with(RecoveryConfig::default())
}

/// Registers the plugin with its own recovery folder and autosave interval.
pub fn init_with<R: Runtime>(config: RecoveryConfig) -> TauriPlugin<R> {
    Builder::new("fizz-studio-worlds")
        .invoke_handler(tauri::generate_handler![
            commands::project_open,
            commands::level_open,
            commands::level_apply,
            commands::level_end_step,
            commands::level_undo,
            commands::level_redo,
            commands::level_save,
            commands::level_close,
            commands::level_create,
            commands::recovery_list,
            commands::recovery_restore,
            commands::recovery_discard,
            commands::language_words,
            commands::level_cell_line,
            commands::level_ghosts,
            commands::level_snapshot,
            commands::level_layers,
            commands::level_set_layer_locked,
            commands::level_view_masked,
        ])
        .setup(move |app, _api| {
            app.manage(Worlds::from_config(app, config));
            Ok(())
        })
        .on_event(|app, event| {
            if let RunEvent::Exit = event {
                app.state::<Worlds>().stop_autosave();
            }
        })
        .build()
}
