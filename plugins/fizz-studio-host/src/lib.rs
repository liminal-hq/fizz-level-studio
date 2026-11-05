// Registers the game-host plugin: what the host can do, and a frame stream over a raw channel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod commands;
#[cfg(test)]
mod tests;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

/// Registers the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("fizz-studio-host")
        .invoke_handler(tauri::generate_handler![
            commands::host_status,
            commands::host_stream_synthetic,
        ])
        .build()
}
