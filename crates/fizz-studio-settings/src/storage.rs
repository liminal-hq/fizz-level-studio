// Where the settings files live: named text blobs behind a trait, on disk or in memory
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::BTreeMap;
use std::fmt;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

/// A storage operation failed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageError(pub String);

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for StorageError {}

/// A small folder of text files by name. The settings code keeps `settings.json`, its previous
/// generation and any file it sets aside here, and nowhere else.
pub trait BlobStorage: Send + Sync {
    /// The text of `name`, or `None` when there is no such file. Text that is not UTF-8 is an error.
    fn read(&self, name: &str) -> Result<Option<String>, StorageError>;
    /// Replaces `name` so that a reader or a crash sees the old text or the new, never half.
    fn write(&self, name: &str, text: &str) -> Result<(), StorageError>;
    /// Moves `from` to `to`, which must not exist.
    fn rename(&self, from: &str, to: &str) -> Result<(), StorageError>;
}

impl<T: BlobStorage + ?Sized> BlobStorage for std::sync::Arc<T> {
    fn read(&self, name: &str) -> Result<Option<String>, StorageError> {
        (**self).read(name)
    }

    fn write(&self, name: &str, text: &str) -> Result<(), StorageError> {
        (**self).write(name, text)
    }

    fn rename(&self, from: &str, to: &str) -> Result<(), StorageError> {
        (**self).rename(from, to)
    }
}

/// Files in one folder on disk, written atomically.
pub struct DiskStorage {
    dir: PathBuf,
}

impl DiskStorage {
    /// The folder is made on the first write.
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Self { dir: dir.into() }
    }

    pub fn dir(&self) -> &std::path::Path {
        &self.dir
    }
}

impl BlobStorage for DiskStorage {
    fn read(&self, name: &str) -> Result<Option<String>, StorageError> {
        match fs::read(self.dir.join(name)) {
            Ok(bytes) => String::from_utf8(bytes)
                .map(Some)
                .map_err(|e| StorageError(format!("{name} is not valid UTF-8: {e}"))),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(StorageError(format!("could not read {name}: {e}"))),
        }
    }

    fn write(&self, name: &str, text: &str) -> Result<(), StorageError> {
        fs::create_dir_all(&self.dir)
            .map_err(|e| StorageError(format!("could not make {}: {e}", self.dir.display())))?;
        fizz_studio_world::write_atomic(&self.dir.join(name), text.as_bytes())
            .map_err(|e| StorageError(format!("could not write {name}: {e}")))
    }

    fn rename(&self, from: &str, to: &str) -> Result<(), StorageError> {
        let target = self.dir.join(to);
        if target.exists() {
            return Err(StorageError(format!("{to} already exists")));
        }
        fs::rename(self.dir.join(from), target)
            .map_err(|e| StorageError(format!("could not move {from} to {to}: {e}")))
    }
}

/// Files kept in memory, for tests. It can be told to fail its writes.
#[derive(Default)]
pub struct MemoryStorage {
    files: Mutex<BTreeMap<String, String>>,
    fail_writes: Mutex<bool>,
}

impl MemoryStorage {
    /// A storage that already holds `name`.
    pub fn with(name: &str, text: &str) -> Self {
        let storage = Self::default();
        storage.put(name, text);
        storage
    }

    /// Puts a file in place as if it had been there before the run.
    pub fn put(&self, name: &str, text: &str) {
        self.files
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(name.to_owned(), text.to_owned());
    }

    pub fn get(&self, name: &str) -> Option<String> {
        self.files
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(name)
            .cloned()
    }

    pub fn names(&self) -> Vec<String> {
        self.files
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .keys()
            .cloned()
            .collect()
    }

    /// Makes every later write fail (or work again), as a full disk would.
    pub fn set_failing(&self, failing: bool) {
        *self.fail_writes.lock().unwrap_or_else(|e| e.into_inner()) = failing;
    }

    fn failing(&self) -> bool {
        *self.fail_writes.lock().unwrap_or_else(|e| e.into_inner())
    }
}

impl BlobStorage for MemoryStorage {
    fn read(&self, name: &str) -> Result<Option<String>, StorageError> {
        Ok(self.get(name))
    }

    fn write(&self, name: &str, text: &str) -> Result<(), StorageError> {
        if self.failing() {
            return Err(StorageError("the disk is full".to_owned()));
        }
        self.put(name, text);
        Ok(())
    }

    fn rename(&self, from: &str, to: &str) -> Result<(), StorageError> {
        if self.failing() {
            return Err(StorageError("the disk is full".to_owned()));
        }
        let mut files = self.files.lock().unwrap_or_else(|e| e.into_inner());
        if files.contains_key(to) {
            return Err(StorageError(format!("{to} already exists")));
        }
        let text = files
            .remove(from)
            .ok_or_else(|| StorageError(format!("{from} does not exist")))?;
        files.insert(to.to_owned(), text);
        Ok(())
    }
}
