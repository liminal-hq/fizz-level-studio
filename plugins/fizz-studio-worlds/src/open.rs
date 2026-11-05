// The open levels: each one a session with its writer seat, its place on disk and its watcher
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::RecvTimeoutError;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use fizz_studio_level::LevelDocument;
use fizz_studio_protocol::{LevelError, LevelSnapshot};
use fizz_studio_session::{Author, Session, SessionError, WriterToken};
use fizz_studio_world::{
    reconcile, Change, ChangeKind, DiskState, FolderWatcher, Resolution, DEFAULT_DEBOUNCE,
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{LevelConflict, CHANGED_EVENT, CONFLICT_EVENT};

/// How often a watcher thread looks up from waiting for a change to see whether its level closed.
const STOP_POLL: Duration = Duration::from_millis(50);

/// The name the plugin gives when it claims a level's writer seat.
const WRITER_NAME: &str = "studio";

/// Every open level, by id. This is the one writer of each level's session.
#[derive(Default)]
pub struct Worlds {
    levels: Mutex<HashMap<String, OpenLevel>>,
    next: AtomicU64,
}

impl std::fmt::Debug for Worlds {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Worlds").finish_non_exhaustive()
    }
}

/// One open level.
pub(crate) struct OpenLevel {
    id: String,
    path: PathBuf,
    pub(crate) session: Session<LevelDocument>,
    pub(crate) writer: WriterToken,
    /// What the studio last wrote to the file or read from it; the base of an outside-edit merge.
    disk_text: String,
    /// What the watcher thread compares against, shared with the thread's [`FolderWatcher`], which
    /// lives on that thread and stops when `stop` is set.
    disk: DiskState,
    stop: Arc<AtomicBool>,
    pub(crate) last_author: Author,
}

impl Drop for OpenLevel {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

fn author_word(author: Author) -> &'static str {
    match author {
        Author::Person => "person",
        Author::Claude => "claude",
        Author::Outside => "outside",
    }
}

/// How a session refusal reads to the webview.
pub(crate) fn session_error(error: SessionError) -> LevelError {
    match error {
        SessionError::StaleRevision { requested, current } => LevelError::Stale {
            based_on: requested,
            current,
        },
        other => LevelError::Invalid {
            message: other.to_string(),
        },
    }
}

pub(crate) fn io_error(error: impl std::fmt::Display) -> LevelError {
    LevelError::Io {
        message: error.to_string(),
    }
}

/// What the watcher found out about a change.
enum Heard {
    Nothing,
    Changed(Box<LevelSnapshot>),
    Conflict(LevelConflict),
}

impl OpenLevel {
    pub(crate) fn snapshot(&self) -> LevelSnapshot {
        let session = &self.session;
        LevelSnapshot {
            id: self.id.clone(),
            path: self.path.to_string_lossy().into_owned(),
            revision: session.revision(),
            saved_revision: session.saved_revision(),
            text: session.text().to_string(),
            view: session.document().view(),
            can_undo: session.can_undo(),
            can_redo: session.can_redo(),
            undo_name: session.undo_step().map(|s| s.name),
            redo_name: session.redo_step().map(|s| s.name),
            author: author_word(self.last_author).to_string(),
            // The revision an outside edit made stays marked until another change replaces it.
            edited_outside: session.outside_revision() == Some(session.revision()),
        }
    }

    /// Writes the session's text to its file and records that as saved.
    pub(crate) fn save(&mut self) -> Result<(), LevelError> {
        let text = self.session.text().to_string();
        self.disk
            .write(&self.path, text.as_bytes())
            .map_err(io_error)?;
        self.disk_text = text;
        self.session.mark_saved();
        Ok(())
    }

    /// Decides what a change to the file means for the session.
    fn hear(&mut self, change: Change) -> Heard {
        if change.path != self.path {
            return Heard::Nothing;
        }
        let disk = match change.kind {
            ChangeKind::Changed { text } => text,
            ChangeKind::Removed => {
                log::warn!("a level's file was removed outside the studio");
                return Heard::Nothing;
            }
            ChangeKind::NotText => {
                log::warn!("a level's file was changed outside the studio to something not text");
                return Heard::Nothing;
            }
        };
        if disk == self.disk_text {
            return Heard::Nothing;
        }
        let resolution = reconcile(&self.disk_text, self.session.text(), &disk);
        let brought_in = match resolution {
            Resolution::Unchanged => {
                // The session already holds the file's text, so there is nothing left unsaved.
                self.disk_text = disk;
                self.session.mark_saved();
                return Heard::Changed(Box::new(self.snapshot()));
            }
            Resolution::Conflict { marked } => {
                return Heard::Conflict(LevelConflict {
                    id: self.id.clone(),
                    marked,
                });
            }
            Resolution::EditedOutside { text } => (text, true),
            Resolution::Merged { text } => (text, false),
        };
        let (text, clean) = brought_in;
        let revision = self.session.revision();
        if let Err(error) = self
            .session
            .apply_outside_edit(&self.writer, revision, &text)
        {
            log::warn!("an outside edit could not be brought in: {error}");
            return Heard::Nothing;
        }
        self.disk_text = disk;
        if clean {
            // The session now holds exactly what is on disk.
            self.session.mark_saved();
        }
        self.last_author = Author::Outside;
        Heard::Changed(Box::new(self.snapshot()))
    }
}

impl Worlds {
    pub(crate) fn lock(&self) -> MutexGuard<'_, HashMap<String, OpenLevel>> {
        self.levels.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Runs `f` on the level, or says it is not open.
    pub(crate) fn with<T>(
        &self,
        id: &str,
        f: impl FnOnce(&mut OpenLevel) -> Result<T, LevelError>,
    ) -> Result<T, LevelError> {
        let mut levels = self.lock();
        let level = levels
            .get_mut(id)
            .ok_or_else(|| LevelError::NotOpen { id: id.to_string() })?;
        f(level)
    }

    /// Opens the file as a level, or returns the one already open from it.
    pub(crate) fn open<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        path: &str,
    ) -> Result<LevelSnapshot, LevelError> {
        let path = std::fs::canonicalize(path).map_err(io_error)?;
        let mut levels = self.lock();
        if let Some(open) = levels.values().find(|l| l.path == path) {
            return Ok(open.snapshot());
        }
        let bytes = std::fs::read(&path).map_err(io_error)?;
        let text = String::from_utf8(bytes.clone())
            .map_err(|_| io_error("the file is not text (it is not valid UTF-8)"))?;
        let folder = path
            .parent()
            .ok_or_else(|| io_error("the file has no folder"))?;
        let disk = DiskState::new();
        disk.note_loaded(&path, &bytes);
        let watcher =
            FolderWatcher::start(folder, DEFAULT_DEBOUNCE, disk.clone()).map_err(io_error)?;

        let mut session = Session::new(LevelDocument::new(text.clone()));
        let writer = session.claim_writer(WRITER_NAME).map_err(session_error)?;
        let id = format!("level-{}", self.next.fetch_add(1, Ordering::Relaxed) + 1);
        let stop = Arc::new(AtomicBool::new(false));
        watch(app.clone(), id.clone(), watcher, stop.clone()).map_err(io_error)?;
        let level = OpenLevel {
            id: id.clone(),
            path,
            session,
            writer,
            disk_text: text,
            disk,
            stop,
            last_author: Author::Person,
        };
        let snapshot = level.snapshot();
        levels.insert(id, level);
        Ok(snapshot)
    }

    /// Forgets the level; its watcher stops. Unsaved changes are dropped, so asking comes first.
    pub(crate) fn close(&self, id: &str) -> Result<(), LevelError> {
        self.lock()
            .remove(id)
            .map(|_| ())
            .ok_or_else(|| LevelError::NotOpen { id: id.to_string() })
    }
}

/// Sends a snapshot to every window.
pub(crate) fn announce<R: Runtime>(app: &AppHandle<R>, snapshot: &LevelSnapshot) {
    if let Err(error) = app.emit(CHANGED_EVENT, snapshot) {
        log::warn!("could not announce a level change: {error}");
    }
}

/// Listens for changes to the level's folder on a thread that owns the watcher, until the level
/// closes.
fn watch<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    watcher: FolderWatcher,
    stop: Arc<AtomicBool>,
) -> std::io::Result<()> {
    std::thread::Builder::new()
        .name("fizz-studio-level-watch".to_string())
        .spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                match watcher.changes().recv_timeout(STOP_POLL) {
                    Ok(change) => heard(&app, &id, change),
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
        })
        .map(|_| ())
}

fn heard<R: Runtime>(app: &AppHandle<R>, id: &str, change: Change) {
    let outcome = {
        let worlds = app.state::<Worlds>();
        let mut levels = worlds.lock();
        match levels.get_mut(id) {
            Some(level) => level.hear(change),
            None => return,
        }
    };
    match outcome {
        Heard::Nothing => {}
        Heard::Changed(snapshot) => announce(app, &snapshot),
        Heard::Conflict(conflict) => {
            if let Err(error) = app.emit(CONFLICT_EVENT, conflict) {
                log::warn!("could not announce an outside-edit conflict: {error}");
            }
        }
    }
}
