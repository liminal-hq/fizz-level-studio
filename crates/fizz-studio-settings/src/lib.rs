// The studio's settings: a versioned document, its files, and the single-writer store over them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Pure Rust with no Tauri: the plugin in `plugins/fizz-studio-settings` wraps `SettingsStore` and
// adds the commands and the change event.

mod dock;
mod document;
mod layout;
mod migrate;
mod rules;
mod storage;
mod store;

pub use dock::{
    default_dock, default_workspace, default_workspace_for, resolve_dock, BOTTOM_MIN,
    DEFAULT_ACTIVE, PANEL_IDS, SIDE_MIN, ZONE_MAX,
};
pub use document::{DocumentError, LoadReport, SettingsFile, SETTINGS_FILE, SETTINGS_VERSION};
pub use layout::{default_layout, resolve_layout, MAIN_KIND};
pub use migrate::{migrate, Migration, MIGRATIONS};
pub use rules::{apply_patch, clear_recent, touch_recent, validate};
pub use storage::{BlobStorage, DiskStorage, MemoryStorage, StorageError};
pub use store::{Observer, SettingsStore};
