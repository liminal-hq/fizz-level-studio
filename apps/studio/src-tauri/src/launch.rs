// Level paths handed to the app: on the command line, and by a second launch
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A double-clicked `.fizz` file arrives as a command-line argument. If the studio is not running,
// the first window asks for those paths when it loads (`app_launch_paths`). If it is, the single
// instance plugin hands the second launch's arguments to the running app, which sends the paths to
// the main windows as `app://open-request` and brings one forward.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::windows::{self, WindowId};

/// Sent to the main windows when a second launch hands the running app level paths.
pub const OPEN_REQUEST_EVENT: &str = "app://open-request";

/// What `app://open-request` carries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct OpenRequest {
    pub paths: Vec<String>,
}

/// The level paths among `args` (the program name first, as `std::env::args` gives them): each
/// argument that names an existing `.fizz` file, made absolute against `cwd` when it is relative,
/// once each, in the order given.
pub fn level_paths<I, S>(args: I, cwd: Option<&Path>) -> Vec<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut found: Vec<PathBuf> = Vec::new();
    for arg in args.into_iter().skip(1) {
        let arg = arg.as_ref();
        if arg.starts_with('-') {
            continue;
        }
        let mut path = PathBuf::from(arg);
        let is_level = path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("fizz"));
        if !is_level {
            continue;
        }
        if path.is_relative() {
            if let Some(cwd) = cwd {
                path = cwd.join(path);
            }
        }
        if path.is_file() && !found.contains(&path) {
            found.push(path);
        }
    }
    found
}

/// The level paths from the command line that no window has asked for yet.
#[derive(Default)]
pub struct PendingPaths(Mutex<Vec<String>>);

impl PendingPaths {
    pub fn push(&self, paths: impl IntoIterator<Item = String>) {
        self.0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .extend(paths);
    }

    /// Hands over the queued paths, leaving none: a window that reloads is not told to open them
    /// again.
    pub fn take(&self) -> Vec<String> {
        std::mem::take(&mut *self.0.lock().unwrap_or_else(|e| e.into_inner()))
    }
}

/// The queue, made if it is not there yet: a second launch can arrive before `setup` has run.
fn pending<R: Runtime>(app: &AppHandle<R>) -> State<'_, PendingPaths> {
    app.manage(PendingPaths::default());
    app.state::<PendingPaths>()
}

fn display(paths: Vec<PathBuf>) -> Vec<String> {
    paths
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// Queues the level paths in the command line this process started with.
pub fn queue_startup_paths<R: Runtime>(app: &AppHandle<R>) {
    let paths = display(level_paths(
        std::env::args(),
        std::env::current_dir().ok().as_deref(),
    ));
    if !paths.is_empty() {
        log::info!("{} level path(s) on the command line", paths.len());
        pending(app).push(paths);
    }
}

/// A second launch: bring a main window forward and hand it the level paths, or queue them if no
/// main window is open yet to hear them.
pub fn handle_second_launch<R: Runtime>(app: &AppHandle<R>, args: Vec<String>, cwd: &str) {
    let paths = display(level_paths(args, Some(Path::new(cwd))));
    let window = windows::open_or_focus(app, &WindowId::Main { n: 1 });
    if paths.is_empty() {
        return;
    }
    log::info!(
        "a second launch asked to open {} level path(s)",
        paths.len()
    );
    match window {
        Ok(window) => {
            // A window that was just built may not have its listener yet, so the paths are also
            // queued: the page asks for the queue when it starts, and takes what the event missed.
            pending(app).push(paths.clone());
            if let Err(e) = app.emit_to(window.label(), OPEN_REQUEST_EVENT, OpenRequest { paths }) {
                log::warn!("could not send the open request: {e}");
            }
        }
        Err(e) => {
            log::warn!("could not open a window for the second launch: {e}");
            pending(app).push(paths);
        }
    }
}

/// The level paths named when the app started, handed over once.
#[tauri::command]
pub fn app_launch_paths(pending: State<'_, PendingPaths>) -> Vec<String> {
    pending.take()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_with(files: &[&str]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for f in files {
            std::fs::write(dir.path().join(f), "level \"T\" 4x4\n").unwrap();
        }
        dir
    }

    #[test]
    fn only_existing_fizz_files_are_level_paths() {
        let dir = temp_with(&["a.fizz", "b.txt", "C.FIZZ"]);
        let d = dir.path();
        let args = [
            "studio".to_owned(),
            d.join("a.fizz").to_string_lossy().into_owned(),
            d.join("b.txt").to_string_lossy().into_owned(),
            d.join("missing.fizz").to_string_lossy().into_owned(),
            d.join("C.FIZZ").to_string_lossy().into_owned(),
            "--flag".to_owned(),
        ];
        let paths = level_paths(args, None);
        assert_eq!(paths, vec![d.join("a.fizz"), d.join("C.FIZZ")]);
    }

    #[test]
    fn the_program_name_is_never_a_path_and_repeats_are_dropped() {
        let dir = temp_with(&["a.fizz"]);
        let a = dir.path().join("a.fizz").to_string_lossy().into_owned();
        // Even a program called `a.fizz` is skipped as argument zero.
        let paths = level_paths([a.clone(), a.clone(), a.clone()], None);
        assert_eq!(paths.len(), 1);
    }

    #[test]
    fn a_relative_path_is_resolved_against_the_working_directory() {
        let dir = temp_with(&["rel.fizz"]);
        let paths = level_paths(["studio", "rel.fizz"], Some(dir.path()));
        assert_eq!(paths, vec![dir.path().join("rel.fizz")]);
        // With no working directory a relative path that is not there is dropped.
        assert!(level_paths(["studio", "rel.fizz"], None).is_empty());
    }

    #[test]
    fn the_queue_hands_over_its_paths_once() {
        let pending = PendingPaths::default();
        pending.push(["one.fizz".to_owned(), "two.fizz".to_owned()]);
        assert_eq!(pending.take(), vec!["one.fizz", "two.fizz"]);
        assert!(pending.take().is_empty());
    }

    #[test]
    fn a_second_launch_brings_the_main_window_forward_and_queues_its_paths() {
        let dir = temp_with(&["x.fizz"]);
        let app = tauri::test::mock_app();
        app.manage(PendingPaths::default());
        let x = dir.path().join("x.fizz").to_string_lossy().into_owned();
        handle_second_launch(
            app.handle(),
            vec!["studio".to_owned(), x.clone()],
            &dir.path().to_string_lossy(),
        );
        assert!(app.get_webview_window("main-1").is_some());
        assert_eq!(app.state::<PendingPaths>().take(), vec![x]);
        // Launching again with no level paths opens nothing new and queues nothing.
        handle_second_launch(app.handle(), vec!["studio".to_owned()], "/");
        assert_eq!(app.webview_windows().len(), 1);
        assert!(app.state::<PendingPaths>().take().is_empty());
    }
}
