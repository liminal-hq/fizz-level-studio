// Registers the worlds plugin: open levels as sessions, one writer, snapshots to every window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod commands;
mod open;
#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime};

pub use open::Worlds;

/// Sent to every window after every change to an open level, with a `LevelSnapshot`. A window
/// ignores a snapshot at or below the revision it has already applied for that level.
pub const CHANGED_EVENT: &str = "level://changed";

/// Sent to every window when a file changed outside the studio in the same lines as unsaved changes.
/// The session is left as it was; the payload is a [`LevelConflict`].
pub const CONFLICT_EVENT: &str = "level://conflict";

/// What the person is shown to settle a conflicting outside edit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LevelConflict {
    /// The level whose file changed.
    pub id: String,
    /// The text with conflict markers where both sides changed the same lines.
    pub marked: String,
}

/// Registers the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
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
        ])
        .setup(|app, _api| {
            app.manage(Worlds::default());
            Ok(())
        })
        .build()
}
