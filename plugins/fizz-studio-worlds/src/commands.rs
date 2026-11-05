// The plugin's commands: open a folder or a level, send edits, step through history, save, close
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_level::step_name;
use fizz_studio_protocol::{
    LevelEdit, LevelError, LevelSnapshot, ProjectInfo, ProjectKind, RecoveryEntry,
};
use fizz_studio_session::{Author, Request};
use fizz_studio_world::{Project, ProjectKind as FoundKind};
use tauri::{AppHandle, Runtime, State};

use crate::open::{announce, io_error, session_error, Worlds};

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
