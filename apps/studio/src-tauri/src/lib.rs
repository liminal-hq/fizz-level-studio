// Composition root: builds the Tauri app and opens the first window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod logging;
pub mod windows;

use windows::WindowKind;

/// Starts the app. Every window is created in Rust (`windows.rs`); `tauri.conf.json` lists none.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // The webview's `console.*` calls are forwarded into this plugin's stream by
        // `src/services/logger.ts`.
        .plugin(logging::plugin())
        // The webview asks the OS plugin for its platform, so the window frame can adapt.
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            windows::open_or_focus(app.handle(), WindowKind::Main, 1)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Fizz Level Studio application")
        .run(|_app, _event| {});
}
