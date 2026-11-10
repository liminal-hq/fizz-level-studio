// The errors a document and a session can report, none of which carry the document's text
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use thiserror::Error;

/// Why a document refused an intent or an edit. A refusal changes nothing.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum DocumentError {
    /// The range is backwards or past the end of the text.
    #[error("the range {start}..{end} is outside the document")]
    OutOfRange { start: usize, end: usize },
    /// An end of the range falls inside a character.
    #[error("the offset {offset} is not on a character boundary")]
    NotOnBoundary { offset: usize },
    /// The document could not make sense of the intent.
    #[error("the intent was refused: {0}")]
    Refused(String),
    /// The intent names something at a line that is no longer there: the text changed since the
    /// caller read it.
    #[error("what the intent names is no longer at line {line}")]
    Gone { line: u32 },
}

/// Why a session refused a request. A refusal changes nothing, not even the revision.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum SessionError {
    /// Someone else is the writer; the name is the holder's.
    #[error("the document already has a writer: {holder}")]
    WriterBusy { holder: String },
    /// The token is not the current writer's (released, or from another claim).
    #[error("this writer does not hold the document")]
    NotWriter,
    /// The request was computed against a revision that is no longer current.
    #[error("the request was computed for revision {requested}, but the document is at {current}")]
    StaleRevision { requested: u64, current: u64 },
    /// There is nothing to undo.
    #[error("there is nothing to undo")]
    NothingToUndo,
    /// There is nothing to redo.
    #[error("there is nothing to redo")]
    NothingToRedo,
    /// The change would alter a locked layer, so nothing was changed. The ids are the locked layers
    /// it touches, in the document's order.
    #[error("the change touches locked layers: {}", .layers.join(", "))]
    Locked { layers: Vec<String> },
    /// The document refused the intent.
    #[error(transparent)]
    Document(#[from] DocumentError),
}
