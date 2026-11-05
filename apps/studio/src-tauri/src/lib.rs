// Composition root: builds the Tauri app and opens the first window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod logging;
pub mod windows;

use std::sync::Arc;

use fizz_studio_settings::{BlobStorage, DiskStorage, MemoryStorage};
use tauri::Manager;
use windows::WindowId;

/// Where the settings files live: the app's config directory. If the system will not name one, the
/// settings are kept for this run only, and the log says so.
fn settings_storage<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Arc<dyn BlobStorage> {
    match app.path().app_config_dir() {
        Ok(dir) => Arc::new(DiskStorage::new(dir)),
        Err(e) => {
            log::warn!("no config directory for the settings, keeping them in memory: {e}");
            Arc::new(MemoryStorage::default())
        }
    }
}

/// Starts the app. Every window is created in Rust (`windows.rs`); `tauri.conf.json` lists none.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        // First, so a second launch (a double-clicked level while the studio is open) stops here
        // and brings the running app forward instead of starting another. The paths it was given
        // reach the worlds plugin when that arrives.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = windows::open_or_focus(app, &WindowId::Main { n: 1 });
        }))
        // The webview's `console.*` calls are forwarded into this plugin's stream by
        // `src/services/logger.ts`.
        .plugin(logging::plugin())
        // The webview asks the OS plugin for its platform, so the window frame can adapt.
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        // A release build drops the native WebView context menu, devtools, and the reload
        // shortcuts, so only the studio's own menus appear; a debug build keeps them. `Shift`+`Tab`
        // stays free, since blocking it would break reverse keyboard focus navigation.
        .plugin(
            tauri_plugin_prevent_default::Builder::new()
                .with_flags(
                    tauri_plugin_prevent_default::Flags::debug()
                        .difference(tauri_plugin_prevent_default::Flags::FOCUS_MOVE),
                )
                .build(),
        )
        // What the game host can draw and run, and its frame stream.
        .plugin(tauri_plugin_fizz_studio_host::init())
        // The open levels: a session each in Rust, edits in and snapshots out to every window.
        .plugin(tauri_plugin_fizz_studio_worlds::init())
        // The settings: one store in Rust for every window, saved in the app's config directory.
        .plugin(tauri_plugin_fizz_studio_settings::init_with(
            settings_storage,
        ))
        .invoke_handler(tauri::generate_handler![windows::open_window])
        .setup(|app| {
            windows::open_or_focus(app.handle(), &WindowId::Main { n: 1 })?;
            Ok(())
        });

    // Lets an agent drive and screenshot the running app during development and in the running-app
    // checks. Not on Windows, where the bridge does not yet compile against Tauri's `windows`
    // crate (see `Cargo.toml`), and never in a release build.
    #[cfg(all(debug_assertions, not(windows)))]
    {
        // Localhost only: the default binds every network interface, and nothing remote needs it.
        builder = builder.plugin(tauri_plugin_mcp_bridge::init_with_config(
            tauri_plugin_mcp_bridge::Config::localhost_only(),
        ));
    }

    builder
        .build(tauri::generate_context!())
        .expect("error while building the Fizz Level Studio application")
        .run(|_app, _event| {});
}
