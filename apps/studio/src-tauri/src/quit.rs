// Quitting the app or closing a main window: asks the windows first, acts only when all agree
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// `app_quit` starts a round (`quit_round.rs`) over the open main windows. Phase 1: it sends
// `app://quit-requested` to each window in turn, which answers with `app_quit_answer` (ready, save,
// discard or cancel) and does nothing else. Phase 2, only if nobody cancelled: it sends
// `app://quit-commit` to each window that chose Save or Discard, one at a time, which carries the
// decision out and says how it went with `app_quit_confirm`. `AppHandle::exit` runs only after
// every confirmation, so the plugins' exit hooks run as a normal close does (the worlds plugin
// stops its autosave there), and a discarded level has dropped its recovery copy by then.
//
// Every way of closing goes through the same round. File > Quit starts a whole-app round. A
// window's own close (the title bar's X, Alt+F4, anything that makes the window manager ask the
// window to close) arrives as `CloseRequested`, which `request_close` always prevents and then
// routes by the window's kind: the last main window closes with whole-app scope, exactly as Quit
// does; one of several main windows closes with window scope (only it, and the panels torn off
// it); the child windows (panel, Preferences, About, ghost) close at once. `exit_requested`
// holds back an exit that did not come from a finished round.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WebviewWindow, WindowEvent};

use crate::quit_round::{Decision, Outcome, QuitRounds, Step};
use crate::windows::{WindowId, WindowKind};

/// Sent to the main window being asked whether it is ready to quit.
pub const QUIT_REQUESTED_EVENT: &str = "app://quit-requested";

/// Sent to a main window that must carry out its decision.
pub const QUIT_COMMIT_EVENT: &str = "app://quit-commit";

/// What `app://quit-commit` carries: the round, and what to do (`save` or `discard`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct QuitCommit {
    pub round: u64,
    pub decision: Decision,
}

/// What `app://quit-requested` carries: the round the answer must name.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct QuitRequest {
    pub round: u64,
}

/// The quit round in progress, if any.
#[derive(Default)]
pub struct QuitState {
    rounds: Mutex<QuitRounds>,
    /// Set once a finished round has decided to exit, so `exit_requested` lets that exit through.
    exiting: AtomicBool,
}

impl QuitState {
    fn with<T>(&self, f: impl FnOnce(&mut QuitRounds) -> T) -> T {
        f(&mut self.rounds.lock().unwrap_or_else(|e| e.into_inner()))
    }
}

/// The labels of the open main windows, in window-number order.
fn main_labels<R: Runtime>(app: &AppHandle<R>) -> Vec<String> {
    let mut mains: Vec<(u32, String)> = app
        .webview_windows()
        .into_keys()
        .filter_map(|label| match WindowId::parse(&label) {
            Some(WindowId::Main { n }) => Some((n, label)),
            _ => None,
        })
        .collect();
    mains.sort();
    mains.into_iter().map(|(_, label)| label).collect()
}

/// Carries out a step; a window that cannot be asked counts as gone, so the round moves on.
fn perform<R: Runtime>(app: &AppHandle<R>, state: &QuitState, mut step: Step) {
    loop {
        match step {
            Step::Exit => {
                state.exiting.store(true, Ordering::SeqCst);
                app.exit(0);
                return;
            }
            Step::CloseWindow(label) => {
                close_main_window(app, &label);
                return;
            }
            Step::Stop | Step::Ignore => return,
            Step::Ask { round, label } => {
                let asked = app.get_webview_window(&label).is_some_and(|window| {
                    // The question is easier to see in front of the others.
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                    app.emit_to(&label, QUIT_REQUESTED_EVENT, QuitRequest { round })
                        .is_ok()
                });
                if asked {
                    return;
                }
                log::warn!("could not ask {label} to quit; treating it as closed");
                step = state.with(|rounds| rounds.gone(&label));
            }
            Step::Commit {
                round,
                label,
                decision,
            } => {
                let sent = app.get_webview_window(&label).is_some_and(|_| {
                    app.emit_to(&label, QUIT_COMMIT_EVENT, QuitCommit { round, decision })
                        .is_ok()
                });
                if sent {
                    return;
                }
                log::warn!("could not tell {label} to quit; treating it as closed");
                step = state.with(|rounds| rounds.gone(&label));
            }
        }
    }
}

/// Closes a main window and the panel windows torn off it (the panels carry the window's number).
/// It is destroyed, not closed, so the round that just finished does not start again.
fn close_main_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    let Some(WindowId::Main { n }) = WindowId::parse(label) else {
        return;
    };
    for (panel_label, window) in app.webview_windows() {
        if matches!(WindowId::parse(&panel_label), Some(WindowId::Panel { n: m, .. }) if m == n) {
            let _ = window.destroy();
        }
    }
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.destroy();
    }
}

/// Starts a whole-app round: each main window is asked in turn, and the app exits when all agree.
fn begin_app_round<R: Runtime>(app: &AppHandle<R>) {
    let Some(state) = app.try_state::<QuitState>() else {
        return;
    };
    let labels = main_labels(app);
    let step = state.with(|rounds| rounds.begin(labels));
    perform(app, &state, step);
}

/// Starts a quit: each main window is asked in turn, and the app exits when all are ready.
#[tauri::command]
pub fn app_quit<R: Runtime>(app: AppHandle<R>) {
    begin_app_round(&app);
}

/// What a window's close request turns into.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CloseRoute {
    /// A whole-app round, as Quit does.
    App,
    /// A round over just this main window.
    Window,
    /// The window closes at once.
    Immediate,
}

/// Routes a close request by the window's kind and how many main windows are open.
pub fn route_close(kind: WindowKind, main_windows: usize) -> CloseRoute {
    match kind {
        WindowKind::Main if main_windows <= 1 => CloseRoute::App,
        WindowKind::Main => CloseRoute::Window,
        WindowKind::Panel
        | WindowKind::NewWorld
        | WindowKind::Preferences
        | WindowKind::About
        | WindowKind::TearGhost => CloseRoute::Immediate,
    }
}

/// A window was asked to close (its X, Alt+F4, or a close call). Main windows are held back and
/// go through a round; the others are left to close.
pub fn request_close<R: Runtime>(window: &tauri::Window<R>, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    let app = window.app_handle();
    let Some(id) = WindowId::parse(window.label()) else {
        return;
    };
    match route_close(id.kind(), main_labels(app).len()) {
        CloseRoute::Immediate => {}
        CloseRoute::App => {
            api.prevent_close();
            begin_app_round(app);
        }
        CloseRoute::Window => {
            api.prevent_close();
            if let Some(state) = app.try_state::<QuitState>() {
                let step = state.with(|rounds| rounds.begin_window(window.label()));
                perform(app, &state, step);
            }
        }
    }
}

/// Whether an exit request may go through unasked. It does when a finished round asked for it, and
/// when the code is not zero: a restart (`RESTART_EXIT_CODE`) or a failure cannot wait for a
/// dialog. An explicit `exit(0)` from elsewhere, or the last window closing (`code` is `None`), is
/// held back and put through the round. A session end or SIGTERM never reaches this handler on
/// Linux (the process is simply ended, and the autosave recovery copy carries unsaved work as it
/// does after a crash), so it is never held up by a dialog.
pub fn exit_allowed(code: Option<i32>, exiting: bool) -> bool {
    exiting || matches!(code, Some(c) if c != 0)
}

/// An exit was requested: let it through if it is allowed, or hold it and ask the windows.
pub fn exit_requested<R: Runtime>(
    app: &AppHandle<R>,
    code: Option<i32>,
    api: &tauri::ExitRequestApi,
) {
    let exiting = app
        .try_state::<QuitState>()
        .is_some_and(|state| state.exiting.load(Ordering::SeqCst));
    if exit_allowed(code, exiting) {
        return;
    }
    api.prevent_exit();
    begin_app_round(app);
}

/// A main window's decision, answering `app://quit-requested`; nothing is carried out yet.
#[tauri::command]
pub fn app_quit_answer<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    state: State<'_, QuitState>,
    round: u64,
    decision: Decision,
) {
    let step = state.with(|rounds| rounds.answer(round, window.label(), decision));
    perform(&app, &state, step);
}

/// A main window's report on `app://quit-commit`: it carried the decision out, or it failed.
#[tauri::command]
pub fn app_quit_confirm<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    state: State<'_, QuitState>,
    round: u64,
    outcome: Outcome,
) {
    let step = state.with(|rounds| rounds.confirm(round, window.label(), outcome));
    perform(&app, &state, step);
}

/// A window was destroyed: if the quit was waiting on it, it carries on.
pub fn window_gone<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(state) = app.try_state::<QuitState>() {
        let step = state.with(|rounds| rounds.gone(label));
        perform(app, &state, step);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_last_main_window_closes_the_whole_app_as_quit_does() {
        assert_eq!(route_close(WindowKind::Main, 1), CloseRoute::App);
        assert_eq!(route_close(WindowKind::Main, 0), CloseRoute::App);
    }

    #[test]
    fn one_of_several_main_windows_closes_alone() {
        assert_eq!(route_close(WindowKind::Main, 2), CloseRoute::Window);
    }

    #[test]
    fn child_windows_close_at_once() {
        for kind in [
            WindowKind::Panel,
            WindowKind::NewWorld,
            WindowKind::Preferences,
            WindowKind::About,
            WindowKind::TearGhost,
        ] {
            assert_eq!(route_close(kind, 1), CloseRoute::Immediate, "{kind:?}");
        }
    }

    #[test]
    fn only_a_finished_round_or_a_non_zero_code_leaves_unasked() {
        assert!(!exit_allowed(None, false));
        assert!(!exit_allowed(Some(0), false));
        assert!(exit_allowed(Some(0), true));
        assert!(exit_allowed(None, true));
        assert!(exit_allowed(Some(1), false));
        assert!(exit_allowed(Some(tauri::RESTART_EXIT_CODE), false));
    }
}
