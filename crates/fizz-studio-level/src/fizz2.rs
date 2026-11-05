// The Fizz 2 level document: paints rewrite only the touched map rows, through the provisional dialect
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_dialect::stub::ProvisionalDialect;
use fizz_studio_dialect::{Fizz2Document, Fizz2Syntax, MapError};
use fizz_studio_profile::stub::ProvisionalProfiles;
use fizz_studio_profile::{Profile, ProfileSource};
use fizz_studio_protocol::{CellRange, LevelEdit};
use fizz_studio_session::{Document, DocumentError, Edit};

use crate::document::{minimal_edit, refuse};

/// The profile a Fizz 2 level uses unless its world names another.
pub const DEFAULT_PROFILE: &str = "ep2";

/// A Fizz 2 level as text, edited in the flat fallback (the map only; objects arrive with M2).
#[derive(Clone, PartialEq, Eq)]
pub struct Fizz2LevelDocument {
    text: String,
    pub(crate) profile: Profile,
}

// The text is the person's work, so Debug shows its size only.
impl std::fmt::Debug for Fizz2LevelDocument {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Fizz2LevelDocument")
            .field("profile", &self.profile.id)
            .field("len", &self.text.len())
            .finish()
    }
}

impl Fizz2LevelDocument {
    /// A level against the default profile, `ep2`.
    pub fn new(text: impl Into<String>) -> Self {
        Self::with_profile(text, DEFAULT_PROFILE).expect("the default profile exists")
    }

    /// A level against the profile with this id, or `None` when there is no such profile.
    pub fn with_profile(text: impl Into<String>, profile_id: &str) -> Option<Self> {
        let profile = ProvisionalProfiles::new().profile(profile_id)?.clone();
        Some(Self {
            text: text.into(),
            profile,
        })
    }

    /// The id of the profile the level is read against.
    pub fn profile_id(&self) -> &str {
        &self.profile.id
    }

    /// The map letter for a tile name, in any case.
    fn letter(&self, tile: &str) -> Result<char, DocumentError> {
        self.profile
            .legend
            .iter()
            .find(|e| e.tile.eq_ignore_ascii_case(tile))
            .map(|e| e.letter)
            .ok_or_else(|| refuse(format!("`{tile}` is not a tile")))
    }

    fn paint(
        &mut self,
        letter: char,
        x: &[CellRange],
        y: &[CellRange],
    ) -> Result<Vec<Edit>, DocumentError> {
        let mut document = ProvisionalDialect.parse(&self.text, &self.profile).document;
        let rows = document.map_rows();
        if rows.is_empty() {
            return Err(refuse("the level has no map to paint on"));
        }
        let (width, height) = (rows[0].chars().count(), rows.len());
        let xs = cells("x", x, width)?;
        let ys = cells("y", y, height)?;
        // Work on the parsed copy, so a refusal part-way leaves the text untouched.
        for &yy in &ys {
            for &xx in &xs {
                document
                    .set_cell(xx, yy, letter, &self.profile)
                    .map_err(|e| match e {
                        MapError::NoMap => refuse("the level has no map to paint on"),
                        MapError::OutOfRange => {
                            refuse(format!("the cell {xx},{yy} is outside the map"))
                        }
                        MapError::UnknownLetter(c) => refuse(format!("`{c}` is not in the legend")),
                    })?;
            }
        }
        let next = document.print();
        let change = minimal_edit(&self.text, &next);
        self.text = next;
        Ok(change.into_iter().collect())
    }
}

/// The cells named by ranges that are not empty, ordered, and inside `0..limit`.
fn cells(axis: &str, given: &[CellRange], limit: usize) -> Result<Vec<usize>, DocumentError> {
    if given.is_empty() {
        return Err(refuse(format!("no {axis} range was given")));
    }
    let mut out = Vec::new();
    for &[from, to] in given {
        if from > to {
            return Err(refuse(format!(
                "the {axis} range {from} to {to} is backwards"
            )));
        }
        if to as usize >= limit {
            return Err(refuse(format!(
                "the {axis} range {from} to {to} is outside the map ({limit} cells on that axis)"
            )));
        }
        out.extend(from as usize..=to as usize);
    }
    Ok(out)
}

impl Document for Fizz2LevelDocument {
    type Intent = LevelEdit;

    fn text(&self) -> &str {
        &self.text
    }

    fn apply(&mut self, intent: &LevelEdit) -> Result<Vec<Edit>, DocumentError> {
        match intent {
			LevelEdit::Paint { tile, x, y } => {
				let letter = self.letter(tile)?;
				self.paint(letter, x, y)
			}
			LevelEdit::Clear { x, y } => {
				let letter = self.letter("EMPTY")?;
				self.paint(letter, x, y)
			}
			LevelEdit::Place { .. } => Err(refuse(
				"objects in Fizz 2 levels cannot be placed yet; they arrive with the next milestone",
			)),
		}
    }

    fn replace(&mut self, start: usize, end: usize, with: &str) -> Result<(), DocumentError> {
        if start > end || end > self.text.len() {
            return Err(DocumentError::OutOfRange { start, end });
        }
        for offset in [start, end] {
            if !self.text.is_char_boundary(offset) {
                return Err(DocumentError::NotOnBoundary { offset });
            }
        }
        self.text.replace_range(start..end, with);
        Ok(())
    }
}
