// The close gate: a window that closes only when its page agrees, with no Tauri in it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The New level window knows whether its form holds unsaved input, and Rust does not. When the
// window is asked to close, Rust holds the close back, sends the page a request carrying a token,
// and closes the window only when the page answers `close` to that token. `stay` keeps the window.
// `asking` says the page is showing a question, which ends the wait for a first answer (a person
// reading a dialog is not a page that is gone). A page that says nothing before the deadline is
// gone, and `expire` tells the caller to close the window. A newer request for the same window
// replaces an older one, so only the latest token is heard.

use std::collections::HashMap;

use serde::Deserialize;

/// What the page says about a close request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Answer {
    /// Nothing is lost: close the window.
    Close,
    /// Keep the window open.
    Stay,
    /// The page is asking the person; no deadline applies until it says close or stay.
    Asking,
}

#[derive(Debug, Default)]
pub struct CloseGate {
    last: u64,
    pending: HashMap<String, Pending>,
}

#[derive(Debug)]
struct Pending {
    token: u64,
    heard: bool,
}

impl CloseGate {
    /// A close was requested for `label`: returns the token the page must answer with.
    pub fn request(&mut self, label: &str) -> u64 {
        self.last += 1;
        self.pending.insert(
            label.to_owned(),
            Pending {
                token: self.last,
                heard: false,
            },
        );
        self.last
    }

    /// The page answered. Returns true when the window must be closed now.
    pub fn answer(&mut self, label: &str, token: u64, answer: Answer) -> bool {
        match self.pending.get_mut(label) {
            Some(pending) if pending.token == token => match answer {
                Answer::Asking => {
                    pending.heard = true;
                    false
                }
                Answer::Stay => {
                    self.pending.remove(label);
                    false
                }
                Answer::Close => {
                    self.pending.remove(label);
                    true
                }
            },
            _ => false,
        }
    }

    /// The deadline for `token` passed. True when the page never spoke, so the window is closed.
    pub fn expire(&mut self, label: &str, token: u64) -> bool {
        match self.pending.get(label) {
            Some(pending) if pending.token == token && !pending.heard => {
                self.pending.remove(label);
                true
            }
            _ => false,
        }
    }

    /// The window went away: nothing is waiting on it any more.
    pub fn gone(&mut self, label: &str) {
        self.pending.remove(label);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_window_closes_only_when_the_page_says_close() {
        let mut gate = CloseGate::default();
        let token = gate.request("new-world");
        assert!(gate.answer("new-world", token, Answer::Close));
        assert!(!gate.answer("new-world", token, Answer::Close));
    }

    #[test]
    fn stay_keeps_the_window_and_ends_the_wait() {
        let mut gate = CloseGate::default();
        let token = gate.request("new-world");
        assert!(!gate.answer("new-world", token, Answer::Stay));
        assert!(!gate.expire("new-world", token));
        assert!(!gate.answer("new-world", token, Answer::Close));
    }

    #[test]
    fn a_page_that_says_nothing_is_closed_at_the_deadline() {
        let mut gate = CloseGate::default();
        let token = gate.request("new-world");
        assert!(gate.expire("new-world", token));
        assert!(!gate.expire("new-world", token));
    }

    #[test]
    fn a_page_showing_a_question_is_not_closed_at_the_deadline() {
        let mut gate = CloseGate::default();
        let token = gate.request("new-world");
        assert!(!gate.answer("new-world", token, Answer::Asking));
        assert!(!gate.expire("new-world", token));
        assert!(gate.answer("new-world", token, Answer::Close));
    }

    #[test]
    fn a_newer_request_replaces_an_older_one() {
        let mut gate = CloseGate::default();
        let old = gate.request("new-world");
        let new = gate.request("new-world");
        assert!(!gate.answer("new-world", old, Answer::Close));
        assert!(!gate.expire("new-world", old));
        assert!(gate.answer("new-world", new, Answer::Close));
    }

    #[test]
    fn an_answer_for_another_window_or_a_gone_window_is_ignored() {
        let mut gate = CloseGate::default();
        let token = gate.request("new-world");
        assert!(!gate.answer("about", token, Answer::Close));
        gate.gone("new-world");
        assert!(!gate.answer("new-world", token, Answer::Close));
        assert!(!gate.expire("new-world", token));
    }

    #[test]
    fn the_words_are_lowercase() {
        assert_eq!(
            serde_json::from_str::<Answer>("\"asking\"").unwrap(),
            Answer::Asking
        );
    }
}
