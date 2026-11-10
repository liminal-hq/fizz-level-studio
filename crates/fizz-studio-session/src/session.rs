// The session: the document, its revision, its one writer, and the undo and redo stacks
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::BTreeSet;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::document::{Document, Edit};
use crate::error::SessionError;

/// How many steps are kept to undo.
pub const UNDO_DEPTH: usize = 200;

/// The name of the step an edit made outside the studio becomes.
pub const OUTSIDE_STEP_NAME: &str = "Edit outside the studio";

static NEXT_SESSION: AtomicU64 = AtomicU64::new(1);

/// Who made a change. Claude's steps are marked so the person can tell them apart and review them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Author {
    Person,
    Claude,
    /// A file changed on disk (an editor, `git`, the headless MCP server).
    Outside,
}

/// A claim on the document's single writer seat. Every change needs the token of the current writer.
#[derive(Debug, PartialEq, Eq)]
pub struct WriterToken {
    session: u64,
    claim: u64,
}

/// What a caller asks of the session: an intent, the revision it was worked out against, and how it
/// is named in the history.
#[derive(Debug, Clone)]
pub struct Request<I> {
    /// The revision the caller computed the intent for. Anything but the current revision is refused.
    pub base_revision: u64,
    /// The step's name, as it shows in Undo and Redo ("Paint tiles").
    pub name: String,
    /// Requests that follow each other with the same key, by the same author, make one step: a stroke
    /// of many small intents. `None` always starts a new step.
    pub merge_key: Option<String>,
    pub author: Author,
    pub intent: I,
}

impl<I> Request<I> {
    pub fn new(base_revision: u64, name: impl Into<String>, intent: I) -> Self {
        Self {
            base_revision,
            name: name.into(),
            merge_key: None,
            author: Author::Person,
            intent,
        }
    }

    /// Lets this request merge into the step before it when that step has the same key.
    pub fn merging(mut self, key: impl Into<String>) -> Self {
        self.merge_key = Some(key.into());
        self
    }

    pub fn by(mut self, author: Author) -> Self {
        self.author = author;
        self
    }
}

/// What a change did, to send to every view: the text ranges replaced, and the revision they lead to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Patch {
    pub revision: u64,
    /// Each edit is against the text left by the one before it.
    pub edits: Vec<Edit>,
    pub author: Author,
    /// Whether the change came from a file edited outside the studio.
    pub edited_outside: bool,
}

/// A step in the history, for the Edit menu.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepInfo {
    pub name: String,
    pub author: Author,
}

struct Step {
    name: String,
    author: Author,
    merge_key: Option<String>,
    /// The edits forward, in order.
    edits: Vec<Edit>,
}

impl Step {
    fn info(&self) -> StepInfo {
        StepInfo {
            name: self.name.clone(),
            author: self.author,
        }
    }
}

/// An open document.
pub struct Session<D: Document> {
    id: u64,
    document: D,
    revision: u64,
    saved_revision: u64,
    outside_revision: Option<u64>,
    undo: Vec<Step>,
    redo: Vec<Step>,
    /// Whether the last undo step may still take merging requests.
    open_step: bool,
    writer: Option<(u64, String)>,
    claims: u64,
    /// The layers no change may touch, whoever makes it.
    locks: BTreeSet<String>,
}

// The document's text is the person's work and may be private, so Debug shows sizes and counts only.
impl<D: Document> std::fmt::Debug for Session<D> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Session")
            .field("revision", &self.revision)
            .field("saved_revision", &self.saved_revision)
            .field("text_len", &self.document.text().len())
            .field("undo_steps", &self.undo.len())
            .field("redo_steps", &self.redo.len())
            .field("has_writer", &self.writer.is_some())
            .finish()
    }
}

impl<D: Document> Session<D> {
    pub fn new(document: D) -> Self {
        Self {
            id: NEXT_SESSION.fetch_add(1, Ordering::Relaxed),
            document,
            revision: 0,
            saved_revision: 0,
            outside_revision: None,
            undo: Vec::new(),
            redo: Vec::new(),
            open_step: false,
            writer: None,
            claims: 0,
            locks: BTreeSet::new(),
        }
    }

    /// A session for a document brought back after a crash: as unsaved as it can be, so closing it
    /// asks and a save writes it out, though no change has been made in this session.
    pub fn recovered(document: D) -> Self {
        let mut session = Self::new(document);
        session.revision = 1;
        session
    }

    /// The locked layers, by id. A change that touches one is refused (apply, undo, redo and an
    /// outside edit alike), whoever makes it.
    pub fn locks(&self) -> &BTreeSet<String> {
        &self.locks
    }

    /// Replaces the locked layers. Nothing about the text or the history changes.
    pub fn set_locks(&mut self, locks: impl IntoIterator<Item = String>) {
        self.locks = locks.into_iter().collect();
    }

    /// The locked layers a change from `old` to `new` touches.
    fn locked_between(&self, old: &str, new: &str) -> Vec<String> {
        if self.locks.is_empty() {
            return Vec::new();
        }
        self.document
            .layers_changed(old, new)
            .into_iter()
            .filter(|layer| self.locks.contains(layer))
            .collect()
    }

    pub fn document(&self) -> &D {
        &self.document
    }

    pub fn text(&self) -> &str {
        self.document.text()
    }

    /// 0 as opened, and one more for every change, undo and redo.
    pub fn revision(&self) -> u64 {
        self.revision
    }

    /// The revision last written to disk.
    pub fn saved_revision(&self) -> u64 {
        self.saved_revision
    }

    pub fn is_dirty(&self) -> bool {
        self.revision != self.saved_revision
    }

    /// Records that the document as it is now has been saved.
    pub fn mark_saved(&mut self) {
        self.saved_revision = self.revision;
    }

    /// The revision a file edited outside the studio last produced, if any. A save or a later change
    /// does not clear it: it says where in the history the outside edit sits.
    pub fn outside_revision(&self) -> Option<u64> {
        self.outside_revision
    }

    /// Who holds the writer seat, by the name they gave.
    pub fn writer(&self) -> Option<&str> {
        self.writer.as_ref().map(|(_, name)| name.as_str())
    }

    /// Takes the writer seat. There is one writer at a time; a second claim is refused.
    pub fn claim_writer(&mut self, name: impl Into<String>) -> Result<WriterToken, SessionError> {
        if let Some((_, holder)) = &self.writer {
            return Err(SessionError::WriterBusy {
                holder: holder.clone(),
            });
        }
        self.claims += 1;
        self.writer = Some((self.claims, name.into()));
        Ok(WriterToken {
            session: self.id,
            claim: self.claims,
        })
    }

    /// Gives the writer seat back.
    pub fn release_writer(&mut self, token: WriterToken) -> Result<(), SessionError> {
        self.check_writer(&token)?;
        self.writer = None;
        Ok(())
    }

    fn check_writer(&self, token: &WriterToken) -> Result<(), SessionError> {
        match &self.writer {
            Some((claim, _)) if token.session == self.id && token.claim == *claim => Ok(()),
            _ => Err(SessionError::NotWriter),
        }
    }

    fn check_revision(&self, requested: u64) -> Result<(), SessionError> {
        if requested == self.revision {
            Ok(())
        } else {
            Err(SessionError::StaleRevision {
                requested,
                current: self.revision,
            })
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    /// The step Undo would undo, for the menu ("Undo Paint tiles").
    pub fn undo_step(&self) -> Option<StepInfo> {
        self.undo.last().map(Step::info)
    }

    /// The step Redo would redo.
    pub fn redo_step(&self) -> Option<StepInfo> {
        self.redo.last().map(Step::info)
    }

    pub fn undo_depth(&self) -> usize {
        self.undo.len()
    }

    /// Closes the last step to merging, so what comes next starts a new one (a stroke has ended).
    pub fn end_step(&mut self, writer: &WriterToken) -> Result<(), SessionError> {
        self.check_writer(writer)?;
        self.open_step = false;
        Ok(())
    }

    /// Applies a request. A refusal (stale revision, not the writer, the document's own) changes
    /// nothing, not even the revision. An intent that changes no text returns a patch with no edits and
    /// leaves the revision alone.
    pub fn apply(
        &mut self,
        writer: &WriterToken,
        request: Request<D::Intent>,
    ) -> Result<Patch, SessionError> {
        self.check_writer(writer)?;
        self.check_revision(request.base_revision)?;
        let before = (!self.locks.is_empty()).then(|| self.document.text().to_string());
        let edits = self.document.apply(&request.intent)?;
        if let Some(before) = before {
            let touched = self.locked_between(&before, self.document.text());
            if !touched.is_empty() {
                self.revert(edits.iter().rev().map(Edit::inverse));
                return Err(SessionError::Locked { layers: touched });
            }
        }
        if edits.is_empty() {
            return Ok(Patch {
                revision: self.revision,
                edits,
                author: request.author,
                edited_outside: false,
            });
        }
        let merges = request.merge_key.is_some()
            && self.open_step
            && self.undo.last().is_some_and(|last| {
                last.merge_key == request.merge_key && last.author == request.author
            });
        if merges {
            if let Some(last) = self.undo.last_mut() {
                last.edits.extend(edits.iter().cloned());
                // The step says what the run did so far, not what its first request did.
                last.name = request.name;
            }
        } else {
            self.push_step(Step {
                name: request.name,
                author: request.author,
                merge_key: request.merge_key,
                edits: edits.clone(),
            });
        }
        self.redo.clear();
        self.open_step = true;
        self.revision += 1;
        Ok(Patch {
            revision: self.revision,
            edits,
            author: request.author,
            edited_outside: false,
        })
    }

    /// Brings in the text of a file that changed on disk with no unsaved changes (or the merged text
    /// of one that did). The change is one undoable step, marked as an outside edit, and the revision
    /// it makes is remembered by [`Session::outside_revision`].
    pub fn apply_outside_edit(
        &mut self,
        writer: &WriterToken,
        base_revision: u64,
        new_text: &str,
    ) -> Result<Patch, SessionError> {
        self.check_writer(writer)?;
        self.check_revision(base_revision)?;
        let removed = self.document.text().to_string();
        if removed == new_text {
            return Ok(Patch {
                revision: self.revision,
                edits: Vec::new(),
                author: Author::Outside,
                edited_outside: true,
            });
        }
        let touched = self.locked_between(&removed, new_text);
        if !touched.is_empty() {
            return Err(SessionError::Locked { layers: touched });
        }
        self.document.replace(0, removed.len(), new_text)?;
        let edit = Edit {
            start: 0,
            removed,
            inserted: new_text.to_string(),
        };
        self.push_step(Step {
            name: OUTSIDE_STEP_NAME.to_string(),
            author: Author::Outside,
            merge_key: None,
            edits: vec![edit.clone()],
        });
        self.redo.clear();
        self.open_step = false;
        self.revision += 1;
        self.outside_revision = Some(self.revision);
        Ok(Patch {
            revision: self.revision,
            edits: vec![edit],
            author: Author::Outside,
            edited_outside: true,
        })
    }

    /// Undoes the last step, however many small requests it merged. The text comes back byte for byte.
    pub fn undo(
        &mut self,
        writer: &WriterToken,
        base_revision: u64,
    ) -> Result<Patch, SessionError> {
        self.check_writer(writer)?;
        self.check_revision(base_revision)?;
        let step = self.undo.pop().ok_or(SessionError::NothingToUndo)?;
        let before = self.document.text().to_string();
        let mut applied = Vec::with_capacity(step.edits.len());
        for edit in step.edits.iter().rev() {
            let inverse = edit.inverse();
            if let Err(error) = self.document.replace(
                inverse.start,
                inverse.start + inverse.removed.len(),
                &inverse.inserted,
            ) {
                // Put the document back before reporting, so a refusal changes nothing.
                for done in applied.iter().rev() {
                    let back: &Edit = done;
                    let _ = self.document.replace(
                        back.start,
                        back.start + back.inserted.len(),
                        &back.removed,
                    );
                }
                self.undo.push(step);
                return Err(error.into());
            }
            applied.push(inverse);
        }
        let touched = self.locked_between(&before, self.document.text());
        if !touched.is_empty() {
            self.revert(applied.iter().rev().map(Edit::inverse));
            self.undo.push(step);
            return Err(SessionError::Locked { layers: touched });
        }
        let author = step.author;
        self.redo.push(step);
        self.open_step = false;
        self.revision += 1;
        Ok(Patch {
            revision: self.revision,
            edits: applied,
            author,
            edited_outside: false,
        })
    }

    /// Redoes the last undone step.
    pub fn redo(
        &mut self,
        writer: &WriterToken,
        base_revision: u64,
    ) -> Result<Patch, SessionError> {
        self.check_writer(writer)?;
        self.check_revision(base_revision)?;
        let step = self.redo.pop().ok_or(SessionError::NothingToRedo)?;
        let before = self.document.text().to_string();
        let mut applied: Vec<&Edit> = Vec::with_capacity(step.edits.len());
        for edit in &step.edits {
            if let Err(error) = self
                .document
                .replace(edit.start, edit.end(), &edit.inserted)
            {
                for done in applied.iter().rev() {
                    let _ = self.document.replace(
                        done.start,
                        done.start + done.inserted.len(),
                        &done.removed,
                    );
                }
                self.redo.push(step);
                return Err(error.into());
            }
            applied.push(edit);
        }
        let touched = self.locked_between(&before, self.document.text());
        if !touched.is_empty() {
            self.revert(applied.iter().rev().map(|edit| edit.inverse()));
            self.redo.push(step);
            return Err(SessionError::Locked { layers: touched });
        }
        let edits = step.edits.clone();
        let author = step.author;
        self.undo.push(step);
        self.open_step = false;
        self.revision += 1;
        Ok(Patch {
            revision: self.revision,
            edits,
            author,
            edited_outside: false,
        })
    }

    /// Puts the document back by applying `edits`, each against the text the one before left. Used
    /// after a change turns out to touch a locked layer, so a refusal changes nothing.
    fn revert(&mut self, edits: impl Iterator<Item = Edit>) {
        for edit in edits {
            let _ =
                self.document
                    .replace(edit.start, edit.start + edit.removed.len(), &edit.inserted);
        }
    }

    fn push_step(&mut self, step: Step) {
        self.undo.push(step);
        if self.undo.len() > UNDO_DEPTH {
            self.undo.remove(0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::{PlainText, PlainTextIntent};
    use crate::error::DocumentError;

    fn open(text: &str) -> (Session<PlainText>, WriterToken) {
        let mut session = Session::new(PlainText::new(text));
        let token = session.claim_writer("test").unwrap();
        (session, token)
    }

    fn insert(session: &Session<PlainText>, at: usize, text: &str) -> Request<PlainTextIntent> {
        Request::new(
            session.revision(),
            "Type",
            PlainTextIntent::insert(at, text),
        )
    }

    #[test]
    fn every_change_bumps_the_revision_and_returns_a_patch() {
        let (mut s, w) = open("hello");
        assert_eq!(s.revision(), 0);
        let request = insert(&s, 5, " there");
        let patch = s.apply(&w, request).unwrap();
        assert_eq!(patch.revision, 1);
        assert_eq!(patch.edits.len(), 1);
        assert_eq!(patch.edits[0].start, 5);
        assert_eq!(patch.edits[0].inserted, " there");
        assert_eq!(s.text(), "hello there");
        let request = insert(&s, 0, ">");
        assert_eq!(s.apply(&w, request).unwrap().revision, 2);
    }

    #[test]
    fn a_no_op_intent_leaves_the_revision_alone() {
        let (mut s, w) = open("hello");
        let request = Request::new(0, "Nothing", PlainTextIntent::replace(0, 5, "hello"));
        let patch = s.apply(&w, request).unwrap();
        assert!(patch.edits.is_empty());
        assert_eq!(s.revision(), 0);
        assert!(!s.can_undo());
    }

    #[test]
    fn saved_revision_tracks_dirty() {
        let (mut s, w) = open("a");
        assert!(!s.is_dirty());
        let request = insert(&s, 1, "b");
        s.apply(&w, request).unwrap();
        assert!(s.is_dirty());
        s.mark_saved();
        assert_eq!(s.saved_revision(), 1);
        assert!(!s.is_dirty());
        s.undo(&w, 1).unwrap();
        assert!(s.is_dirty());
        assert_eq!(s.saved_revision(), 1);
    }

    #[test]
    fn a_recovered_session_is_dirty_from_the_start() {
        let s = Session::recovered(PlainText::new("x"));
        assert!(s.is_dirty());
    }

    #[test]
    fn a_second_writer_is_refused_until_the_first_lets_go() {
        let (mut s, w) = open("a");
        let error = s.claim_writer("claude").unwrap_err();
        assert_eq!(
            error,
            SessionError::WriterBusy {
                holder: "test".to_string()
            }
        );
        assert_eq!(s.writer(), Some("test"));
        s.release_writer(w).unwrap();
        let second = s.claim_writer("claude").unwrap();
        assert_eq!(s.writer(), Some("claude"));
        s.release_writer(second).unwrap();
        assert_eq!(s.writer(), None);
    }

    #[test]
    fn a_released_token_cannot_write() {
        let (mut s, w) = open("a");
        let stale = WriterToken {
            session: w.session,
            claim: w.claim,
        };
        s.release_writer(w).unwrap();
        let request = insert(&s, 0, "x");
        assert_eq!(
            s.apply(&stale, request).unwrap_err(),
            SessionError::NotWriter
        );
        // A new claim is a different seat even though the old token has the same session.
        let _new = s.claim_writer("again").unwrap();
        let request = insert(&s, 0, "x");
        assert_eq!(
            s.apply(&stale, request).unwrap_err(),
            SessionError::NotWriter
        );
        assert_eq!(s.text(), "a");
    }

    #[test]
    fn a_token_from_another_session_cannot_write() {
        let (mut a, _wa) = open("a");
        let (_b, wb) = open("b");
        let request = insert(&a, 0, "x");
        assert_eq!(a.apply(&wb, request).unwrap_err(), SessionError::NotWriter);
    }

    #[test]
    fn a_stale_revision_is_refused_and_changes_nothing() {
        let (mut s, w) = open("abc");
        let old = insert(&s, 0, "1");
        let current = insert(&s, 3, "2");
        s.apply(&w, current).unwrap();
        let error = s.apply(&w, old).unwrap_err();
        assert_eq!(
            error,
            SessionError::StaleRevision {
                requested: 0,
                current: 1
            }
        );
        assert_eq!(s.text(), "abc2");
        assert_eq!(s.revision(), 1);
        assert_eq!(s.undo_depth(), 1);
        assert!(matches!(
            s.undo(&w, 0),
            Err(SessionError::StaleRevision { .. })
        ));
    }

    #[test]
    fn a_document_refusal_changes_nothing() {
        let (mut s, w) = open("abc");
        let request = Request::new(0, "Bad", PlainTextIntent::delete(2, 99));
        assert!(matches!(
            s.apply(&w, request),
            Err(SessionError::Document(_))
        ));
        assert_eq!(s.revision(), 0);
        assert_eq!(s.text(), "abc");
    }

    #[test]
    fn undo_and_redo_are_named_and_move_the_revision_forward() {
        let (mut s, w) = open("a");
        let request = Request::new(0, "Add b", PlainTextIntent::insert(1, "b"));
        s.apply(&w, request).unwrap();
        let request = Request::new(1, "Add c", PlainTextIntent::insert(2, "c"));
        s.apply(&w, request).unwrap();
        assert_eq!(s.undo_step().unwrap().name, "Add c");
        let patch = s.undo(&w, 2).unwrap();
        assert_eq!(patch.revision, 3);
        assert_eq!(s.text(), "ab");
        assert_eq!(s.undo_step().unwrap().name, "Add b");
        assert_eq!(s.redo_step().unwrap().name, "Add c");
        let patch = s.redo(&w, 3).unwrap();
        assert_eq!(patch.revision, 4);
        assert_eq!(s.text(), "abc");
        assert!(!s.can_redo());
    }

    #[test]
    fn nothing_to_undo_or_redo_is_reported() {
        let (mut s, w) = open("a");
        assert_eq!(s.undo(&w, 0).unwrap_err(), SessionError::NothingToUndo);
        assert_eq!(s.redo(&w, 0).unwrap_err(), SessionError::NothingToRedo);
        assert_eq!(s.revision(), 0);
    }

    #[test]
    fn a_new_change_clears_redo() {
        let (mut s, w) = open("a");
        let request = insert(&s, 1, "b");
        s.apply(&w, request).unwrap();
        s.undo(&w, 1).unwrap();
        assert!(s.can_redo());
        let request = insert(&s, 1, "z");
        s.apply(&w, request).unwrap();
        assert!(!s.can_redo());
    }

    #[test]
    fn a_stroke_of_many_intents_is_one_step_and_undoes_to_identical_text() {
        let original = "grass 😀 line\nsecond line\n";
        let (mut s, w) = open(original);
        for ch in ["a", "b", "😀", "d"] {
            let request = Request::new(s.revision(), "Paint tiles", PlainTextIntent::insert(0, ch))
                .merging("paint");
            s.apply(&w, request).unwrap();
        }
        // A delete in the same stroke, over a multi-byte character.
        let request = Request::new(s.revision(), "Paint tiles", PlainTextIntent::delete(0, 1))
            .merging("paint");
        s.apply(&w, request).unwrap();
        assert_eq!(s.undo_depth(), 1);
        assert_eq!(s.revision(), 5);
        assert_ne!(s.text(), original);
        let patch = s.undo(&w, 5).unwrap();
        assert_eq!(patch.edits.len(), 5);
        assert_eq!(s.text().as_bytes(), original.as_bytes());
        // And forward again.
        s.redo(&w, 6).unwrap();
        assert_ne!(s.text(), original);
        s.undo(&w, 7).unwrap();
        assert_eq!(s.text().as_bytes(), original.as_bytes());
    }

    #[test]
    fn different_keys_or_no_key_start_new_steps() {
        let (mut s, w) = open("");
        let mk = |s: &Session<PlainText>, key: Option<&str>| {
            let r = insert(s, 0, "x");
            match key {
                Some(k) => r.merging(k),
                None => r,
            }
        };
        let r = mk(&s, Some("a"));
        s.apply(&w, r).unwrap();
        let r = mk(&s, Some("b"));
        s.apply(&w, r).unwrap();
        let r = mk(&s, None);
        s.apply(&w, r).unwrap();
        let r = mk(&s, None);
        s.apply(&w, r).unwrap();
        assert_eq!(s.undo_depth(), 4);
    }

    #[test]
    fn end_step_and_undo_close_a_stroke() {
        let (mut s, w) = open("");
        let r = insert(&s, 0, "a").merging("k");
        s.apply(&w, r).unwrap();
        s.end_step(&w).unwrap();
        let r = insert(&s, 0, "b").merging("k");
        s.apply(&w, r).unwrap();
        assert_eq!(s.undo_depth(), 2);
        s.undo(&w, 2).unwrap();
        let r = insert(&s, 0, "c").merging("k");
        s.apply(&w, r).unwrap();
        // Not merged into the step before the undo.
        assert_eq!(s.undo_depth(), 2);
    }

    #[test]
    fn a_merged_step_takes_the_name_of_the_latest_request() {
        let (mut s, w) = open("");
        let r = Request::new(
            s.revision(),
            "Move a to 1",
            PlainTextIntent::replace(0, 0, "a"),
        )
        .merging("k");
        s.apply(&w, r).unwrap();
        let r = Request::new(
            s.revision(),
            "Move a to 2",
            PlainTextIntent::replace(0, 1, "b"),
        )
        .merging("k");
        s.apply(&w, r).unwrap();
        assert_eq!(s.undo_depth(), 1);
        assert_eq!(s.undo_step().unwrap().name, "Move a to 2");
        s.undo(&w, 2).unwrap();
        assert_eq!(s.text(), "");
        assert_eq!(s.redo_step().unwrap().name, "Move a to 2");
    }

    #[test]
    fn claudes_steps_are_marked_and_do_not_merge_with_the_persons() {
        let (mut s, w) = open("");
        let r = insert(&s, 0, "a").merging("k");
        s.apply(&w, r).unwrap();
        let r = insert(&s, 0, "b").merging("k").by(Author::Claude);
        let patch = s.apply(&w, r).unwrap();
        assert_eq!(patch.author, Author::Claude);
        assert_eq!(s.undo_depth(), 2);
        assert_eq!(s.undo_step().unwrap().author, Author::Claude);
        s.undo(&w, 2).unwrap();
        assert_eq!(s.redo_step().unwrap().author, Author::Claude);
        assert_eq!(s.undo_step().unwrap().author, Author::Person);
    }

    #[test]
    fn history_is_limited() {
        let (mut s, w) = open("");
        for _ in 0..UNDO_DEPTH + 10 {
            let r = insert(&s, 0, "x");
            s.apply(&w, r).unwrap();
        }
        assert_eq!(s.undo_depth(), UNDO_DEPTH);
    }

    #[test]
    fn an_outside_edit_is_marked_and_undoable() {
        let (mut s, w) = open("one\ntwo\n");
        let patch = s.apply_outside_edit(&w, 0, "one\n2\n").unwrap();
        assert!(patch.edited_outside);
        assert_eq!(patch.author, Author::Outside);
        assert_eq!(patch.revision, 1);
        assert_eq!(s.outside_revision(), Some(1));
        assert_eq!(s.undo_step().unwrap().name, OUTSIDE_STEP_NAME);
        assert_eq!(s.text(), "one\n2\n");
        s.undo(&w, 1).unwrap();
        assert_eq!(s.text(), "one\ntwo\n");
    }

    #[test]
    fn an_outside_edit_needs_the_writer_and_the_current_revision() {
        let (mut s, w) = open("a");
        assert!(matches!(
            s.apply_outside_edit(&w, 5, "b"),
            Err(SessionError::StaleRevision { .. })
        ));
        s.release_writer(w).unwrap();
        let (_, other) = open("z");
        assert_eq!(
            s.apply_outside_edit(&other, 0, "b").unwrap_err(),
            SessionError::NotWriter
        );
    }

    #[test]
    fn debug_never_shows_the_text() {
        let secret = "the secret level layout 7f3a";
        let (mut s, w) = open(secret);
        let r = insert(&s, 0, "another secret phrase 91bc");
        let patch = s.apply(&w, r).unwrap();
        let debug = format!("{s:?}");
        assert!(debug.contains("revision"));
        assert!(!debug.contains("secret"));
        assert!(!format!("{:?}", s.document()).contains("secret"));
        assert!(!format!("{patch:?}").contains("secret"));
        assert!(!format!("{:?}", patch.edits[0]).contains("secret"));
        let request = Request::new(1, "x", PlainTextIntent::insert(0, "hidden words"));
        assert!(!format!("{request:?}").contains("hidden"));
    }

    // Locks: a document whose lines start `a:` or `b:` belongs to the layer of that letter.

    struct Layered(PlainText);

    impl Document for Layered {
        type Intent = PlainTextIntent;
        fn text(&self) -> &str {
            self.0.text()
        }
        fn apply(&mut self, intent: &PlainTextIntent) -> Result<Vec<Edit>, DocumentError> {
            self.0.apply(intent)
        }
        fn replace(&mut self, start: usize, end: usize, with: &str) -> Result<(), DocumentError> {
            self.0.replace(start, end, with)
        }
        fn layers_changed(&self, old: &str, new: &str) -> Vec<String> {
            let lines = |text: &str| -> Vec<String> { text.lines().map(str::to_owned).collect() };
            let (old, new) = (lines(old), lines(new));
            let mut touched: Vec<String> = Vec::new();
            for line in old
                .iter()
                .filter(|l| !new.contains(l))
                .chain(new.iter().filter(|l| !old.contains(l)))
            {
                if let Some(layer) = line.get(..1).filter(|_| line.get(1..2) == Some(":")) {
                    if !touched.iter().any(|t| t == layer) {
                        touched.push(layer.to_owned());
                    }
                }
            }
            touched.sort();
            touched
        }
    }

    fn open_layered(text: &str, locks: &[&str]) -> (Session<Layered>, WriterToken) {
        let mut session = Session::new(Layered(PlainText::new(text)));
        session.set_locks(locks.iter().map(|l| (*l).to_owned()));
        let token = session.claim_writer("test").unwrap();
        (session, token)
    }

    fn type_at(session: &Session<Layered>, at: usize, text: &str) -> Request<PlainTextIntent> {
        Request::new(
            session.revision(),
            "Type",
            PlainTextIntent::insert(at, text),
        )
    }

    #[test]
    fn a_change_to_a_locked_layer_is_refused_and_changes_nothing() {
        let (mut s, w) = open_layered("a:one\nb:two\n", &["a"]);
        let request = type_at(&s, 0, "a:new\n");
        let error = s.apply(&w, request).unwrap_err();
        assert_eq!(
            error,
            SessionError::Locked {
                layers: vec!["a".into()]
            }
        );
        assert_eq!(s.text(), "a:one\nb:two\n");
        assert_eq!(s.revision(), 0);
        assert!(!s.can_undo());
    }

    #[test]
    fn a_change_to_another_layer_goes_through_and_names_every_locked_layer_it_touches() {
        let (mut s, w) = open_layered("a:one\nb:two\n", &["a", "b"]);
        let request = type_at(&s, 0, "c:free\n");
        assert!(s.apply(&w, request).is_ok());
        let request = type_at(&s, 0, "b:x\na:y\n");
        let error = s.apply(&w, request).unwrap_err();
        assert_eq!(
            error,
            SessionError::Locked {
                layers: vec!["a".into(), "b".into()]
            }
        );
        assert_eq!(s.revision(), 1);
    }

    #[test]
    fn undo_and_redo_across_a_lock_are_refused_and_keep_their_steps() {
        let (mut s, w) = open_layered("b:two\n", &[]);
        let request = type_at(&s, 0, "a:one\n");
        s.apply(&w, request).unwrap();
        s.set_locks(["a".to_owned()]);
        let error = s.undo(&w, 1).unwrap_err();
        assert_eq!(
            error,
            SessionError::Locked {
                layers: vec!["a".into()]
            }
        );
        assert_eq!(s.text(), "a:one\nb:two\n");
        assert_eq!(s.revision(), 1);
        assert!(s.can_undo() && !s.can_redo());
        s.set_locks([]);
        s.undo(&w, 1).unwrap();
        assert_eq!(s.text(), "b:two\n");
        s.set_locks(["a".to_owned()]);
        let error = s.redo(&w, 2).unwrap_err();
        assert_eq!(
            error,
            SessionError::Locked {
                layers: vec!["a".into()]
            }
        );
        assert_eq!(s.text(), "b:two\n");
        assert!(s.can_redo() && !s.can_undo());
        s.set_locks([]);
        s.redo(&w, 2).unwrap();
        assert_eq!(s.text(), "a:one\nb:two\n");
    }

    #[test]
    fn an_outside_edit_to_a_locked_layer_is_refused_whole() {
        let (mut s, w) = open_layered("a:one\nb:two\n", &["a"]);
        let error = s
            .apply_outside_edit(&w, 0, "a:changed\nb:two\n")
            .unwrap_err();
        assert_eq!(
            error,
            SessionError::Locked {
                layers: vec!["a".into()]
            }
        );
        assert_eq!(s.text(), "a:one\nb:two\n");
        assert!(s.outside_revision().is_none());
        assert!(s.apply_outside_edit(&w, 0, "a:one\nb:three\n").is_ok());
    }

    #[test]
    fn a_document_with_no_layers_is_never_locked() {
        let (mut s, w) = open("hello");
        s.set_locks(["a".to_owned()]);
        let request = insert(&s, 5, "!");
        assert!(s.apply(&w, request).is_ok());
        assert_eq!(s.locks().len(), 1);
    }
}
