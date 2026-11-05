// Composition root: builds the Tauri app and opens the first window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod windows;

use windows::WindowKind;

/// Starts the app. Every window is created in Rust (`windows.rs`); `tauri.conf.json` lists none.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            windows::open_or_focus(app.handle(), WindowKind::Main, 1)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Fizz Level Studio application")
        .run(|_app, _event| {});
}
