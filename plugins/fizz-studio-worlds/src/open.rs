// The open levels: each one a session with its writer seat, its place on disk and its watcher
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::RecvTimeoutError;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant, UNIX_EPOCH};

use fizz_studio_level::{open_level_text, AnyLevelDocument};
use fizz_studio_protocol::{LevelError, LevelSnapshot, RecoveryEntry};
use fizz_studio_session::{Author, Session, SessionError, WriterToken};
use fizz_studio_world::{
    reconcile, Autosave, Change, ChangeKind, DiskState, FolderWatcher, RecoveryCopy, RecoveryFile,
    RecoveryStore, Resolution, DEFAULT_DEBOUNCE,
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::recovery::{recovery_id, start_autosave, AutosaveHandle, RecoveryConfig, COPY_FILE};
use crate::{LevelConflict, CHANGED_EVENT, CONFLICT_EVENT};

/// How often a watcher thread looks up from waiting for a change to see whether its level closed.
const STOP_POLL: Duration = Duration::from_millis(50);

/// The name the plugin gives when it claims a level's writer seat.
const WRITER_NAME: &str = "studio";

/// Every open level, by id. This is the one writer of each level's session.
pub struct Worlds {
    levels: Arc<Mutex<HashMap<String, OpenLevel>>>,
    next: AtomicU64,
    store: RecoveryStore,
    interval: Duration,
    /// Dropping this stops the autosave thread and waits for a tick in progress to finish.
    autosave_stop: Mutex<Option<AutosaveHandle>>,
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
    pub(crate) session: Session<AnyLevelDocument>,
    pub(crate) writer: WriterToken,
    /// What the studio last wrote to the file or read from it; the base of an outside-edit merge.
    disk_text: String,
    /// What the watcher thread compares against, shared with the thread's [`FolderWatcher`], which
    /// lives on that thread and stops when `stop` is set.
    disk: DiskState,
    stop: Arc<AtomicBool>,
    pub(crate) last_author: Author,
    /// The revision that holds text brought back from a recovery copy, until the next change.
    recovered_revision: Option<u64>,
    store: RecoveryStore,
    autosave: Autosave,
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
        SessionError::Locked { layers } => LevelError::Locked { layers },
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
            author: if self.recovered_revision == Some(session.revision()) {
                "recovered".to_string()
            } else {
                author_word(self.last_author).to_string()
            },
            // The revision an outside edit made stays marked until another change replaces it.
            edited_outside: session.outside_revision() == Some(session.revision()),
            target: session.document().target(),
            banner: session.document().banner(),
        }
    }

    /// The proposals Claude left pending in the level's sidecar, drawn over the level as it is now.
    /// A sidecar that is missing or unreadable has none.
    pub(crate) fn ghosts(&self) -> Vec<fizz_studio_protocol::GhostProposal> {
        let sidecar = fizz_studio_level::sidecar_path(&self.path.to_string_lossy());
        let Ok(json) = std::fs::read_to_string(sidecar) else {
            return Vec::new();
        };
        let view = self.session.document().view();
        fizz_studio_level::pending_ghosts(self.session.text(), view.width, view.height, &json)
    }

    /// Writes the session's text to its file and records that as saved.
    pub(crate) fn save(&mut self) -> Result<(), LevelError> {
        let text = self.session.text().to_string();
        self.disk
            .write(&self.path, text.as_bytes())
            .map_err(io_error)?;
        self.disk_text = text;
        self.session.mark_saved();
        self.settle();
        Ok(())
    }

    /// Drops the recovery copy once nothing is unsaved: after a save, or an undo back to the saved
    /// text.
    pub(crate) fn settle(&mut self) {
        if !self.has_unsaved_text() {
            self.drop_copy();
        }
    }

    /// Whether the session holds text the file does not. An undo back to the saved text has a new
    /// revision but nothing left to recover.
    fn has_unsaved_text(&self) -> bool {
        self.session.is_dirty() && self.session.text() != self.disk_text
    }

    pub(crate) fn drop_copy(&self) {
        if let Err(error) = self.store.discard(&recovery_id(&self.path)) {
            log::warn!("could not remove a recovery copy: {error}");
        }
    }

    /// Writes a recovery copy if something is unsaved and one is due.
    pub(crate) fn keep_copy(&mut self, now: Instant) {
        if !self.autosave.due(now, self.has_unsaved_text()) {
            return;
        }
        let copy = RecoveryCopy {
            note: self.path.to_string_lossy().into_owned(),
            files: vec![RecoveryFile {
                relative: COPY_FILE.into(),
                content: self.session.text().as_bytes().to_vec(),
            }],
        };
        match self.store.save(&recovery_id(&self.path), &copy) {
            Ok(()) => self.autosave.wrote(now),
            Err(error) => log::warn!("could not keep a recovery copy: {error}"),
        }
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
                self.settle();
                return Heard::Changed(Box::new(self.snapshot()));
            }
            Resolution::Conflict { marked } => {
                return Heard::Conflict(LevelConflict {
                    id: self.id.clone(),
                    marked,
                    locked: Vec::new(),
                });
            }
            Resolution::EditedOutside { text } => (text, true),
            Resolution::Merged { text } => (text, false),
        };
        let (text, clean) = brought_in;
        let revision = self.session.revision();
        match self
            .session
            .apply_outside_edit(&self.writer, revision, &text)
        {
            Ok(_) => {}
            // The studio keeps its text; the person is told which locked layers the change touched.
            Err(SessionError::Locked { layers }) => {
                return Heard::Conflict(LevelConflict {
                    id: self.id.clone(),
                    marked: text,
                    locked: layers,
                });
            }
            Err(error) => {
                log::warn!("an outside edit could not be brought in: {error}");
                return Heard::Nothing;
            }
        }
        self.disk_text = disk;
        if clean {
            // The session now holds exactly what is on disk.
            self.session.mark_saved();
            self.settle();
        }
        self.last_author = Author::Outside;
        Heard::Changed(Box::new(self.snapshot()))
    }
}

impl Worlds {
    /// No levels open, recovery copies kept in `dir` every `interval`, and the autosave timer started.
    pub(crate) fn new(dir: PathBuf, interval: Duration) -> Self {
        let levels = Arc::new(Mutex::new(HashMap::new()));
        let stop = start_autosave(levels.clone(), interval)
            .map_err(|error| log::warn!("autosave could not start: {error}"))
            .ok();
        Self {
            levels,
            next: AtomicU64::new(0),
            store: RecoveryStore::new(dir),
            interval,
            autosave_stop: Mutex::new(stop),
        }
    }

    /// Where the config says recovery copies go, with the system's data folder as the default.
    pub(crate) fn from_config<R: Runtime>(app: &AppHandle<R>, config: RecoveryConfig) -> Self {
        let dir = config
            .dir
            .unwrap_or_else(|| match app.path().app_data_dir() {
                Ok(dir) => dir.join("recovery"),
                Err(error) => {
                    log::warn!(
                        "no app data folder, keeping recovery copies in a temporary one: {error}"
                    );
                    std::env::temp_dir().join("fizz-studio-recovery")
                }
            });
        Self::new(dir, config.interval)
    }

    /// Stops the autosave timer, for the app's exit.
    pub(crate) fn stop_autosave(&self) {
        self.autosave_stop
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take();
    }

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
        self.insert(app, &mut levels, path, None)
    }

    /// Opens the level a recovery copy is of, holding the copy's text as unsaved changes. The copy
    /// stays until the level is saved or closed. If the file is gone the level is new at that path.
    pub(crate) fn restore<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        id: &str,
    ) -> Result<LevelSnapshot, LevelError> {
        let copy = self.store.load(id).map_err(io_error)?;
        let text = copy
            .files
            .iter()
            .find(|f| f.relative.as_os_str() == COPY_FILE)
            .map(|f| String::from_utf8(f.content.clone()))
            .ok_or_else(|| io_error("the recovery copy holds no level"))?
            .map_err(|_| io_error("the recovery copy is not text"))?;
        let path = resolve(Path::new(&copy.note)).map_err(io_error)?;
        let mut levels = self.lock();
        if levels.values().any(|l| l.path == path) {
            return Err(LevelError::Invalid {
                message: "that level is already open".to_string(),
            });
        }
        self.insert(app, &mut levels, path, Some(text))
    }

    fn insert<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        levels: &mut HashMap<String, OpenLevel>,
        path: PathBuf,
        recovered: Option<String>,
    ) -> Result<LevelSnapshot, LevelError> {
        let folder = path
            .parent()
            .ok_or_else(|| io_error("the file has no folder"))?;
        let disk = DiskState::new();
        // A recovered level whose file is gone starts from nothing on disk.
        let text = match std::fs::read(&path) {
            Ok(bytes) => {
                let text = String::from_utf8(bytes.clone())
                    .map_err(|_| io_error("the file is not text (it is not valid UTF-8)"))?;
                disk.note_loaded(&path, &bytes);
                text
            }
            Err(e) if recovered.is_some() && e.kind() == std::io::ErrorKind::NotFound => {
                String::new()
            }
            Err(e) => return Err(io_error(e)),
        };
        let watcher =
            FolderWatcher::start(folder, DEFAULT_DEBOUNCE, disk.clone()).map_err(io_error)?;

        let mut session = match &recovered {
            Some(kept) => Session::recovered(open_level_text(kept.clone())),
            None => Session::new(open_level_text(text.clone())),
        };
        let writer = session.claim_writer(WRITER_NAME).map_err(session_error)?;
        let id = format!("level-{}", self.next.fetch_add(1, Ordering::Relaxed) + 1);
        let stop = Arc::new(AtomicBool::new(false));
        watch(app.clone(), id.clone(), watcher, stop.clone()).map_err(io_error)?;
        let level = OpenLevel {
            id: id.clone(),
            path,
            recovered_revision: recovered.is_some().then(|| session.revision()),
            session,
            writer,
            disk_text: text,
            disk,
            stop,
            last_author: Author::Person,
            store: self.store.clone(),
            autosave: Autosave::new(self.interval),
        };
        let snapshot = level.snapshot();
        levels.insert(id, level);
        Ok(snapshot)
    }

    /// Forgets the level and its recovery copy; its watcher stops. Unsaved changes are dropped, so
    /// asking comes first.
    pub(crate) fn close(&self, id: &str) -> Result<(), LevelError> {
        let level = self
            .lock()
            .remove(id)
            .ok_or_else(|| LevelError::NotOpen { id: id.to_string() })?;
        level.drop_copy();
        Ok(())
    }

    /// The copies left by a session that did not close cleanly, for levels not open now.
    pub(crate) fn recovery_list(&self) -> Result<Vec<RecoveryEntry>, LevelError> {
        let open: Vec<String> = self.lock().values().map(|l| recovery_id(&l.path)).collect();
        let entries = self.store.list().map_err(io_error)?;
        Ok(entries
            .into_iter()
            .filter(|e| !open.contains(&e.id))
            .map(|e| {
                let path = PathBuf::from(&e.note);
                RecoveryEntry {
                    name: path
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_else(|| e.note.clone()),
                    path: e.note,
                    saved_at_ms: e
                        .modified
                        .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX)),
                    id: e.id,
                }
            })
            .collect())
    }

    /// Deletes a recovery copy.
    pub(crate) fn recovery_discard(&self, id: &str) -> Result<(), LevelError> {
        self.store.discard(id).map_err(io_error)
    }
}

/// The path a level is known by: canonical, even when the file itself is gone.
fn resolve(path: &Path) -> std::io::Result<PathBuf> {
    match std::fs::canonicalize(path) {
        Ok(path) => Ok(path),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let name = path
                .file_name()
                .ok_or_else(|| std::io::Error::other("the path names no file"))?;
            let folder = path.parent().unwrap_or(Path::new("."));
            Ok(std::fs::canonicalize(folder)?.join(name))
        }
        Err(e) => Err(e),
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
