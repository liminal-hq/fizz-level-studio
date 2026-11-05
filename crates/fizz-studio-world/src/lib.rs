// Files for the studio: projects, atomic writes, watching, merging, and recovery
//
// Pure Rust with no Tauri. Files are opaque text here: parsing them is the language crate's job.
// See `spec/DESKTOP.md` ("Files, watching and recovery") for what this crate is for.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod error;
mod merge;
mod project;
mod recovery;
mod watch;
mod write;

pub use error::WorldError;
pub use merge::{reconcile, Resolution};
pub use project::{Project, ProjectKind, WORLD_FILE};
pub use recovery::{Autosave, RecoveryCopy, RecoveryEntry, RecoveryFile, RecoveryStore};
pub use watch::{Change, ChangeKind, FolderWatcher, DEFAULT_DEBOUNCE};
pub use write::{content_hash, remove_stale_temp_files, write_atomic, DiskState};
