// Composition root: builds the Tauri app and opens the first window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod launch;
pub mod logging;
pub mod quit;
pub mod quit_round;
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

/// The tear-off ghost: one shared window the plugin creates once the event loop runs, which loads
/// the app bundle and is routed by its label (`tear-ghost`, one of the window labels in
/// `windows.rs`). No window-state plugin is registered, so the ghost needs no denylist entry.
fn tear_off_options() -> tauri_plugin_window_tearoff::Options {
    tauri_plugin_window_tearoff::Options {
        ghost_label: WindowId::TearGhost.label(),
        ghost_url: "index.html".into(),
        ghost_size: (240.0, 160.0),
        toplevel_drag_mime: "application/x-fizz-studio-panel".into(),
    }
}

/// Starts the app. Every window is created in Rust (`windows.rs`); `tauri.conf.json` lists none.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        // First, so a second launch (a double-clicked level while the studio is open) stops here
        // and brings the running app forward instead of starting another, handing it the level
        // paths it was given.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            launch::handle_second_launch(app, args, &cwd);
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
        // The system's colour scheme and titlebar preferences, read and pushed to every window.
        .plugin(tauri_plugin_system_appearance::init())
        // The compositor's own window menu, which a webview cannot reach.
        .plugin(tauri_plugin_window_manager::init())
        // Transparency, blur and the shadow inset, reported per feature.
        .plugin(tauri_plugin_window_effects::init())
        // The ghost and the compositor-driven window drag a panel tears off with.
        .plugin(tauri_plugin_window_tearoff::init(tear_off_options()))
        .invoke_handler(tauri::generate_handler![
            windows::open_window,
            windows::open_panels,
            windows::close_panel,
            launch::app_launch_paths,
            quit::app_quit,
            quit::app_quit_answer
        ])
        // A panel window closing, by its own close button or by docking, is announced to every
        // window, so the main window can show the panel in its place again.
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                windows::announce_panel_closed(window.app_handle(), window.label());
                quit::window_gone(window.app_handle(), window.label());
            }
        })
        .setup(|app| {
            app.manage(quit::QuitState::default());
            launch::queue_startup_paths(app.handle());
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

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_builder, mock_context, noop_assets};

    #[test]
    fn the_ghost_is_the_tear_ghost_window_the_label_parser_knows() {
        let options = tear_off_options();
        assert_eq!(options.ghost_label, "tear-ghost");
        assert_eq!(
            WindowId::parse(&options.ghost_label),
            Some(WindowId::TearGhost)
        );
    }

    #[test]
    fn the_appearance_and_tear_off_plugins_register_together() {
        let app = mock_builder()
            .plugin(tauri_plugin_system_appearance::init())
            .plugin(tauri_plugin_window_manager::init())
            .plugin(tauri_plugin_window_effects::init())
            .plugin(tauri_plugin_window_tearoff::init(tear_off_options()))
            .build(mock_context(noop_assets()))
            .expect("the plugins register side by side");
        // The tear-off plugin makes its ghost once the event loop runs, which the mock never does.
        assert!(app.get_webview_window("tear-ghost").is_none());
    }
}
