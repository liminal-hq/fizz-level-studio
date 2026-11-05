// Watching a project folder for edits made outside the studio
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use crate::error::WorldError;
use crate::write::{content_hash, DiskState, TEMP_SUFFIX};

/// How long the folder must be quiet before a burst of events is looked at. Editors save by writing a
/// temporary file and renaming it, which is several events for one save.
pub const DEFAULT_DEBOUNCE: Duration = Duration::from_millis(100);

/// A burst that never goes quiet is looked at anyway after this many debounce periods.
const MAX_WAIT_PERIODS: u32 = 10;

#[derive(Clone, PartialEq, Eq)]
pub enum ChangeKind {
    /// The file now holds this text.
    Changed { text: String },
    /// A file the studio knew about is gone.
    Removed,
    /// The file changed but is not valid UTF-8.
    NotText,
}

// A change holds the file's text, so it only ever shows its size.
impl std::fmt::Debug for ChangeKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChangeKind::Changed { text } => f
                .debug_struct("Changed")
                .field("text_len", &text.len())
                .finish(),
            ChangeKind::Removed => f.write_str("Removed"),
            ChangeKind::NotText => f.write_str("NotText"),
        }
    }
}

/// A file that changed outside the studio.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Change {
    pub path: PathBuf,
    pub kind: ChangeKind,
}

/// Watches a folder, the whole tree under it, and reports files whose content changed.
///
/// It watches the folder and not the files, because editors save by rename and a watch on the old
/// file would be lost. Events for the studio's own temporary files are dropped, and so is any change
/// whose content matches what [`DiskState`] says the studio last wrote or read. Dropping the watcher
/// stops it.
pub struct FolderWatcher {
    _watcher: RecommendedWatcher,
    changes: Receiver<Change>,
}

impl std::fmt::Debug for FolderWatcher {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FolderWatcher").finish_non_exhaustive()
    }
}

impl FolderWatcher {
    pub fn start(root: &Path, debounce: Duration, state: DiskState) -> Result<Self, WorldError> {
        let (raw_tx, raw_rx) = channel::<PathBuf>();
        let (out_tx, out_rx) = channel::<Change>();
        let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            if let Ok(event) = result {
                if matches!(event.kind, EventKind::Access(_) | EventKind::Other) {
                    return;
                }
                for path in event.paths {
                    let _ = raw_tx.send(path);
                }
            }
        })?;
        watcher.watch(root, RecursiveMode::Recursive)?;

        std::thread::Builder::new()
            .name("fizz-studio-watch".to_string())
            .spawn(move || run(raw_rx, out_tx, debounce, state))
            .map_err(|e| WorldError::io(root, e))?;

        Ok(Self {
            _watcher: watcher,
            changes: out_rx,
        })
    }

    /// The changes, in the order they were noticed.
    pub fn changes(&self) -> &Receiver<Change> {
        &self.changes
    }
}

fn is_watched(path: &Path) -> bool {
    let Some(name) = path.file_name().map(|n| n.to_string_lossy()) else {
        return false;
    };
    !(name.starts_with('.') || name.ends_with(TEMP_SUFFIX) || name.ends_with('~'))
}

fn run(
    raw: Receiver<PathBuf>,
    out: std::sync::mpsc::Sender<Change>,
    debounce: Duration,
    state: DiskState,
) {
    let mut pending: HashSet<PathBuf> = HashSet::new();
    let mut first = Instant::now();
    let mut last = Instant::now();
    loop {
        let received = if pending.is_empty() {
            raw.recv().map_err(|_| RecvTimeoutError::Disconnected)
        } else {
            let quiet_for = last.elapsed();
            let waited = first.elapsed();
            if quiet_for >= debounce || waited >= debounce * MAX_WAIT_PERIODS {
                Err(RecvTimeoutError::Timeout)
            } else {
                raw.recv_timeout(debounce - quiet_for)
            }
        };
        match received {
            Ok(path) => {
                if is_watched(&path) {
                    if pending.is_empty() {
                        first = Instant::now();
                    }
                    pending.insert(path);
                    last = Instant::now();
                }
            }
            Err(RecvTimeoutError::Timeout) => {
                let mut paths: Vec<_> = pending.drain().collect();
                paths.sort();
                for path in paths {
                    if let Some(change) = classify(&path, &state) {
                        if out.send(change).is_err() {
                            return;
                        }
                    }
                }
            }
            Err(RecvTimeoutError::Disconnected) => return,
        }
    }
}

/// Looks at a path after a burst of events and says whether something the studio did not do happened.
fn classify(path: &Path, state: &DiskState) -> Option<Change> {
    match std::fs::read(path) {
        Ok(bytes) => {
            let hash = content_hash(&bytes);
            if state.get(path) == Some(hash) {
                return None;
            }
            state.set(path, hash);
            let kind = match String::from_utf8(bytes) {
                Ok(text) => ChangeKind::Changed { text },
                Err(_) => ChangeKind::NotText,
            };
            Some(Change {
                path: path.to_path_buf(),
                kind,
            })
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            // Only a file the studio knew about is news when it goes.
            state.get(path)?;
            state.forget(path);
            Some(Change {
                path: path.to_path_buf(),
                kind: ChangeKind::Removed,
            })
        }
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DEBOUNCE: Duration = Duration::from_millis(50);
    const WITHIN_A_SECOND: Duration = Duration::from_millis(1000);

    fn start(dir: &Path) -> (FolderWatcher, DiskState) {
        let state = DiskState::new();
        let watcher = FolderWatcher::start(dir, DEBOUNCE, state.clone()).unwrap();
        (watcher, state)
    }

    #[test]
    fn an_outside_edit_becomes_a_notification_within_a_second() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        std::fs::write(&path, "before\n").unwrap();
        let (watcher, state) = start(dir.path());
        state.note_loaded(&path, b"before\n");

        let started = Instant::now();
        std::fs::write(&path, "after\n").unwrap();
        let change = watcher.changes().recv_timeout(WITHIN_A_SECOND).unwrap();
        assert!(started.elapsed() < WITHIN_A_SECOND);
        assert_eq!(change.path, path);
        assert_eq!(
            change.kind,
            ChangeKind::Changed {
                text: "after\n".to_string()
            }
        );
    }

    #[test]
    fn an_editor_saving_by_rename_is_heard_once() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        std::fs::write(&path, "before\n").unwrap();
        let (watcher, state) = start(dir.path());
        state.note_loaded(&path, b"before\n");

        let temp = dir.path().join(".a.fizz.swp");
        std::fs::write(&temp, "edited by an editor\n").unwrap();
        std::fs::rename(&temp, &path).unwrap();
        let change = watcher.changes().recv_timeout(WITHIN_A_SECOND).unwrap();
        assert_eq!(change.path, path);
        assert_eq!(
            change.kind,
            ChangeKind::Changed {
                text: "edited by an editor\n".to_string()
            }
        );
        assert!(watcher
            .changes()
            .recv_timeout(Duration::from_millis(300))
            .is_err());
    }

    #[test]
    fn the_studios_own_write_is_ignored_but_a_later_outside_edit_is_not() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        let (watcher, state) = start(dir.path());

        state.write(&path, b"saved by the studio\n").unwrap();
        assert!(watcher
            .changes()
            .recv_timeout(Duration::from_millis(400))
            .is_err());

        std::fs::write(&path, "changed outside\n").unwrap();
        let change = watcher.changes().recv_timeout(WITHIN_A_SECOND).unwrap();
        assert_eq!(
            change.kind,
            ChangeKind::Changed {
                text: "changed outside\n".to_string()
            }
        );

        // Writing the studio's old content back outside is news again.
        std::fs::write(&path, "saved by the studio\n").unwrap();
        assert!(watcher.changes().recv_timeout(WITHIN_A_SECOND).is_ok());
    }

    #[test]
    fn a_burst_of_writes_is_one_notification_with_the_last_text() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        let (watcher, _state) = start(dir.path());
        for i in 0..5 {
            std::fs::write(&path, format!("version {i}\n")).unwrap();
        }
        let change = watcher.changes().recv_timeout(WITHIN_A_SECOND).unwrap();
        assert_eq!(
            change.kind,
            ChangeKind::Changed {
                text: "version 4\n".to_string()
            }
        );
        assert!(watcher
            .changes()
            .recv_timeout(Duration::from_millis(300))
            .is_err());
    }

    #[test]
    fn a_removed_file_the_studio_knew_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fizz");
        std::fs::write(&path, "x\n").unwrap();
        let (watcher, state) = start(dir.path());
        state.note_loaded(&path, b"x\n");
        std::fs::remove_file(&path).unwrap();
        let change = watcher.changes().recv_timeout(WITHIN_A_SECOND).unwrap();
        assert_eq!(change.kind, ChangeKind::Removed);
    }

    #[test]
    fn the_studios_temporary_files_are_not_news() {
        let dir = tempfile::tempdir().unwrap();
        let (watcher, _state) = start(dir.path());
        std::fs::write(dir.path().join(".a.fizz.1.0.fizz-tmp"), "partial").unwrap();
        assert!(watcher
            .changes()
            .recv_timeout(Duration::from_millis(300))
            .is_err());
    }
}
