// Registers the settings plugin: one store for every window, a revision and a change event
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod commands;
#[cfg(test)]
mod tests;

use std::sync::Arc;

use fizz_studio_settings::{BlobStorage, SettingsFile, SettingsStore};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Sent to every window after every change, with a `SettingsSnapshot` whose revision is higher than
/// the one before. A window reads `settings_get` first and ignores events at or below the revision
/// it has already applied.
pub const EVENT: &str = "settings://changed";

/// The store the commands share: the one writer of the settings.
pub type Store = SettingsStore<Arc<dyn BlobStorage>>;

/// Registers the plugin over a storage that is ready.
pub fn init<R: Runtime>(storage: Arc<dyn BlobStorage>) -> TauriPlugin<R> {
    init_with(move |_| storage)
}

/// Registers the plugin with its storage made when the plugin is set up, which is when the app
/// exists, so the folder can come from the app's path resolver.
pub fn init_with<R: Runtime>(
    make: impl FnOnce(&AppHandle<R>) -> Arc<dyn BlobStorage> + Send + 'static,
) -> TauriPlugin<R> {
    // `setup` takes an `FnOnce`, so the factory waits here until it runs.
    let make = std::sync::Mutex::new(Some(make));
    Builder::new("fizz-studio-settings")
        .invoke_handler(tauri::generate_handler![
            commands::settings_get,
            commands::settings_update,
            commands::recent_touch,
            commands::recent_clear,
        ])
        .setup(move |app, _api| {
            let make = make
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .take()
                .ok_or("the settings plugin was set up twice")?;
            let (store, report) = SettingsStore::open(SettingsFile::new(make(app)));
            if let Some(problem) = &report.problem {
                match &report.set_aside {
                    Some(name) => log::warn!(
                        "the settings file was unusable ({problem}); kept as {name} and using the defaults"
                    ),
                    None => log::warn!("the settings file was unusable ({problem})"),
                }
            }
            let handle = app.clone();
            store.observe(move |snapshot| {
                if let Err(e) = handle.emit(EVENT, snapshot) {
                    log::warn!("could not announce the settings change: {e}");
                }
            });
            app.manage(store);
            Ok(())
        })
        .build()
}
