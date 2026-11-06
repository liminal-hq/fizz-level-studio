// Plugin tests: the commands run against a mock Tauri app with real windows and real files
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use fizz_studio_protocol::{
    LevelEdit, LevelError, LevelSnapshot, LevelTarget, NewLevelRequest, ProjectKind,
};
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
fn the_words_and_a_cells_line_are_answered_for_an_open_level() {
    let app = app();
    let (_dir, path) = project();
    let snapshot = open(&app, &path);
    let words = commands::language_words();
    assert!(words
        .iter()
        .any(|w| w.word == "plat" && w.kind == "statement"));
    let line = commands::level_cell_line(worlds(&app), snapshot.id.clone(), 50, 10).unwrap();
    assert_eq!(line, Some(17));
    let missing = commands::level_cell_line(worlds(&app), "nope".into(), 0, 0);
    assert!(missing.is_err());
}

#[test]
fn another_window_reads_the_open_levels_current_snapshot() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    let read = commands::level_snapshot(worlds(&app), opened.id.clone()).unwrap();
    assert_eq!(read, opened);
    assert!(commands::level_snapshot(worlds(&app), "nope".into()).is_err());
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

const SLICE: &str = include_str!("../../../fixtures/fizz2/worlds/light/levels/light-1.fizz");

#[test]
fn a_fizz_2_level_opens_flat_and_a_paint_saves_only_its_row() {
    let app = app();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("light-1.fizz");
    std::fs::write(&path, SLICE).unwrap();
    let opened = open(&app, &path);
    assert_eq!(opened.target, LevelTarget::Fizz2);
    assert_eq!(opened.banner.as_deref(), Some("level.flatFallback"));
    assert_eq!((opened.view.width, opened.view.height), (32, 48));
    assert!(opened.view.diagnostics.is_empty());

    let edit = LevelEdit::Paint {
        tile: "BLOCK".to_string(),
        x: vec![[3, 5]],
        y: vec![[3, 3]],
    };
    let painted = apply(&app, &opened.id, edit, opened.revision).unwrap();
    assert_eq!(painted.target, LevelTarget::Fizz2);
    save(&app, &opened.id);

    let written = std::fs::read_to_string(&path).unwrap();
    let before: Vec<&str> = SLICE.split('\n').collect();
    let after: Vec<&str> = written.split('\n').collect();
    assert_eq!(before.len(), after.len());
    let changed: Vec<usize> = (0..before.len())
        .filter(|&i| before[i] != after[i])
        .collect();
    assert_eq!(changed.len(), 1);
    assert!(after[changed[0]].starts_with("\t|#wwBBBwwww"));
}

#[test]
fn a_fizz_1_level_has_no_banner() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    assert_eq!(opened.target, LevelTarget::Fizz1);
    assert_eq!(opened.banner, None);
}

fn new_request(dir: &Path, id: &str, target: LevelTarget) -> NewLevelRequest {
    NewLevelRequest {
        name: "Sugar Hill".to_string(),
        id: id.to_string(),
        width: 40,
        height: 24,
        ground: None,
        theme: None,
        target,
        folder: dir.to_string_lossy().into_owned(),
    }
}

fn create(app: &App, request: NewLevelRequest) -> Result<LevelSnapshot, LevelError> {
    commands::level_create(app.handle().clone(), worlds(app), request)
}

fn entries(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

#[test]
fn a_new_fizz_1_level_is_a_file_that_opens_and_has_no_script_line() {
    let app = app();
    let dir = tempfile::tempdir().unwrap();
    let mut request = new_request(dir.path(), "crater", LevelTarget::Fizz1);
    request.theme = Some("crater".to_string());
    let snapshot = create(&app, request).expect("the level is made");
    assert_eq!(snapshot.target, LevelTarget::Fizz1);
    assert_eq!(snapshot.banner, None);
    assert!(snapshot.view.diagnostics.is_empty());
    assert_eq!((snapshot.view.width, snapshot.view.height), (40, 24));
    assert_eq!(snapshot.revision, snapshot.saved_revision);
    let written = std::fs::read_to_string(dir.path().join("crater.fizz")).unwrap();
    assert_eq!(written, snapshot.text);
    assert!(written.starts_with("level \"Sugar Hill\" 40x24 ground=6 id=crater\ntheme crater\n"));
    assert!(!written.lines().any(|l| l.starts_with("script")));
    assert_eq!(entries(dir.path()), vec!["crater.fizz"]);
}

#[test]
fn a_new_fizz_2_level_is_a_world_project_that_opens_flat() {
    let app = app();
    let dir = tempfile::tempdir().unwrap();
    let snapshot = create(
        &app,
        new_request(dir.path(), "sugar-hill", LevelTarget::Fizz2),
    )
    .expect("the world is made");
    assert_eq!(snapshot.target, LevelTarget::Fizz2);
    assert_eq!(snapshot.banner.as_deref(), Some("level.flatFallback"));
    assert!(snapshot.view.diagnostics.is_empty());
    assert!(snapshot.text.starts_with("script fizz2 0\n"));
    let root = dir.path().join("sugar-hill");
    assert_eq!(entries(&root), vec!["levels", "world.fizz"]);
    assert_eq!(
        std::fs::read_to_string(root.join("world.fizz")).unwrap(),
        "script fizz2 0\nworld \"Sugar Hill\" id=sugar-hill pack=SUGARHIL target=ep2\nlevels   levels/sugar-hill.fizz\n"
    );
    assert_eq!(entries(&root.join("levels")), vec!["sugar-hill.fizz"]);
    let info = commands::project_open(root.to_string_lossy().into_owned()).unwrap();
    assert_eq!(info.kind, ProjectKind::Fizz2);
    assert_eq!(info.levels.len(), 1);
}

#[test]
fn an_existing_file_or_world_is_never_overwritten() {
    let app = app();
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("taken.fizz"), "keep me").unwrap();
    let refused = create(&app, new_request(dir.path(), "taken", LevelTarget::Fizz1));
    assert!(
        matches!(refused, Err(LevelError::Invalid { .. })),
        "{refused:?}"
    );
    assert_eq!(
        std::fs::read_to_string(dir.path().join("taken.fizz")).unwrap(),
        "keep me"
    );

    std::fs::create_dir(dir.path().join("world")).unwrap();
    std::fs::write(dir.path().join("world/note.txt"), "keep me").unwrap();
    let refused = create(&app, new_request(dir.path(), "world", LevelTarget::Fizz2));
    assert!(
        matches!(refused, Err(LevelError::Invalid { .. })),
        "{refused:?}"
    );
    assert_eq!(entries(&dir.path().join("world")), vec!["note.txt"]);
    assert_eq!(entries(dir.path()), vec!["taken.fizz", "world"]);
}

#[test]
fn a_bad_request_or_folder_writes_nothing() {
    let app = app();
    let dir = tempfile::tempdir().unwrap();
    let mut bad = new_request(dir.path(), "Not A Slug", LevelTarget::Fizz2);
    assert!(matches!(
        create(&app, bad.clone()),
        Err(LevelError::Invalid { .. })
    ));
    bad.id = "fine".to_string();
    bad.folder = dir.path().join("missing").to_string_lossy().into_owned();
    assert!(matches!(create(&app, bad), Err(LevelError::Invalid { .. })));
    assert!(entries(dir.path()).is_empty());
}

#[test]
fn a_created_level_keeps_its_script_line_through_edits_and_a_save() {
    let app = app();
    let dir = tempfile::tempdir().unwrap();
    for (id, target, tile) in [
        ("crater", LevelTarget::Fizz1, "grass"),
        ("far", LevelTarget::Fizz2, "FILL"),
    ] {
        let made = create(&app, new_request(dir.path(), id, target)).unwrap();
        let header = |text: &str| text.lines().take(2).map(str::to_string).collect::<Vec<_>>();
        let before = header(&made.text);
        let mut revision = made.revision;
        for x in 0..10 {
            let edit = LevelEdit::Paint {
                tile: tile.to_string(),
                x: vec![[x, x + 1]],
                y: vec![[1, 2]],
            };
            revision = apply(&app, &made.id, edit, revision).unwrap().revision;
        }
        let saved = save(&app, &made.id);
        assert_eq!(header(&saved.text), before);
        assert_eq!(saved.target, target);
    }
}

/// The new-world window may create a level and do nothing else with the worlds plugin.
#[test]
fn the_new_world_window_may_only_create_a_level() {
    let file = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../apps/studio/src-tauri/capabilities/new-world.json");
    let capability: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(file).expect("the capability exists"))
            .expect("valid JSON");
    assert_eq!(capability["windows"], serde_json::json!(["new-world"]));
    assert_eq!(
        capability["permissions"],
        serde_json::json!(["fizz-studio-worlds:allow-level-create"])
    );
}

#[test]
fn the_language_words_come_from_rust() {
    let words = commands::language_words();
    let paint = words.iter().find(|w| w.word == "paint").expect("paint");
    assert_eq!(paint.kind, "statement");
    assert!(words.iter().any(|w| w.kind == "enemy"));
}

#[test]
fn the_ghosts_are_the_pending_proposals_in_the_sidecar() {
    let app = app();
    let (_dir, path) = project();
    let opened = open(&app, &path);
    let ghosts = |app: &App| commands::level_ghosts(worlds(app), opened.id.clone()).unwrap();
    assert!(ghosts(&app).is_empty(), "no sidecar, no ghosts");

    let sidecar = path.with_extension("studio.json");
    std::fs::write(
        &sidecar,
        r#"{"version":1,"mode":"propose","nextId":3,"nextNote":1,"notes":[],"history":[
        {"id":"h1","title":"A ledge","lines":["paint grass x=5..6 y=10"],"status":"pending"},
        {"id":"h2","title":"Done","lines":["paint grass x=1 y=1"],"status":"accepted"}]}"#,
    )
    .unwrap();
    let found = ghosts(&app);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].id, "h1");
    assert_eq!(found[0].cells.len(), 2);
    // Reading changes nothing: the level has not moved.
    assert_eq!(current(&app, &opened.id).revision, opened.revision);

    let missing = commands::level_ghosts(worlds(&app), "nope".into());
    assert!(matches!(missing, Err(LevelError::NotOpen { .. })));
}
