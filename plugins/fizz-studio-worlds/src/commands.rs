// The plugin's commands: open a folder or a level, send edits, step through history, save, close
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_level::{new_level_text, new_world_text, step_name};
use fizz_studio_protocol::{
    GhostProposal, LevelEdit, LevelError, LevelSnapshot, LevelTarget, NewLevelRequest, ProjectInfo,
    ProjectKind, RecoveryEntry, WordDoc,
};
use fizz_studio_session::{Author, Request};
use fizz_studio_world::{write_atomic, Project, ProjectKind as FoundKind, WORLD_FILE};
use tauri::{AppHandle, Runtime, State};

use crate::open::{announce, announce_layers, io_error, session_error, Worlds};
use crate::LevelLayers;

fn text(path: &std::path::Path) -> String {
    path.to_string_lossy().into_owned()
}

/// Opens a folder and lists its level files; a folder with a `world.fizz` is a Fizz 2 world.
#[tauri::command]
pub fn project_open(path: String) -> Result<ProjectInfo, LevelError> {
    let project = Project::open(&path).map_err(io_error)?;
    Ok(ProjectInfo {
        root: text(&project.root),
        kind: match project.kind {
            FoundKind::Fizz1 => ProjectKind::Fizz1,
            FoundKind::Fizz2 => ProjectKind::Fizz2,
        },
        world_file: project.world_file.as_deref().map(text),
        levels: project.levels.iter().map(|p| text(p)).collect(),
    })
}

/// Reads a level file into a session, takes its writer seat and starts watching its folder. A level
/// that is already open answers with its current snapshot.
#[tauri::command]
pub fn level_open<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    path: String,
) -> Result<LevelSnapshot, LevelError> {
    worlds.open(&app, &path)
}

/// Appends an edit to the level, provided `based_on` is the revision the caller drew. A stale
/// revision rejects with `{ kind: "stale", based_on, current }` and changes nothing. Edits with the
/// same `merge_key` that follow each other undo as one step until `level_end_step`.
#[tauri::command]
pub fn level_apply<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    id: String,
    edit: LevelEdit,
    based_on: u64,
    merge_key: Option<String>,
) -> Result<LevelSnapshot, LevelError> {
    let snapshot = worlds.with(&id, |level| {
        let mut request = Request::new(based_on, step_name(&edit), edit);
        if let Some(key) = merge_key {
            request = request.merging(key);
        }
        level
            .session
            .apply(&level.writer, request)
            .map_err(session_error)?;
        level.last_author = Author::Person;
        Ok(level.snapshot())
    })?;
    announce(&app, &snapshot);
    Ok(snapshot)
}

/// Ends the stroke in progress, so the next edit starts a new step.
#[tauri::command]
pub fn level_end_step(worlds: State<'_, Worlds>, id: String) -> Result<(), LevelError> {
    worlds.with(&id, |level| {
        level.session.end_step(&level.writer).map_err(session_error)
    })
}

/// Undoes the last step.
#[tauri::command]
pub fn level_undo<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    id: String,
    based_on: u64,
) -> Result<LevelSnapshot, LevelError> {
    let snapshot = worlds.with(&id, |level| {
        level
            .session
            .undo(&level.writer, based_on)
            .map_err(session_error)?;
        level.last_author = Author::Person;
        level.settle();
        Ok(level.snapshot())
    })?;
    announce(&app, &snapshot);
    Ok(snapshot)
}

/// Redoes the last undone step.
#[tauri::command]
pub fn level_redo<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    id: String,
    based_on: u64,
) -> Result<LevelSnapshot, LevelError> {
    let snapshot = worlds.with(&id, |level| {
        level
            .session
            .redo(&level.writer, based_on)
            .map_err(session_error)?;
        level.last_author = Author::Person;
        level.settle();
        Ok(level.snapshot())
    })?;
    announce(&app, &snapshot);
    Ok(snapshot)
}

/// Writes the level to its file atomically. The studio does not hear its own write back.
#[tauri::command]
pub fn level_save<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    id: String,
) -> Result<LevelSnapshot, LevelError> {
    let snapshot = worlds.with(&id, |level| {
        level.save()?;
        Ok(level.snapshot())
    })?;
    announce(&app, &snapshot);
    Ok(snapshot)
}

/// Closes the level and stops watching its folder. Unsaved changes are dropped; the webview asks first.
#[tauri::command]
pub fn level_close(worlds: State<'_, Worlds>, id: String) -> Result<(), LevelError> {
    worlds.close(&id)
}

/// The recovery copies a session that did not close cleanly left behind, leaving out levels that
/// are open now.
#[tauri::command]
pub fn recovery_list(worlds: State<'_, Worlds>) -> Result<Vec<RecoveryEntry>, LevelError> {
    worlds.recovery_list()
}

/// Opens the copy's level with the recovered text as unsaved changes. The copy is kept until the
/// level is saved or closed.
#[tauri::command]
pub fn recovery_restore<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    id: String,
) -> Result<LevelSnapshot, LevelError> {
    worlds.restore(&app, &id)
}

/// Deletes a recovery copy.
#[tauri::command]
pub fn recovery_discard(worlds: State<'_, Worlds>, id: String) -> Result<(), LevelError> {
    worlds.recovery_discard(&id)
}

/// Makes a new level and opens it as `level_open` would. A Fizz 1 level is the file
/// `<folder>/<id>.fizz`; a Fizz 2 level is a world project `<folder>/<id>/` with a `world.fizz` and
/// `levels/<id>.fizz`. The target is written into the text here and nothing later changes it
/// (R-WLD-02). An existing file or folder is never overwritten: the command refuses and writes
/// nothing.
#[tauri::command]
pub fn level_create<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    request: NewLevelRequest,
) -> Result<LevelSnapshot, LevelError> {
    let invalid = |message: String| LevelError::Invalid { message };
    let level_text = new_level_text(&request).map_err(invalid)?;
    let folder = std::path::PathBuf::from(&request.folder);
    if !folder.is_dir() {
        return Err(invalid(format!("{} is not a folder", request.folder)));
    }
    let path = match request.target {
        LevelTarget::Fizz1 => {
            let path = folder.join(format!("{}.fizz", request.id));
            if path.exists() {
                return Err(invalid(format!("{} already exists", path.display())));
            }
            write_atomic(&path, level_text.as_bytes()).map_err(io_error)?;
            path
        }
        LevelTarget::Fizz2 => {
            let root = folder.join(&request.id);
            if root.exists() {
                return Err(invalid(format!("{} already exists", root.display())));
            }
            let path = root.join("levels").join(format!("{}.fizz", request.id));
            let made = std::fs::create_dir_all(root.join("levels"))
                .map_err(io_error)
                .and_then(|()| {
                    write_atomic(&path, level_text.as_bytes()).map_err(io_error)?;
                    write_atomic(&root.join(WORLD_FILE), new_world_text(&request).as_bytes())
                        .map_err(io_error)
                });
            if let Err(error) = made {
                // Leave nothing behind: the folder did not exist before this call.
                let _ = std::fs::remove_dir_all(&root);
                return Err(error);
            }
            path
        }
    };
    worlds.open(&app, &text(&path))
}

/// The words a level script can use, documented, for the Palette and for completion. They come from
/// the language crate, so the webview keeps no copy.
#[tauri::command]
pub fn language_words() -> Vec<WordDoc> {
    fizz_studio_level::word_docs()
}

/// The script line (counted from 1) of the last statement that changed the cell `x`, `y` of an
/// open level, or nothing when no statement did. Reads the level's text as it is now.
#[tauri::command]
pub fn level_cell_line(
    worlds: State<'_, Worlds>,
    id: String,
    x: i64,
    y: i64,
) -> Result<Option<u32>, LevelError> {
    worlds.with(&id, |level| Ok(level.session.document().cell_line(x, y)))
}

/// The proposals Claude left pending for an open level, read from its `<level>.studio.json`
/// sidecar and spread into cells. Read-only: nothing is accepted, rejected or written. A level
/// with no sidecar has none.
#[tauri::command]
pub fn level_ghosts(
    worlds: State<'_, Worlds>,
    id: String,
) -> Result<Vec<GhostProposal>, LevelError> {
    worlds.with(&id, |level| Ok(level.ghosts()))
}

/// The current snapshot of an open level, for a window that did not open it (a panel in a window of
/// its own reads the level the main window has open). Read-only.
#[tauri::command]
pub fn level_snapshot(worlds: State<'_, Worlds>, id: String) -> Result<LevelSnapshot, LevelError> {
    worlds.with(&id, |level| Ok(level.snapshot()))
}

/// The layers of an open level that are locked, by id. Read-only.
#[tauri::command]
pub fn level_layers(worlds: State<'_, Worlds>, id: String) -> Result<LevelLayers, LevelError> {
    worlds.with(&id, |level| Ok(level.layers()))
}

/// Locks or unlocks a layer of an open level and keeps the choice in its sidecar. A locked layer
/// refuses every change to it, whoever makes it. Every window hears `level://layers`.
#[tauri::command]
pub fn level_set_layer_locked<R: Runtime>(
    app: AppHandle<R>,
    worlds: State<'_, Worlds>,
    id: String,
    layer: String,
    locked: bool,
) -> Result<LevelLayers, LevelError> {
    let layers = worlds.with(&id, |level| level.set_layer_locked(&layer, locked))?;
    announce_layers(&app, &layers);
    Ok(layers)
}
