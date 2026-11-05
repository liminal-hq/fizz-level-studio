// The level document a session owns: validated edits appended to the script as minimal text changes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_language::ast::Range;
use fizz_studio_language::edits::{append_edits, Edit as ScriptEdit};
use fizz_studio_language::parser::parse;
use fizz_studio_language::printer::print;
use fizz_studio_language::raster::rasterise;
use fizz_studio_language::tables::{has, ITEMS, TILES};
use fizz_studio_protocol::{CellRange, LevelEdit};
use fizz_studio_session::{Document, DocumentError, Edit};

/// A Fizz 1 level as text.
#[derive(Clone, PartialEq, Eq, Default)]
pub struct LevelDocument {
    text: String,
}

// The text is the person's work, so Debug shows its size only.
impl std::fmt::Debug for LevelDocument {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LevelDocument")
            .field("len", &self.text.len())
            .finish()
    }
}

impl LevelDocument {
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

/// The name a step has in the history: `Paint grass`, `Clear`, `Place cheezie`.
pub fn step_name(edit: &LevelEdit) -> String {
    match edit {
        LevelEdit::Paint { tile, .. } => format!("Paint {tile}"),
        LevelEdit::Clear { .. } => "Clear".to_string(),
        LevelEdit::Place { item, .. } => format!("Place {item}"),
    }
}

fn refuse(message: impl Into<String>) -> DocumentError {
    DocumentError::Refused(message.into())
}

/// Ranges that are not empty, ordered, and inside `0..limit`.
fn ranges(axis: &str, given: &[CellRange], limit: usize) -> Result<Vec<Range>, DocumentError> {
    if given.is_empty() {
        return Err(refuse(format!("no {axis} range was given")));
    }
    given
        .iter()
        .map(|&[from, to]| {
            if from > to {
                Err(refuse(format!(
                    "the {axis} range {from} to {to} is backwards"
                )))
            } else if to as usize >= limit {
                Err(refuse(format!(
                    "the {axis} range {from} to {to} is outside the level ({limit} cells on that axis)"
                )))
            } else {
                Ok(Range {
                    lo: f64::from(from),
                    hi: f64::from(to),
                })
            }
        })
        .collect()
}

/// The smallest single change from `old` to `new`, found by trimming what they share at both ends.
fn minimal_edit(old: &str, new: &str) -> Option<Edit> {
    if old == new {
        return None;
    }
    let mut prefix = old
        .bytes()
        .zip(new.bytes())
        .take_while(|(a, b)| a == b)
        .count();
    while !(old.is_char_boundary(prefix) && new.is_char_boundary(prefix)) {
        prefix -= 1;
    }
    let room = old.len().min(new.len()) - prefix;
    let mut suffix = old
        .bytes()
        .rev()
        .zip(new.bytes().rev())
        .take(room)
        .take_while(|(a, b)| a == b)
        .count();
    while !(old.is_char_boundary(old.len() - suffix) && new.is_char_boundary(new.len() - suffix)) {
        suffix -= 1;
    }
    Some(Edit {
        start: prefix,
        removed: old[prefix..old.len() - suffix].to_string(),
        inserted: new[prefix..new.len() - suffix].to_string(),
    })
}

impl Document for LevelDocument {
    type Intent = LevelEdit;

    fn text(&self) -> &str {
        &self.text
    }

    fn apply(&mut self, intent: &LevelEdit) -> Result<Vec<Edit>, DocumentError> {
        let parsed = parse(&self.text);
        let world = rasterise(&parsed.ast)
            .ok_or_else(|| refuse("the script has no readable level header, so it has no size"))?;
        let edit = match intent {
            LevelEdit::Paint { tile, x, y } => {
                if !has(TILES, tile) {
                    return Err(refuse(format!("`{tile}` is not a tile")));
                }
                ScriptEdit::Paint {
                    tile: tile.clone(),
                    xs: ranges("x", x, world.w)?,
                    ys: ranges("y", y, world.h)?,
                }
            }
            LevelEdit::Clear { x, y } => ScriptEdit::Clear {
                xs: ranges("x", x, world.w)?,
                ys: ranges("y", y, world.h)?,
            },
            LevelEdit::Place { item, x, y } => {
                if !has(ITEMS, item) {
                    return Err(refuse(format!("`{item}` is not an item")));
                }
                ScriptEdit::Place {
                    kind: item.clone(),
                    xs: ranges("x", x, world.w)?,
                    ys: ranges("y", y, world.h)?,
                }
            }
        };
        let next = print(&append_edits(&parsed.ast, &[edit]));
        let change = minimal_edit(&self.text, &next);
        self.text = next;
        Ok(change.into_iter().collect())
    }

    fn replace(&mut self, start: usize, end: usize, with: &str) -> Result<(), DocumentError> {
        self.check(start, end)?;
        self.text.replace_range(start..end, with);
        Ok(())
    }
}
