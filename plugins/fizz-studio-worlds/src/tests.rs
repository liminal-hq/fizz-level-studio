// Plugin tests: the commands run against a mock Tauri app with real windows and real files
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use fizz_studio_protocol::{LevelEdit, LevelError, LevelSnapshot, ProjectKind};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tauri::{Listener, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::{
    commands, init_with, LevelConflict, RecoveryConfig, Worlds, CHANGED_EVENT, CONFLICT_EVENT,
};

type App = tauri::App<MockRuntime>;

const CRATER: &str = include_str!("../../../levels/crater.fizz");
const LABELS: [&str; 2] = ["main-1", "panel-layers-1"];

/// An app whose autosave never fires during a test and whose recovery folder is never written.
fn app() -> App {
    app_with(
        std::env::temp_dir().join("fizz-studio-tests-unused-recovery"),
        Duration::from_secs(3600),
    )
}

fn app_with(recovery: PathBuf, interval: Duration) -> App {
    let app = mock_builder()
        .plugin(init_with(RecoveryConfig {
            dir: Some(recovery),
            interval,
        }))
        .build(mock_context(noop_assets()))
        .expect("the mock app builds");
    for label in LABELS {
        WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
            .build()
            .expect("the mock window opens");
    }
    app
}

fn worlds(app: &App) -> tauri::State<'_, Worlds> {
    app.state::<Worlds>()
}

/// Ends the app the way a crash does: its levels stay open and unsaved, and nothing runs after it.
/// Dropping the app is not enough in a test, because the handles the watchers hold keep its state
/// (and so its autosave timer) alive, and that timer would go on rewriting recovery copies for a
/// session that is supposed to be dead. A real crash takes the timer with the process.
fn crash(app: &App) {
    worlds(app).stop_autosave();
}

/// A folder holding a copy of `crater.fizz`.
fn project() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("crater.fizz");
    std::fs::write(&path, CRATER).unwrap();
    (dir, path)
}

fn open(app: &App, path: &Path) -> LevelSnapshot {
    commands::level_open(
        app.handle().clone(),
        worlds(app),
        path.to_string_lossy().into_owned(),
    )
    .expect("the level opens")
}

fn paint(tile: &str, x: u32) -> LevelEdit {
    LevelEdit::Paint {
        tile: tile.to_string(),
        x: vec![[x, x]],
        y: vec![[10, 10]],
    }
}

fn apply(app: &App, id: &str, edit: LevelEdit, based_on: u64) -> Result<LevelSnapshot, LevelError> {
    commands::level_apply(
        app.handle().clone(),
        worlds(app),
        id.to_string(),
        edit,
        based_on,
        None,
    )
}

fn hear<T: serde::de::DeserializeOwned + Send + 'static>(
    app: &App,
    label: &str,
    event: &str,
) -> Arc<Mutex<Vec<T>>> {
    let heard = Arc::new(Mutex::new(Vec::new()));
    let sink = heard.clone();
    app.get_webview_window(label)
        .unwrap()
        .listen(event, move |event| {
            sink.lock()
                .unwrap()
                .push(serde_json::from_str(event.payload()).expect("a payload"));
        });
    heard
}

/// Waits up to `limit` for `done` to hold.
fn within(limit: Duration, mut done: impl FnMut() -> bool) -> bool {
    let started = Instant::now();
    while started.elapsed() < limit {
        if done() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    done()
}

fn current(app: &App, id: &str) -> LevelSnapshot {
    worlds(app)
        .with(id, |level| Ok(level.snapshot()))
        .expect("the level is open")
}

#[test]
fn a_folder_opens_with_its_levels() {
    let (dir, path) = project();
    let info = commands::project_open(dir.path().to_string_lossy().into_owned()).unwrap();
    assert_eq!(info.kind, ProjectKind::Fizz1);
    assert_eq!(info.levels, vec![path.to_string_lossy().into_owned()]);
    assert!(commands::project_open("/no/such/folder".into()).is_err());
}

#[test]
fn a_level_opens_paints_undoes_redoes_and_saves() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    assert_eq!(opened.revision, 0);
    assert_eq!(opened.text, CRATER);
    assert_eq!(opened.view.cells.len(), 5_376);
    assert!(!opened.can_undo);

    let painted = apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
    assert_eq!(painted.revision, 1);
    assert_eq!(painted.undo_name.as_deref(), Some("Paint grass"));
    assert!(painted.text.contains("paint grass x=5 y=10"));
    assert_ne!(painted.revision, painted.saved_revision);

    let undone =
        commands::level_undo(app.handle().clone(), worlds(&app), opened.id.clone(), 1).unwrap();
    assert_eq!(undone.text, CRATER);
    assert_eq!(undone.redo_name.as_deref(), Some("Paint grass"));

    let redone =
        commands::level_redo(app.handle().clone(), worlds(&app), opened.id.clone(), 2).unwrap();
    assert_eq!(redone.text, painted.text);

    let saved =
        commands::level_save(app.handle().clone(), worlds(&app), opened.id.clone()).unwrap();
    assert_eq!(saved.saved_revision, saved.revision);
    assert_eq!(std::fs::read_to_string(&path).unwrap(), saved.text);
    commands::level_close(worlds(&app), opened.id).unwrap();
}

#[test]
fn a_stale_apply_is_refused_and_changes_nothing() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
    let refused = apply(&app, &opened.id, paint("path", 6), 0).unwrap_err();
    assert_eq!(
        refused,
        LevelError::Stale {
            based_on: 0,
            current: 1
        }
    );
    assert_eq!(
        serde_json::to_value(&refused).unwrap(),
        serde_json::json!({ "kind": "stale", "based_on": 0, "current": 1 })
    );
    assert_eq!(current(&app, &opened.id).revision, 1);

    let invalid = apply(&app, &opened.id, paint("lava", 6), 1).unwrap_err();
    assert!(matches!(invalid, LevelError::Invalid { .. }));
    let missing = apply(&app, "level-99", paint("grass", 6), 0).unwrap_err();
    assert_eq!(
        missing,
        LevelError::NotOpen {
            id: "level-99".into()
        }
    );
}

#[test]
fn a_stroke_with_one_merge_key_undoes_as_one_step() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    let mut revision = 0;
    for x in 0..5 {
        let snapshot = commands::level_apply(
            app.handle().clone(),
            worlds(&app),
            opened.id.clone(),
            paint("path", x),
            revision,
            Some("stroke".into()),
        )
        .unwrap();
        revision = snapshot.revision;
    }
    commands::level_end_step(worlds(&app), opened.id.clone()).unwrap();
    let undone =
        commands::level_undo(app.handle().clone(), worlds(&app), opened.id, revision).unwrap();
    assert_eq!(undone.text, CRATER);
    assert!(!undone.can_undo);
}

#[test]
fn two_windows_both_hear_a_change() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    let heard: Vec<_> = LABELS
        .iter()
        .map(|label| hear::<LevelSnapshot>(&app, label, CHANGED_EVENT))
        .collect();
    let answer = apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
    for window in &heard {
        let got = window.lock().unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0], answer);
    }
}

#[test]
fn the_studios_own_save_is_not_heard_back() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
    commands::level_save(app.handle().clone(), worlds(&app), opened.id.clone()).unwrap();
    std::thread::sleep(Duration::from_millis(500));
    let level = current(&app, &opened.id);
    assert_eq!(level.revision, 1);
    assert!(!level.edited_outside);
}

#[test]
fn an_outside_write_becomes_a_revision_marked_edited_outside() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    let heard: Vec<_> = LABELS
        .iter()
        .map(|label| hear::<LevelSnapshot>(&app, label, CHANGED_EVENT))
        .collect();

    let outside = CRATER.replace("start 3,4", "start 4,4");
    assert_ne!(outside, CRATER);
    std::fs::write(&path, &outside).unwrap();

    assert!(
        within(Duration::from_secs(1), || {
            current(&app, &opened.id).edited_outside
        }),
        "the outside edit is heard within a second"
    );
    let level = current(&app, &opened.id);
    assert_eq!(level.revision, 1);
    assert_eq!(level.author, "outside");
    assert_eq!(level.text, outside);
    assert_eq!(level.saved_revision, level.revision);
    assert_eq!(level.view.start.map(|s| s.x), Some(4.0));
    assert!(within(Duration::from_secs(1), || heard
        .iter()
        .all(|h| !h.lock().unwrap().is_empty())));
    for window in &heard {
        assert_eq!(window.lock().unwrap()[0].text, outside);
    }
}

#[test]
fn an_outside_edit_beside_unsaved_changes_is_merged() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    apply(&app, &opened.id, paint("grass", 5), 0).unwrap();

    // The person's change is at the end of the file; the outside one is near the top.
    let outside = CRATER.replace("start 3,4", "start 4,4");
    std::fs::write(&path, &outside).unwrap();
    assert!(within(Duration::from_secs(1), || {
        current(&app, &opened.id).revision == 2
    }));
    let level = current(&app, &opened.id);
    assert!(level.text.contains("start 4,4"));
    assert!(level.text.contains("paint grass x=5 y=10"));
    assert_ne!(level.saved_revision, level.revision, "still unsaved");
}

#[test]
fn an_outside_edit_over_the_same_lines_is_a_conflict_and_changes_nothing() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    let conflicts = hear::<LevelConflict>(&app, "main-1", CONFLICT_EVENT);

    // Both sides add to the end of the file, where the studio appends.
    let mine = LevelEdit::Paint {
        tile: "grass".into(),
        x: vec![[1, 1]],
        y: vec![[1, 1]],
    };
    let session_text = apply(&app, &opened.id, mine, 0).unwrap().text;
    std::fs::write(&path, format!("{CRATER}\nedits\n  paint rock x=2 y=2\n")).unwrap();

    assert!(within(Duration::from_secs(1), || {
        !conflicts.lock().unwrap().is_empty()
    }));
    let conflicts = conflicts.lock().unwrap();
    assert_eq!(conflicts[0].id, opened.id);
    assert!(conflicts[0].marked.contains("<<<<<<<"));
    assert_eq!(current(&app, &opened.id).text, session_text);
}

#[test]
fn closing_a_level_forgets_it() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    let again = open(&app, &path);
    assert_eq!(again.id, opened.id, "one session per file");
    commands::level_close(worlds(&app), opened.id.clone()).unwrap();
    assert!(matches!(
        commands::level_close(worlds(&app), opened.id),
        Err(LevelError::NotOpen { .. })
    ));
}

/// The worlds commands reach the main and panel windows only: the dialogs and the new-world window
/// have no business opening files.
#[test]
fn the_capability_leaves_out_about_and_preferences() {
    let file = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../apps/studio/src-tauri/capabilities/worlds.json");
    let capability: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(file).expect("the capability exists"))
            .expect("valid JSON");
    let windows: Vec<&str> = capability["windows"]
        .as_array()
        .expect("a windows list")
        .iter()
        .map(|w| w.as_str().expect("a label"))
        .collect();
    assert_eq!(windows, vec!["main-*", "panel-*"]);
    for banned in ["about", "preferences", "new-world"] {
        assert!(!windows.contains(&banned), "{banned} must not be granted");
    }
    assert_eq!(
        capability["permissions"],
        serde_json::json!(["fizz-studio-worlds:default"])
    );
}

const FAST: Duration = Duration::from_millis(20);

fn copies(app: &App) -> Vec<fizz_studio_protocol::RecoveryEntry> {
    commands::recovery_list(worlds(app)).unwrap()
}

fn restore(app: &App, id: &str) -> Result<LevelSnapshot, LevelError> {
    commands::recovery_restore(app.handle().clone(), worlds(app), id.to_string())
}

fn save(app: &App, id: &str) -> LevelSnapshot {
    commands::level_save(app.handle().clone(), worlds(app), id.to_string()).unwrap()
}

/// The recovery copies on disk under `dir`.
fn copy_folders(dir: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|e| e.path()).collect())
        .unwrap_or_default()
}

fn wait_for_copy(dir: &Path) {
    assert!(
        within(Duration::from_secs(2), || !copy_folders(dir).is_empty()),
        "a recovery copy is kept"
    );
}

#[test]
fn an_unsaved_paint_is_autosaved_and_a_saved_level_has_no_copy() {
    let recovery = tempfile::tempdir().unwrap();
    let app = app_with(recovery.path().to_path_buf(), FAST);
    let (_dir, path) = project();
    let opened = open(&app, &path);

    std::thread::sleep(FAST * 5);
    assert!(copy_folders(recovery.path()).is_empty(), "nothing unsaved");

    let painted = apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
    wait_for_copy(recovery.path());
    // The open level is not offered back to the app that has it open.
    assert!(copies(&app).is_empty());
    let kept = std::fs::read_to_string(
        copy_folders(recovery.path())[0]
            .join("files")
            .join("level.fizz"),
    )
    .unwrap();
    assert_eq!(kept, painted.text);

    save(&app, &opened.id);
    assert!(
        copy_folders(recovery.path()).is_empty(),
        "saving removes it"
    );
    std::thread::sleep(FAST * 5);
    assert!(
        copy_folders(recovery.path()).is_empty(),
        "and it stays gone"
    );
}

#[test]
fn undoing_back_to_the_saved_text_and_closing_discard_the_copy() {
    let recovery = tempfile::tempdir().unwrap();
    let app = app_with(recovery.path().to_path_buf(), FAST);
    let (_dir, path) = project();
    let opened = open(&app, &path);

    apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
    wait_for_copy(recovery.path());
    commands::level_undo(app.handle().clone(), worlds(&app), opened.id.clone(), 1).unwrap();
    assert!(copy_folders(recovery.path()).is_empty(), "a clean undo");

    apply(&app, &opened.id, paint("grass", 6), 2).unwrap();
    wait_for_copy(recovery.path());
    commands::level_close(worlds(&app), opened.id).unwrap();
    assert!(copy_folders(recovery.path()).is_empty(), "closing");
}

#[test]
fn a_crash_leaves_a_copy_that_restores_byte_for_byte_and_can_be_discarded() {
    let recovery = tempfile::tempdir().unwrap();
    let (_dir, path) = project();
    let painted = {
        let app = app_with(recovery.path().to_path_buf(), FAST);
        let opened = open(&app, &path);
        let painted = apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
        wait_for_copy(recovery.path());
        crash(&app);
        painted
        // Never closed: the session did not end cleanly.
    };
    assert_eq!(std::fs::read_to_string(&path).unwrap(), CRATER);

    let app = app_with(recovery.path().to_path_buf(), FAST);
    let offered = copies(&app);
    assert_eq!(offered.len(), 1);
    assert_eq!(offered[0].name, "crater.fizz");
    assert_eq!(
        PathBuf::from(&offered[0].path),
        std::fs::canonicalize(&path).unwrap()
    );
    assert!(offered[0].saved_at_ms > 0);

    let restored = restore(&app, &offered[0].id).unwrap();
    assert_eq!(restored.text, painted.text);
    assert!(restored.revision > restored.saved_revision);
    assert_eq!(restored.author, "recovered");
    assert!(!restored.edited_outside);
    assert_eq!(std::fs::read_to_string(&path).unwrap(), CRATER);
    // Open now, so no longer offered, and not restorable twice.
    assert!(copies(&app).is_empty());
    assert!(restore(&app, &offered[0].id).is_err());
    // The copy stays until the level is saved.
    assert_eq!(copy_folders(recovery.path()).len(), 1);
    save(&app, &restored.id);
    assert_eq!(std::fs::read_to_string(&path).unwrap(), painted.text);
    assert!(copy_folders(recovery.path()).is_empty());
    commands::level_close(worlds(&app), restored.id).unwrap();

    // Discard removes a copy without opening it.
    {
        let app = app_with(recovery.path().to_path_buf(), FAST);
        let opened = open(&app, &path);
        apply(&app, &opened.id, paint("grass", 9), 0).unwrap();
        wait_for_copy(recovery.path());
        crash(&app);
    }
    let app = app_with(recovery.path().to_path_buf(), FAST);
    let offered = copies(&app);
    assert_eq!(offered.len(), 1);
    commands::recovery_discard(worlds(&app), offered[0].id.clone()).unwrap();
    assert!(copies(&app).is_empty());
    assert!(copy_folders(recovery.path()).is_empty());
}

#[test]
fn a_level_whose_file_is_gone_restores_as_a_new_unsaved_level() {
    let recovery = tempfile::tempdir().unwrap();
    let (_dir, path) = project();
    let painted = {
        let app = app_with(recovery.path().to_path_buf(), FAST);
        let opened = open(&app, &path);
        let painted = apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
        wait_for_copy(recovery.path());
        crash(&app);
        painted
    };
    std::fs::remove_file(&path).unwrap();

    let app = app_with(recovery.path().to_path_buf(), FAST);
    let offered = copies(&app);
    let restored = restore(&app, &offered[0].id).unwrap();
    assert_eq!(restored.text, painted.text);
    assert!(restored.revision > restored.saved_revision);
    assert!(!path.exists());
    save(&app, &restored.id);
    assert_eq!(std::fs::read_to_string(&path).unwrap(), painted.text);
}

#[test]
fn the_studios_recovery_writes_are_not_outside_edits() {
    // The recovery folder sits inside the watched level folder, the worst case.
    let (dir, path) = project();
    let recovery = dir.path().join("recovery");
    let app = app_with(recovery.clone(), FAST);
    let opened = open(&app, &path);
    let painted = apply(&app, &opened.id, paint("grass", 5), 0).unwrap();
    wait_for_copy(&recovery);
    std::thread::sleep(Duration::from_millis(600));
    let level = current(&app, &opened.id);
    assert_eq!(level.revision, painted.revision);
    assert!(!level.edited_outside);
    assert_eq!(level.author, "person");
}
