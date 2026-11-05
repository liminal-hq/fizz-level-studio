// A level of either game: opened by its script line, edited through one document type
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{LevelEdit, LevelTarget, LevelView};
use fizz_studio_session::{Document, DocumentError, Edit};

use crate::{Fizz2LevelDocument, LevelDocument};

/// The message key the canvas shows above a Fizz 2 level until the game's own drawing exists.
pub const FLAT_FALLBACK_BANNER: &str = "level.flatFallback";

/// A Fizz 1 or a Fizz 2 level.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnyLevelDocument {
    Fizz1(LevelDocument),
    Fizz2(Fizz2LevelDocument),
}

/// Whether the text's `script` line names `fizz2`.
fn is_fizz2(text: &str) -> bool {
    text.lines()
        .map(str::trim)
        .find(|l| l.split_whitespace().next() == Some("script"))
        .and_then(|l| l.split_whitespace().nth(1))
        .is_some_and(|name| name == "fizz2")
}

/// Picks the document for a level's text: Fizz 2 when the `script` line says `fizz2`, Fizz 1
/// otherwise.
pub fn open_level_text(text: impl Into<String>) -> AnyLevelDocument {
    let text = text.into();
    if is_fizz2(&text) {
        AnyLevelDocument::Fizz2(Fizz2LevelDocument::new(text))
    } else {
        AnyLevelDocument::Fizz1(LevelDocument::new(text))
    }
}

impl AnyLevelDocument {
    pub fn target(&self) -> LevelTarget {
        match self {
            Self::Fizz1(_) => LevelTarget::Fizz1,
            Self::Fizz2(_) => LevelTarget::Fizz2,
        }
    }

    /// The message key shown above the grid, when there is one.
    pub fn banner(&self) -> Option<String> {
        match self {
            Self::Fizz1(_) => None,
            Self::Fizz2(_) => Some(FLAT_FALLBACK_BANNER.to_string()),
        }
    }

    pub fn view(&self) -> LevelView {
        match self {
            Self::Fizz1(d) => d.view(),
            Self::Fizz2(d) => d.view(),
        }
    }

    /// The script line that last changed the cell. Only a Fizz 1 level answers; a Fizz 2 level is
    /// drawn flat until the game's own view exists.
    pub fn cell_line(&self, x: i64, y: i64) -> Option<u32> {
        match self {
            Self::Fizz1(d) => d.cell_line(x, y),
            Self::Fizz2(_) => None,
        }
    }
}

impl Document for AnyLevelDocument {
    type Intent = LevelEdit;

    fn text(&self) -> &str {
        match self {
            Self::Fizz1(d) => d.text(),
            Self::Fizz2(d) => d.text(),
        }
    }

    fn apply(&mut self, intent: &LevelEdit) -> Result<Vec<Edit>, DocumentError> {
        match self {
            Self::Fizz1(d) => d.apply(intent),
            Self::Fizz2(d) => d.apply(intent),
        }
    }

    fn replace(&mut self, start: usize, end: usize, with: &str) -> Result<(), DocumentError> {
        match self {
            Self::Fizz1(d) => d.replace(start, end, with),
            Self::Fizz2(d) => d.replace(start, end, with),
        }
    }
}
