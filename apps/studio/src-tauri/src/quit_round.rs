// The quit round: asks every main window first, and acts only when all agree, with no Tauri in it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Quitting the whole app must never lose unsaved work silently, and only a window knows whether
// its level has unsaved changes. The round has two phases. In the ask phase Rust asks the main
// windows one at a time; a window answers with a decision (ready, save or discard), which is only
// recorded, never carried out, or with Cancel, which ends the round with nothing done anywhere. In
// the commit phase, reached only when every window answered without Cancel, the decisions are
// carried out one window at a time, the saves first and the discards after, so a failed save
// stops the quit before any level has been discarded. The app exits only when every window has
// confirmed. A failed save leaves the windows that already saved as saved and everything open.
// Each round has an id, so an answer to an earlier round, or from a window that was not asked, is
// ignored.
//
// A round has a scope. The whole-app scope (File > Quit, and closing the last main window) asks
// every main window and ends in `Exit`. The window scope (closing one main window while others are
// open) asks just that window and ends in `CloseWindow`, so the app keeps running. Everything else
// about the two is the same.

use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

/// A window's answer to being asked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Decision {
    /// Nothing unsaved is in the window: there is nothing to do at commit.
    Ready,
    /// The person chose Save: the window saves at commit.
    Save,
    /// The person chose Discard: the window closes its level at commit.
    Discard,
    /// The person chose Cancel: the round ends and nothing is done.
    Cancel,
}

/// How a window's commit went.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Outcome {
    Done,
    /// The save (or the close) failed: the app stays open.
    Failed,
}

/// What a round does when every window has agreed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    /// Exit the app.
    App,
    /// Close this one main window (and the panel windows torn off it); the app keeps running.
    Window(String),
}

/// What the app does next.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Step {
    /// Ask this window (by label), in this round.
    Ask { round: u64, label: String },
    /// Tell this window to carry out its decision (`Save` or `Discard`), in this round.
    Commit {
        round: u64,
        label: String,
        decision: Decision,
    },
    /// Every window has confirmed, in a whole-app round: exit the app.
    Exit,
    /// Every window has confirmed, in a window round: close this window and its panels.
    CloseWindow(String),
    /// The round ended without quitting (a Cancel, a failure, or a request that was replaced).
    Stop,
    /// Nothing changes: the answer was stale or from a window that was not being asked.
    Ignore,
}

/// The state of at most one round.
#[derive(Debug, Default)]
pub struct QuitRounds {
    last_round: u64,
    active: Option<Active>,
}

#[derive(Debug)]
struct Active {
    round: u64,
    scope: Scope,
    phase: Phase,
}

#[derive(Debug)]
enum Phase {
    Asking {
        asking: String,
        waiting: VecDeque<String>,
        decided: Vec<(String, Decision)>,
    },
    Committing {
        /// The window whose confirmation is awaited.
        current: String,
        /// Windows still to commit, in order.
        queue: VecDeque<(String, Decision)>,
    },
}

impl QuitRounds {
    /// Starts a whole-app round over `labels`, asked in the order given. A round already running is
    /// replaced, so a window that never answers cannot lock the quit out. With nobody to ask, the
    /// app exits.
    pub fn begin<I, S>(&mut self, labels: I) -> Step
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.begin_scoped(labels, Scope::App)
    }

    /// Starts a window round: only `label` is asked, and only it closes when it is done. A round
    /// already running is replaced.
    pub fn begin_window(&mut self, label: &str) -> Step {
        self.begin_scoped([label], Scope::Window(label.to_owned()))
    }

    fn begin_scoped<I, S>(&mut self, labels: I, scope: Scope) -> Step
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.last_round += 1;
        let mut waiting: VecDeque<String> = labels.into_iter().map(Into::into).collect();
        match waiting.pop_front() {
            None => {
                self.active = None;
                finished(scope)
            }
            Some(first) => {
                let round = self.last_round;
                self.active = Some(Active {
                    round,
                    scope,
                    phase: Phase::Asking {
                        asking: first.clone(),
                        waiting,
                        decided: Vec::new(),
                    },
                });
                Step::Ask {
                    round,
                    label: first,
                }
            }
        }
    }

    /// Takes the decision of window `label` to round `round` (ask phase).
    pub fn answer(&mut self, round: u64, label: &str, decision: Decision) -> Step {
        match &self.active {
            Some(Active {
                round: r,
                phase: Phase::Asking { asking, .. },
                ..
            }) if *r == round && asking == label => {}
            _ => return Step::Ignore,
        }
        if decision == Decision::Cancel {
            self.active = None;
            return Step::Stop;
        }
        self.settle(Some(decision))
    }

    /// Takes window `label`'s confirmation of round `round` (commit phase).
    pub fn confirm(&mut self, round: u64, label: &str, outcome: Outcome) -> Step {
        match &self.active {
            Some(Active {
                round: r,
                phase: Phase::Committing { current, .. },
                ..
            }) if *r == round && current == label => {}
            _ => return Step::Ignore,
        }
        match outcome {
            Outcome::Failed => {
                self.active = None;
                Step::Stop
            }
            Outcome::Done => self.next_commit(),
        }
    }

    /// A window went away. If it was the one being asked or committed, it counts as ready or done
    /// (there is nothing left in it to lose); if it was waiting its turn it is dropped.
    pub fn gone(&mut self, label: &str) -> Step {
        let Some(active) = self.active.as_mut() else {
            return Step::Ignore;
        };
        match &mut active.phase {
            Phase::Asking {
                asking,
                waiting,
                decided,
            } => {
                if asking == label {
                    return self.settle(None);
                }
                waiting.retain(|w| w != label);
                decided.retain(|(l, _)| l != label);
                Step::Ignore
            }
            Phase::Committing { current, queue } => {
                if current == label {
                    return self.next_commit();
                }
                queue.retain(|(l, _)| l != label);
                Step::Ignore
            }
        }
    }

    /// Records the asked window's decision (none if it went away) and asks the next, or moves to
    /// the commit phase after the last.
    fn settle(&mut self, decision: Option<Decision>) -> Step {
        let Some(active) = self.active.as_mut() else {
            return Step::Ignore;
        };
        let Phase::Asking {
            asking,
            waiting,
            decided,
        } = &mut active.phase
        else {
            return Step::Ignore;
        };
        if let Some(decision) = decision {
            decided.push((asking.clone(), decision));
        }
        if let Some(label) = waiting.pop_front() {
            *asking = label.clone();
            return Step::Ask {
                round: active.round,
                label,
            };
        }
        // Saves first, so a save that fails stops the quit before anything is discarded.
        let queue: VecDeque<(String, Decision)> = decided
            .iter()
            .filter(|(_, d)| *d == Decision::Save)
            .chain(decided.iter().filter(|(_, d)| *d == Decision::Discard))
            .cloned()
            .collect();
        active.phase = Phase::Committing {
            current: String::new(),
            queue,
        };
        self.next_commit()
    }

    fn next_commit(&mut self) -> Step {
        let Some(active) = self.active.as_mut() else {
            return Step::Ignore;
        };
        let round = active.round;
        let Phase::Committing { current, queue } = &mut active.phase else {
            return Step::Ignore;
        };
        match queue.pop_front() {
            Some((label, decision)) => {
                *current = label.clone();
                Step::Commit {
                    round,
                    label,
                    decision,
                }
            }
            None => {
                let scope = active.scope.clone();
                self.active = None;
                finished(scope)
            }
        }
    }

    /// True while a round is running, for tests and for callers that must not act meanwhile.
    pub fn is_running(&self) -> bool {
        self.active.is_some()
    }
}

/// The step that ends a round which every window agreed to.
fn finished(scope: Scope) -> Step {
    match scope {
        Scope::App => Step::Exit,
        Scope::Window(label) => Step::CloseWindow(label),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Decision::{Cancel, Discard, Ready, Save};

    fn ask(round: u64, label: &str) -> Step {
        Step::Ask {
            round,
            label: label.into(),
        }
    }

    fn commit(round: u64, label: &str, decision: Decision) -> Step {
        Step::Commit {
            round,
            label: label.into(),
            decision,
        }
    }

    #[test]
    fn no_windows_to_ask_exits_at_once() {
        assert_eq!(
            QuitRounds::default().begin(Vec::<String>::new()),
            Step::Exit
        );
    }

    #[test]
    fn clean_windows_are_asked_in_turn_and_the_app_exits_with_no_commit() {
        let mut rounds = QuitRounds::default();
        assert_eq!(rounds.begin(["main-1", "main-2"]), ask(1, "main-1"));
        assert_eq!(rounds.answer(1, "main-1", Ready), ask(1, "main-2"));
        assert_eq!(rounds.answer(1, "main-2", Ready), Step::Exit);
    }

    #[test]
    fn a_save_is_recorded_not_done_until_every_window_has_answered() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        // The answer asks the next window; nothing is committed yet.
        assert_eq!(rounds.answer(1, "main-1", Save), ask(1, "main-2"));
        assert_eq!(rounds.answer(1, "main-2", Ready), commit(1, "main-1", Save));
        assert_eq!(rounds.confirm(1, "main-1", Outcome::Done), Step::Exit);
    }

    #[test]
    fn one_cancel_does_nothing_and_later_windows_are_never_asked() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2", "main-3"]);
        rounds.answer(1, "main-1", Save);
        assert_eq!(rounds.answer(1, "main-2", Cancel), Step::Stop);
        assert_eq!(rounds.answer(1, "main-3", Ready), Step::Ignore);
        assert_eq!(rounds.confirm(1, "main-1", Outcome::Done), Step::Ignore);
    }

    #[test]
    fn a_cancel_from_the_last_window_still_commits_nothing() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        rounds.answer(1, "main-1", Discard);
        assert_eq!(rounds.answer(1, "main-2", Cancel), Step::Stop);
    }

    #[test]
    fn saves_are_committed_before_discards_one_at_a_time() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2", "main-3"]);
        rounds.answer(1, "main-1", Discard);
        rounds.answer(1, "main-2", Save);
        assert_eq!(rounds.answer(1, "main-3", Ready), commit(1, "main-2", Save));
        assert_eq!(
            rounds.confirm(1, "main-2", Outcome::Done),
            commit(1, "main-1", Discard)
        );
        assert_eq!(rounds.confirm(1, "main-1", Outcome::Done), Step::Exit);
    }

    #[test]
    fn a_failed_save_stops_the_exit_and_nothing_later_is_committed() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        rounds.answer(1, "main-1", Discard);
        rounds.answer(1, "main-2", Save);
        assert_eq!(rounds.confirm(1, "main-2", Outcome::Failed), Step::Stop);
        assert_eq!(rounds.confirm(1, "main-1", Outcome::Done), Step::Ignore);
        assert_eq!(rounds.gone("main-1"), Step::Ignore);
    }

    #[test]
    fn a_stale_round_the_wrong_window_or_the_wrong_phase_is_ignored() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        assert_eq!(rounds.answer(1, "main-2", Ready), Step::Ignore);
        assert_eq!(rounds.answer(9, "main-1", Ready), Step::Ignore);
        assert_eq!(rounds.confirm(1, "main-1", Outcome::Done), Step::Ignore);
        rounds.answer(1, "main-1", Save);
        rounds.answer(1, "main-2", Ready);
        assert_eq!(rounds.answer(1, "main-1", Ready), Step::Ignore);
        assert_eq!(rounds.confirm(1, "main-2", Outcome::Done), Step::Ignore);
        assert_eq!(rounds.confirm(2, "main-1", Outcome::Done), Step::Ignore);
        assert_eq!(rounds.confirm(1, "main-1", Outcome::Done), Step::Exit);
    }

    #[test]
    fn a_new_request_replaces_a_round_that_never_finished() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1"]);
        assert_eq!(rounds.begin(["main-1"]), ask(2, "main-1"));
        assert_eq!(rounds.answer(1, "main-1", Ready), Step::Ignore);
        assert_eq!(rounds.answer(2, "main-1", Ready), Step::Exit);
    }

    #[test]
    fn a_new_request_replaces_a_round_that_is_committing() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1"]);
        rounds.answer(1, "main-1", Save);
        assert_eq!(rounds.begin(["main-1"]), ask(2, "main-1"));
        assert_eq!(rounds.confirm(1, "main-1", Outcome::Done), Step::Ignore);
    }

    #[test]
    fn an_answer_after_the_round_ended_is_ignored() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1"]);
        rounds.answer(1, "main-1", Cancel);
        assert_eq!(rounds.answer(1, "main-1", Ready), Step::Ignore);
        assert_eq!(rounds.gone("main-1"), Step::Ignore);
    }

    #[test]
    fn a_window_that_closes_while_asked_counts_as_ready() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        assert_eq!(rounds.gone("main-1"), ask(1, "main-2"));
        assert_eq!(rounds.gone("main-2"), Step::Exit);
    }

    #[test]
    fn a_window_that_closes_while_waiting_is_not_asked() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        assert_eq!(rounds.gone("main-2"), Step::Ignore);
        assert_eq!(rounds.answer(1, "main-1", Ready), Step::Exit);
    }

    #[test]
    fn a_window_that_closes_after_deciding_is_not_committed() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        rounds.answer(1, "main-1", Save);
        assert_eq!(rounds.gone("main-1"), Step::Ignore);
        assert_eq!(rounds.answer(1, "main-2", Ready), Step::Exit);
    }

    #[test]
    fn a_window_that_closes_while_committing_counts_as_done() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        rounds.answer(1, "main-1", Save);
        rounds.answer(1, "main-2", Discard);
        assert_eq!(rounds.gone("main-2"), Step::Ignore);
        assert_eq!(rounds.gone("main-1"), Step::Exit);
    }

    fn close(label: &str) -> Step {
        Step::CloseWindow(label.into())
    }

    #[test]
    fn a_clean_window_round_closes_just_that_window() {
        let mut rounds = QuitRounds::default();
        assert_eq!(rounds.begin_window("main-2"), ask(1, "main-2"));
        assert_eq!(rounds.answer(1, "main-2", Ready), close("main-2"));
        assert!(!rounds.is_running());
    }

    #[test]
    fn a_dirty_window_round_cancels_cleanly_and_closes_nothing() {
        let mut rounds = QuitRounds::default();
        rounds.begin_window("main-2");
        assert_eq!(rounds.answer(1, "main-2", Cancel), Step::Stop);
        assert!(!rounds.is_running());
        assert_eq!(rounds.confirm(1, "main-2", Outcome::Done), Step::Ignore);
        assert_eq!(rounds.gone("main-2"), Step::Ignore);
    }

    #[test]
    fn a_window_round_commits_its_save_then_closes_the_window() {
        let mut rounds = QuitRounds::default();
        rounds.begin_window("main-2");
        assert_eq!(rounds.answer(1, "main-2", Save), commit(1, "main-2", Save));
        assert_eq!(rounds.confirm(1, "main-2", Outcome::Done), close("main-2"));
    }

    #[test]
    fn a_failed_save_in_a_window_round_keeps_the_window() {
        let mut rounds = QuitRounds::default();
        rounds.begin_window("main-2");
        rounds.answer(1, "main-2", Discard);
        assert_eq!(rounds.confirm(1, "main-2", Outcome::Failed), Step::Stop);
    }

    #[test]
    fn a_window_round_never_asks_other_windows() {
        let mut rounds = QuitRounds::default();
        rounds.begin_window("main-2");
        assert_eq!(rounds.answer(1, "main-1", Ready), Step::Ignore);
        assert_eq!(rounds.gone("main-1"), Step::Ignore);
        assert_eq!(rounds.answer(1, "main-2", Ready), close("main-2"));
    }

    #[test]
    fn a_window_that_closes_during_its_own_round_counts_as_ready() {
        let mut rounds = QuitRounds::default();
        rounds.begin_window("main-2");
        assert_eq!(rounds.gone("main-2"), close("main-2"));
    }

    #[test]
    fn a_close_request_replaces_a_running_round_whatever_its_scope() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        // The person closes one window while the whole-app round waits: the window round wins.
        assert_eq!(rounds.begin_window("main-2"), ask(2, "main-2"));
        assert_eq!(rounds.answer(1, "main-1", Ready), Step::Ignore);
        assert_eq!(rounds.answer(2, "main-2", Ready), close("main-2"));
        // And a whole-app request replaces a window round.
        rounds.begin_window("main-2");
        assert_eq!(rounds.begin(["main-1"]), ask(4, "main-1"));
        assert_eq!(rounds.answer(3, "main-2", Ready), Step::Ignore);
        assert_eq!(rounds.answer(4, "main-1", Ready), Step::Exit);
    }

    #[test]
    fn a_whole_app_round_still_ends_in_exit_after_a_window_round() {
        let mut rounds = QuitRounds::default();
        rounds.begin_window("main-2");
        rounds.answer(1, "main-2", Cancel);
        rounds.begin(["main-1", "main-2"]);
        rounds.answer(2, "main-1", Ready);
        assert_eq!(rounds.answer(2, "main-2", Ready), Step::Exit);
    }

    #[test]
    fn the_words_are_lowercase() {
        assert_eq!(serde_json::from_str::<Decision>("\"save\"").unwrap(), Save);
        assert_eq!(
            serde_json::from_str::<Decision>("\"cancel\"").unwrap(),
            Cancel
        );
        assert_eq!(
            serde_json::from_str::<Outcome>("\"failed\"").unwrap(),
            Outcome::Failed
        );
        assert_eq!(serde_json::to_string(&Discard).unwrap(), "\"discard\"");
    }
}
