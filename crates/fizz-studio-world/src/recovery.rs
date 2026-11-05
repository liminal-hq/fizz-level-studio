// Autosave timing and recovery copies of unsaved files, kept apart from the real files
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime};

use crate::error::WorldError;
use crate::write::write_atomic;

const NOTE_FILE: &str = "note.txt";
const FILES_FOLDER: &str = "files";

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// When the next autosave is due. The timer itself belongs to the app; this only keeps the rule.
#[derive(Debug, Clone)]
pub struct Autosave {
    interval: Duration,
    last: Option<Instant>,
}

impl Autosave {
    pub fn new(interval: Duration) -> Self {
        Self {
            interval,
            last: None,
        }
    }

    /// Whether to write recovery copies now: something is unsaved and `interval` has passed since the
    /// last copy (or there has been none).
    pub fn due(&self, now: Instant, has_unsaved_changes: bool) -> bool {
        has_unsaved_changes
            && self
                .last
                .is_none_or(|last| now.saturating_duration_since(last) >= self.interval)
    }

    pub fn wrote(&mut self, now: Instant) {
        self.last = Some(now);
    }
}

/// One file in a recovery copy: its path relative to the project folder, and its bytes.
#[derive(Clone, PartialEq, Eq)]
pub struct RecoveryFile {
    pub relative: PathBuf,
    pub content: Vec<u8>,
}

impl std::fmt::Debug for RecoveryFile {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RecoveryFile")
            .field("relative", &self.relative)
            .field("len", &self.content.len())
            .finish()
    }
}

/// Everything saved for one document or project.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecoveryCopy {
    /// Free text for the start screen ("Crater Fields, 3 unsaved levels").
    pub note: String,
    pub files: Vec<RecoveryFile>,
}

/// What the start screen lists before offering Restore or Discard.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecoveryEntry {
    pub id: String,
    pub note: String,
    pub modified: Option<SystemTime>,
}

/// Recovery copies under a folder the caller chooses, one folder per id: `<dir>/<id>/`. A copy is
/// never written over a real file, and a new copy replaces the old one whole.
#[derive(Debug, Clone)]
pub struct RecoveryStore {
    dir: PathBuf,
}

impl RecoveryStore {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Self { dir: dir.into() }
    }

    fn folder(&self, id: &str) -> Result<PathBuf, WorldError> {
        let usable = !id.is_empty()
            && id.len() <= 128
            && !id.starts_with('.')
            && id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
        if usable {
            Ok(self.dir.join(id))
        } else {
            Err(WorldError::BadRecoveryId { id: id.to_string() })
        }
    }

    /// Writes a recovery copy, replacing any earlier one for `id`. The copy is built beside the old
    /// one and swapped in, so a crash while saving leaves a whole copy, new or old.
    pub fn save(&self, id: &str, copy: &RecoveryCopy) -> Result<(), WorldError> {
        let target = self.folder(id)?;
        fs::create_dir_all(&self.dir).map_err(|e| WorldError::io(&self.dir, e))?;
        let unique = format!(
            "{}.{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        );
        let building = self.dir.join(format!(".{id}.new.{unique}"));
        let old = self.dir.join(format!(".{id}.old.{unique}"));

        let built = (|| {
            let files = building.join(FILES_FOLDER);
            fs::create_dir_all(&files).map_err(|e| WorldError::io(&files, e))?;
            for file in &copy.files {
                check_relative(&file.relative)?;
                let path = files.join(&file.relative);
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent).map_err(|e| WorldError::io(parent, e))?;
                }
                write_atomic(&path, &file.content)?;
            }
            // The note goes last: a folder without one is not a finished copy.
            write_atomic(&building.join(NOTE_FILE), copy.note.as_bytes())
        })();
        if let Err(error) = built {
            let _ = fs::remove_dir_all(&building);
            return Err(error);
        }

        let had_old = target.exists();
        if had_old {
            fs::rename(&target, &old).map_err(|e| WorldError::io(&target, e))?;
        }
        if let Err(error) = fs::rename(&building, &target) {
            if had_old {
                let _ = fs::rename(&old, &target);
            }
            let _ = fs::remove_dir_all(&building);
            return Err(WorldError::io(&target, error));
        }
        if had_old {
            let _ = fs::remove_dir_all(&old);
        }
        Ok(())
    }

    /// The finished copies, by id. A missing recovery folder has none.
    pub fn list(&self) -> Result<Vec<RecoveryEntry>, WorldError> {
        let entries = match fs::read_dir(&self.dir) {
            Ok(entries) => entries,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(WorldError::io(&self.dir, e)),
        };
        let mut found = Vec::new();
        for entry in entries {
            let path = entry.map_err(|e| WorldError::io(&self.dir, e))?.path();
            let Some(id) = path.file_name().map(|n| n.to_string_lossy().into_owned()) else {
                continue;
            };
            if self.folder(&id).is_err() {
                continue;
            }
            let note_path = path.join(NOTE_FILE);
            let Ok(note) = fs::read_to_string(&note_path) else {
                continue;
            };
            let modified = fs::metadata(&note_path).and_then(|m| m.modified()).ok();
            found.push(RecoveryEntry { id, note, modified });
        }
        found.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(found)
    }

    /// Reads a copy back, byte for byte.
    pub fn load(&self, id: &str) -> Result<RecoveryCopy, WorldError> {
        let folder = self.folder(id)?;
        let note_path = folder.join(NOTE_FILE);
        let note = fs::read_to_string(&note_path).map_err(|e| WorldError::io(&note_path, e))?;
        let root = folder.join(FILES_FOLDER);
        let mut files = Vec::new();
        collect(&root, &root, &mut files)?;
        files.sort_by(|a, b| a.relative.cmp(&b.relative));
        Ok(RecoveryCopy { note, files })
    }

    /// Deletes a copy: after a save, or when the person chooses Discard. A missing copy is fine.
    pub fn discard(&self, id: &str) -> Result<(), WorldError> {
        let folder = self.folder(id)?;
        match fs::remove_dir_all(&folder) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(WorldError::io(&folder, e)),
        }
    }
}

fn check_relative(path: &Path) -> Result<(), WorldError> {
    let ok = !path.as_os_str().is_empty()
        && path.components().all(|c| matches!(c, Component::Normal(_)));
    if ok {
        Ok(())
    } else {
        Err(WorldError::BadRelativePath {
            path: path.to_path_buf(),
        })
    }
}

fn collect(root: &Path, dir: &Path, out: &mut Vec<RecoveryFile>) -> Result<(), WorldError> {
    for entry in fs::read_dir(dir).map_err(|e| WorldError::io(dir, e))? {
        let path = entry.map_err(|e| WorldError::io(dir, e))?.path();
        if path.is_dir() {
            collect(root, &path, out)?;
        } else {
            let content = fs::read(&path).map_err(|e| WorldError::io(&path, e))?;
            let relative = path.strip_prefix(root).unwrap_or(&path).to_path_buf();
            out.push(RecoveryFile { relative, content });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(relative: &str, content: &[u8]) -> RecoveryFile {
        RecoveryFile {
            relative: relative.into(),
            content: content.to_vec(),
        }
    }

    #[test]
    fn a_recovery_copy_restores_byte_for_byte() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path().join("recovery"));
        let copy = RecoveryCopy {
            note: "Crater Fields, 2 unsaved levels".to_string(),
            files: vec![
                file(
                    "levels/crater.fizz",
                    "script fizz 0\r\nno trailing newline".as_bytes(),
                ),
                file("world.fizz", "world \u{1F680}\n\n\n".as_bytes()),
                file("levels/binary.bin", &[0, 255, 10, 13, 0, 200]),
            ],
        };
        store.save("crater-1", &copy).unwrap();

        let mut expected = copy.clone();
        expected.files.sort_by(|a, b| a.relative.cmp(&b.relative));
        assert_eq!(store.load("crater-1").unwrap(), expected);
    }

    #[test]
    fn a_new_copy_replaces_the_old_one_whole() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path());
        let first = RecoveryCopy {
            note: "first".to_string(),
            files: vec![file("a.fizz", b"a"), file("b.fizz", b"b")],
        };
        store.save("x", &first).unwrap();
        let second = RecoveryCopy {
            note: "second".to_string(),
            files: vec![file("a.fizz", b"a2")],
        };
        store.save("x", &second).unwrap();
        assert_eq!(store.load("x").unwrap(), second);
        // No scratch folders are left beside it.
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn list_and_discard() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path().join("not-yet"));
        assert!(store.list().unwrap().is_empty());
        let copy = RecoveryCopy {
            note: "n".to_string(),
            files: vec![file("a.fizz", b"a")],
        };
        store.save("b", &copy).unwrap();
        store.save("a", &copy).unwrap();
        let ids: Vec<_> = store.list().unwrap().into_iter().map(|e| e.id).collect();
        assert_eq!(ids, ["a", "b"]);
        store.discard("a").unwrap();
        store.discard("a").unwrap();
        assert_eq!(store.list().unwrap().len(), 1);
    }

    #[test]
    fn an_unfinished_copy_is_not_listed() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path());
        fs::create_dir_all(dir.path().join("half/files")).unwrap();
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn unsafe_ids_and_paths_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path());
        let copy = RecoveryCopy {
            note: String::new(),
            files: vec![],
        };
        for id in ["", ".", "..", "../x", "a/b", ".hidden"] {
            assert!(
                matches!(store.save(id, &copy), Err(WorldError::BadRecoveryId { .. })),
                "{id:?}"
            );
        }
        for relative in ["../escape.fizz", "/abs.fizz", ""] {
            let bad = RecoveryCopy {
                note: String::new(),
                files: vec![file(relative, b"x")],
            };
            assert!(
                matches!(
                    store.save("ok", &bad),
                    Err(WorldError::BadRelativePath { .. })
                ),
                "{relative:?}"
            );
        }
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn autosave_is_due_only_when_dirty_and_after_the_interval() {
        let start = Instant::now();
        let mut autosave = Autosave::new(Duration::from_secs(30));
        assert!(!autosave.due(start, false));
        assert!(autosave.due(start, true));
        autosave.wrote(start);
        assert!(!autosave.due(start + Duration::from_secs(10), true));
        assert!(autosave.due(start + Duration::from_secs(30), true));
        assert!(!autosave.due(start + Duration::from_secs(60), false));
    }
}
