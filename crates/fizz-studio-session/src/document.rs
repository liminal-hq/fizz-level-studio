// The document a session owns, and a plain-text one for tests
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::error::DocumentError;

/// One change to the text: `removed` was at `start`, and `inserted` took its place.
///
/// Offsets are byte offsets on character boundaries. Holding both sides is what lets the session undo
/// an edit without keeping a copy of the whole document.
#[derive(Clone, PartialEq, Eq)]
pub struct Edit {
    pub start: usize,
    pub removed: String,
    pub inserted: String,
}

impl Edit {
    /// The end of the replaced range in the text before the edit.
    pub fn end(&self) -> usize {
        self.start + self.removed.len()
    }

    /// The edit that puts the text back.
    pub fn inverse(&self) -> Edit {
        Edit {
            start: self.start,
            removed: self.inserted.clone(),
            inserted: self.removed.clone(),
        }
    }
}

// Edits hold the document's text, so they only ever show their sizes.
impl std::fmt::Debug for Edit {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Edit")
            .field("start", &self.start)
            .field("removed_len", &self.removed.len())
            .field("inserted_len", &self.inserted.len())
            .finish()
    }
}

/// What a session needs from a document. The real Fizz 1 document will implement this; [`PlainText`]
/// stands in until it exists.
pub trait Document {
    /// What a caller asks of the document.
    type Intent;

    /// The whole text, which is the source.
    fn text(&self) -> &str;

    /// Applies an intent and returns the edits it made, in the order they were made, each against the
    /// text left by the one before. A refusal must leave the document untouched.
    fn apply(&mut self, intent: &Self::Intent) -> Result<Vec<Edit>, DocumentError>;

    /// Replaces the byte range `start..end` with `with`. The session uses this to undo, redo and
    /// bring in an outside edit.
    fn replace(&mut self, start: usize, end: usize, with: &str) -> Result<(), DocumentError>;
}

/// An intent on a [`PlainText`] document: replace a range with some text.
#[derive(Clone, PartialEq, Eq)]
pub struct PlainTextIntent {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

impl PlainTextIntent {
    pub fn replace(start: usize, end: usize, text: impl Into<String>) -> Self {
        Self {
            start,
            end,
            text: text.into(),
        }
    }

    pub fn insert(at: usize, text: impl Into<String>) -> Self {
        Self::replace(at, at, text)
    }

    pub fn delete(start: usize, end: usize) -> Self {
        Self::replace(start, end, "")
    }
}

impl std::fmt::Debug for PlainTextIntent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PlainTextIntent")
            .field("start", &self.start)
            .field("end", &self.end)
            .field("text_len", &self.text.len())
            .finish()
    }
}

/// A document that is only text, with one intent: replace a range.
#[derive(Clone, PartialEq, Eq, Default)]
pub struct PlainText {
    text: String,
}

impl PlainText {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }

    fn check(&self, start: usize, end: usize) -> Result<(), DocumentError> {
        if start > end || end > self.text.len() {
            return Err(DocumentError::OutOfRange { start, end });
        }
        for offset in [start, end] {
            if !self.text.is_char_boundary(offset) {
                return Err(DocumentError::NotOnBoundary { offset });
            }
        }
        Ok(())
    }
}

impl std::fmt::Debug for PlainText {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PlainText")
            .field("len", &self.text.len())
            .finish()
    }
}

impl Document for PlainText {
    type Intent = PlainTextIntent;

    fn text(&self) -> &str {
        &self.text
    }

    fn apply(&mut self, intent: &PlainTextIntent) -> Result<Vec<Edit>, DocumentError> {
        self.check(intent.start, intent.end)?;
        let removed = self.text[intent.start..intent.end].to_string();
        if removed == intent.text {
            return Ok(Vec::new());
        }
        self.text
            .replace_range(intent.start..intent.end, &intent.text);
        Ok(vec![Edit {
            start: intent.start,
            removed,
            inserted: intent.text.clone(),
        }])
    }

    fn replace(&mut self, start: usize, end: usize, with: &str) -> Result<(), DocumentError> {
        self.check(start, end)?;
        self.text.replace_range(start..end, with);
        Ok(())
    }
}
