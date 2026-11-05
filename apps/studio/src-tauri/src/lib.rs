// Composition root: builds the Tauri app and opens the first window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod logging;
pub mod windows;

use windows::WindowId;

/// Starts the app. Every window is created in Rust (`windows.rs`); `tauri.conf.json` lists none.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![windows::open_window])
        .setup(|app| {
            windows::open_or_focus(app.handle(), &WindowId::Main { n: 1 })?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Fizz Level Studio application")
        .run(|_app, _event| {});
}
