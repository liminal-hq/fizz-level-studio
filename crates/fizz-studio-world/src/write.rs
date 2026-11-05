// Atomic canonical writes, and the record of what the studio last knew was on disk
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::hash::Hasher;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::error::WorldError;

/// The ending of the temporary files a write makes. The watcher ignores them.
pub(crate) const TEMP_SUFFIX: &str = ".fizz-tmp";

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// A hash of file contents, to tell the studio's own writes from outside ones. It is stable inside
/// one process, which is all it is used for; it is not stored.
pub fn content_hash(bytes: &[u8]) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    hasher.write(bytes);
    hasher.finish()
}

fn temp_path_for(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    path.with_file_name(format!(".{name}.{}.{n}{TEMP_SUFFIX}", std::process::id()))
}

/// Writes `bytes` to `path` so that a reader (or a crash) sees the old file or the new one, never half
/// of either: a temporary file in the same folder, flushed to disk, then renamed over the target.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), WorldError> {
    write_atomic_inner(path, bytes, false)
}

/// `interrupt_before_rename` stands in for a crash after the temporary file is written: it stops
/// there, leaving the temporary file behind, as a killed process would.
fn write_atomic_inner(
    path: &Path,
    bytes: &[u8],
    interrupt_before_rename: bool,
) -> Result<(), WorldError> {
    let temp = temp_path_for(path);
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        file.write_all(bytes)?;
        // Keep the target's permissions when it exists.
        if let Ok(meta) = fs::metadata(path) {
            let _ = file.set_permissions(meta.permissions());
        }
        file.sync_all()?;
        drop(file);
        if interrupt_before_rename {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "interrupted before the rename",
            ));
        }
        fs::rename(&temp, path)?;
        Ok(())
    })();
    match result {
        Ok(()) => {
            sync_folder(path.parent().unwrap_or(Path::new(".")));
            Ok(())
        }
        Err(error) => {
            if !interrupt_before_rename {
                let _ = fs::remove_file(&temp);
            }
            Err(WorldError::io(path, error))
        }
    }
}

/// Makes the rename itself durable. Not every platform can open a folder, so a failure is ignored.
fn sync_folder(folder: &Path) {
    #[cfg(unix)]
    if let Ok(dir) = File::open(folder) {
        let _ = dir.sync_all();
    }
    #[cfg(not(unix))]
    let _ = folder;
}

/// Removes temporary files an interrupted write left in `folder`; returns how many.
pub fn remove_stale_temp_files(folder: &Path) -> Result<usize, WorldError> {
    let mut removed = 0;
    for entry in fs::read_dir(folder).map_err(|e| WorldError::io(folder, e))? {
        let path = entry.map_err(|e| WorldError::io(folder, e))?.path();
        let is_temp = path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().ends_with(TEMP_SUFFIX));
        if is_temp && fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

/// What the studio last knew each file held: its own last write, or the last outside edit it was told
/// about. The watcher ignores a change whose content matches, which is how the studio does not hear
/// its own saves. Clones share the record.
#[derive(Debug, Clone, Default)]
pub struct DiskState {
    known: Arc<Mutex<HashMap<PathBuf, u64>>>,
}

impl DiskState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Writes a file atomically and records its content as known. It is recorded first, so the event
    /// the write causes finds it already there.
    pub fn write(&self, path: &Path, bytes: &[u8]) -> Result<(), WorldError> {
        let before = self.set(path, content_hash(bytes));
        let result = write_atomic(path, bytes);
        if result.is_err() {
            match before {
                Some(hash) => {
                    self.set(path, hash);
                }
                None => self.forget(path),
            };
        }
        result
    }

    /// Records the content of a file the studio has just read (opened or reloaded).
    pub fn note_loaded(&self, path: &Path, bytes: &[u8]) {
        self.set(path, content_hash(bytes));
    }

    pub(crate) fn set(&self, path: &Path, hash: u64) -> Option<u64> {
        self.known
            .lock()
            .expect("disk state lock")
            .insert(path.to_path_buf(), hash)
    }

    pub(crate) fn forget(&self, path: &Path) {
        self.known.lock().expect("disk state lock").remove(path);
    }

    pub(crate) fn get(&self, path: &Path) -> Option<u64> {
        self.known
            .lock()
            .expect("disk state lock")
            .get(path)
            .copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_a_new_file_and_replaces_an_old_one() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        write_atomic(&path, b"one").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"one");
        write_atomic(&path, b"two\n").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"two\n");
        let names: Vec<_> = fs::read_dir(dir.path()).unwrap().collect();
        assert_eq!(names.len(), 1, "no temporary file is left behind");
    }

    #[test]
    fn an_interrupted_write_leaves_the_old_file_whole() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        let old = "the old file, whole\n".repeat(1000);
        write_atomic(&path, old.as_bytes()).unwrap();

        let new = "the new file\n".repeat(5000);
        let error = write_atomic_inner(&path, new.as_bytes(), true).unwrap_err();
        assert!(matches!(error, WorldError::Io { .. }));
        assert_eq!(fs::read(&path).unwrap(), old.as_bytes());

        // The crash left only a temporary file, which a sweep removes.
        assert_eq!(remove_stale_temp_files(dir.path()).unwrap(), 1);
        assert_eq!(fs::read(&path).unwrap(), old.as_bytes());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn a_failed_write_leaves_no_temporary_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("missing-folder").join("a.fizz");
        assert!(write_atomic(&path, b"x").is_err());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn disk_state_records_its_own_writes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        let state = DiskState::new();
        state.write(&path, b"hello").unwrap();
        assert_eq!(state.get(&path), Some(content_hash(b"hello")));
        // A failed write does not change what is known.
        let bad = dir.path().join("nope").join("b.fizz");
        assert!(state.write(&bad, b"x").is_err());
        assert_eq!(state.get(&bad), None);
    }
}
