// The quit round: asks each main window in turn whether it is ready to go, with no Tauri in it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Quitting the whole app must never lose unsaved work silently, and only a window knows whether
// its level has unsaved changes. So Rust asks the main windows one at a time (a window with unsaved
// changes shows Save, Discard and Cancel, and answers once the person has chosen), and exits only
// after every one has said it is ready. One Cancel stops the round and leaves every window open.
// Each round has an id, so an answer to an earlier round, or from a window that was not asked, is
// ignored.

use std::collections::VecDeque;

use serde::Deserialize;

/// A window's answer to being asked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Answer {
    /// Nothing unsaved is left in the window: it saved, discarded or had no changes.
    Proceed,
    /// The person chose Cancel.
    Cancel,
}

/// What the app does next.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Step {
    /// Ask this window (by label), in this round.
    Ask { round: u64, label: String },
    /// Every window is ready: exit the app.
    Exit,
    /// The round ended without quitting (a Cancel, or a request that was replaced).
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
    asking: String,
    waiting: VecDeque<String>,
}

impl QuitRounds {
    /// Starts a round over `labels`, asked in the order given. A round already running is replaced,
    /// so a window that never answers cannot lock the quit out. With nobody to ask, the app exits.
    pub fn begin<I, S>(&mut self, labels: I) -> Step
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.last_round += 1;
        let mut waiting: VecDeque<String> = labels.into_iter().map(Into::into).collect();
        match waiting.pop_front() {
            None => {
                self.active = None;
                Step::Exit
            }
            Some(first) => {
                let round = self.last_round;
                self.active = Some(Active {
                    round,
                    asking: first.clone(),
                    waiting,
                });
                Step::Ask {
                    round,
                    label: first,
                }
            }
        }
    }

    /// Takes the answer of window `label` to round `round`.
    pub fn answer(&mut self, round: u64, label: &str, answer: Answer) -> Step {
        match &self.active {
            Some(active) if active.round == round && active.asking == label => {}
            _ => return Step::Ignore,
        }
        match answer {
            Answer::Cancel => {
                self.active = None;
                Step::Stop
            }
            Answer::Proceed => self.next(),
        }
    }

    /// A window went away. If it was the one being asked, it counts as ready (there is nothing
    /// left in it to lose); if it was waiting its turn it is dropped from the round.
    pub fn gone(&mut self, label: &str) -> Step {
        let Some(active) = self.active.as_mut() else {
            return Step::Ignore;
        };
        if active.asking == label {
            return self.next();
        }
        active.waiting.retain(|waiting| waiting != label);
        Step::Ignore
    }

    fn next(&mut self) -> Step {
        let Some(active) = self.active.as_mut() else {
            return Step::Ignore;
        };
        match active.waiting.pop_front() {
            Some(label) => {
                active.asking = label.clone();
                Step::Ask {
                    round: active.round,
                    label,
                }
            }
            None => {
                self.active = None;
                Step::Exit
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ask(round: u64, label: &str) -> Step {
        Step::Ask {
            round,
            label: label.into(),
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
    fn windows_are_asked_one_at_a_time_and_the_app_exits_after_the_last() {
        let mut rounds = QuitRounds::default();
        assert_eq!(rounds.begin(["main-1", "main-2"]), ask(1, "main-1"));
        assert_eq!(
            rounds.answer(1, "main-1", Answer::Proceed),
            ask(1, "main-2")
        );
        assert_eq!(rounds.answer(1, "main-2", Answer::Proceed), Step::Exit);
    }

    #[test]
    fn one_cancel_stops_the_round_and_later_windows_are_never_asked() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2", "main-3"]);
        rounds.answer(1, "main-1", Answer::Proceed);
        assert_eq!(rounds.answer(1, "main-2", Answer::Cancel), Step::Stop);
        assert_eq!(rounds.answer(1, "main-3", Answer::Proceed), Step::Ignore);
    }

    #[test]
    fn a_stale_round_or_the_wrong_window_is_ignored() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1", "main-2"]);
        assert_eq!(rounds.answer(1, "main-2", Answer::Proceed), Step::Ignore);
        assert_eq!(rounds.answer(9, "main-1", Answer::Proceed), Step::Ignore);
        assert_eq!(
            rounds.answer(1, "main-1", Answer::Proceed),
            ask(1, "main-2")
        );
    }

    #[test]
    fn a_new_request_replaces_a_round_that_never_finished() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1"]);
        assert_eq!(rounds.begin(["main-1"]), ask(2, "main-1"));
        assert_eq!(rounds.answer(1, "main-1", Answer::Proceed), Step::Ignore);
        assert_eq!(rounds.answer(2, "main-1", Answer::Proceed), Step::Exit);
    }

    #[test]
    fn an_answer_after_the_round_ended_is_ignored() {
        let mut rounds = QuitRounds::default();
        rounds.begin(["main-1"]);
        rounds.answer(1, "main-1", Answer::Cancel);
        assert_eq!(rounds.answer(1, "main-1", Answer::Proceed), Step::Ignore);
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
        assert_eq!(rounds.answer(1, "main-1", Answer::Proceed), Step::Exit);
    }

    #[test]
    fn the_answer_words_are_lowercase() {
        assert_eq!(
            serde_json::from_str::<Answer>("\"proceed\"").unwrap(),
            Answer::Proceed
        );
        assert_eq!(
            serde_json::from_str::<Answer>("\"cancel\"").unwrap(),
            Answer::Cancel
        );
    }
}
