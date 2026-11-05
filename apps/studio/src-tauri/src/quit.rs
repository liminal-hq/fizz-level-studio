// Quitting the whole app: asks every main window first, acts only when all agree, then exits
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

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WebviewWindow};

use crate::quit_round::{Decision, Outcome, QuitRounds, Step};
use crate::windows::WindowId;

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
pub struct QuitState(Mutex<QuitRounds>);

impl QuitState {
    fn with<T>(&self, f: impl FnOnce(&mut QuitRounds) -> T) -> T {
        f(&mut self.0.lock().unwrap_or_else(|e| e.into_inner()))
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
                app.exit(0);
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

/// Starts a quit: each main window is asked in turn, and the app exits when all are ready.
#[tauri::command]
pub fn app_quit<R: Runtime>(app: AppHandle<R>, state: State<'_, QuitState>) {
    let labels = main_labels(&app);
    let step = state.with(|rounds| rounds.begin(labels));
    perform(&app, &state, step);
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
