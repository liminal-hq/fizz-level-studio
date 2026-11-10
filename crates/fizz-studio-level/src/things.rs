// Moving, turning and deleting one thing by rewriting its own statement
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

//! The structured edits of D68. A thing (an item, a spawn or the start) is found, its statement is
//! opened into ordered members, one member is changed or removed, and the members are written back
//! in the fewest statements that keep their order. Only the one statement's line changes; every
//! other byte of the script is as it was.
//!
//! One rule does most of the work: **an edit never reorders things.** A statement that cannot hold
//! the change is split into consecutive statements in its own place (the members before it, the
//! member, the members after it). So `view.items` and `view.spawns` keep their order, a move or a
//! turn changes exactly one element, and a delete removes exactly one. The engine checks that on its
//! own output before it accepts it, and refuses (rather than writes) anything that fails the check.

use fizz_studio_language::ast::{Body, Node, SectionName};
use fizz_studio_language::js::number_string;
use fizz_studio_language::messages::message;
use fizz_studio_language::parser::parse;
use fizz_studio_language::raster::{rasterise, ItemAt, SpawnAt, StartAt, World};
use fizz_studio_language::rewrite::{
    parse_range, pieces_replacing, pieces_without, range_text, Line,
};
use fizz_studio_protocol::{Facing, LevelEdit, ThingKind, ThingRef};
use fizz_studio_session::DocumentError;

use crate::document::refuse;

/// What a thing edit makes: the new text, which is the old text when the edit changes nothing, and
/// the name of its undo step.
#[derive(Clone, PartialEq, Eq)]
pub struct ThingOutcome {
    pub text: String,
    pub name: String,
}

// An outcome holds the script, so it only shows its size.
impl std::fmt::Debug for ThingOutcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ThingOutcome")
            .field("text_len", &self.text.len())
            .field("name", &self.name)
            .finish()
    }
}

const UNSAFE: &str = "the studio could not make this change safely";

/// A thing found in the world: where it is in its list and which of its statement's members it is.
struct Found {
    kind: ThingKind,
    index: usize,
    /// The line, counted from 1.
    line: usize,
    /// Which member of the statement on `line` this is, counted from 0.
    member: usize,
    word: String,
    x: f64,
    y: Option<f64>,
}

/// One thing in a list the caller may have drawn from, as the locator sees it.
struct Candidate {
    line: usize,
    word: String,
    x: f64,
    y: Option<f64>,
}

fn candidates(world: &World, kind: ThingKind) -> Vec<Candidate> {
    match kind {
        ThingKind::Item => world
            .items
            .iter()
            .map(|i| Candidate {
                line: i.line,
                word: i.kind.clone(),
                x: i.x,
                y: Some(i.y),
            })
            .collect(),
        ThingKind::Spawn => world
            .spawns
            .iter()
            .map(|s| Candidate {
                line: s.line,
                word: s.kind.clone(),
                x: s.x,
                y: s.y,
            })
            .collect(),
        ThingKind::Start => world
            .start
            .iter()
            .map(|s| Candidate {
                line: s.line,
                word: "start".to_string(),
                x: s.x,
                y: Some(s.y),
            })
            .collect(),
    }
}

fn near(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-9
}

fn gone(thing: &ThingRef) -> DocumentError {
    DocumentError::Gone { line: thing.line }
}

/// Stage 1: finds the thing the caller drew. It is accepted where the caller said when its line, the
/// text of that line, and its place all agree. Otherwise it is looked for again by the text of its
/// line and its place, and accepted when that is unique; if not, it is gone.
fn locate(world: &World, lines: &[&str], thing: &ThingRef) -> Result<Found, DocumentError> {
    let list = candidates(world, thing.kind);
    let raw_of = |line: usize| line.checked_sub(1).and_then(|i| lines.get(i)).copied();
    let places = |c: &Candidate| {
        near(c.x, thing.x)
            && match (c.y, thing.y) {
                (Some(a), Some(b)) => near(a, b),
                _ => true,
            }
    };
    let agrees =
        |c: &Candidate| c.line > 0 && raw_of(c.line) == Some(thing.expect.as_str()) && places(c);
    let index = match list.get(thing.index as usize) {
        Some(c) if c.line == thing.line as usize && agrees(c) => thing.index as usize,
        _ => {
            let mut found = list
                .iter()
                .enumerate()
                .filter(|(_, c)| agrees(c))
                .map(|(i, _)| i);
            match (found.next(), found.next()) {
                (Some(i), None) => i,
                _ => return Err(gone(thing)),
            }
        }
    };
    let c = &list[index];
    let member = list[..index].iter().filter(|e| e.line == c.line).count();
    Ok(Found {
        kind: thing.kind,
        index,
        line: c.line,
        member,
        word: c.word.clone(),
        x: c.x,
        y: c.y,
    })
}

/// The section a line is in.
fn section_of(nodes: &[Node], line: usize) -> Option<SectionName> {
    nodes[..line.min(nodes.len())]
        .iter()
        .rev()
        .find_map(|n| match &n.body {
            Body::Section { name } => Some(*name),
            _ => None,
        })
}

// ---------------------------------------------------------------------------------------------
// Lists of cells

/// One element of an `x=` or `y=` list: its text as written and the whole-number cells it covers.
#[derive(Clone)]
struct Elem {
    text: String,
    lo: i64,
    hi: i64,
}

/// A comma list of whole-number cells and ranges, in the order the rasteriser walks them.
#[derive(Clone)]
struct Cells(Vec<Elem>);

impl Cells {
    fn read(line: &Line, key: &str) -> Result<Cells, DocumentError> {
        let field = line.field(key).ok_or_else(|| refuse(UNSAFE))?;
        let mut out = Vec::new();
        for i in 0..field.items.len() {
            let text = line.item(key, i).ok_or_else(|| refuse(UNSAFE))?;
            let (lo, hi) = parse_range(text).ok_or_else(|| refuse(UNSAFE))?;
            out.push(Elem {
                text: text.to_string(),
                lo,
                hi,
            });
        }
        Ok(Cells(out))
    }

    fn count(&self) -> usize {
        self.0.iter().map(|e| (e.hi - e.lo + 1) as usize).sum()
    }

    /// The element holding the cell with this ordinal, and the cell's value.
    fn locate(&self, ordinal: usize) -> Option<(usize, i64)> {
        let mut at = 0;
        for (i, e) in self.0.iter().enumerate() {
            let n = (e.hi - e.lo + 1) as usize;
            if ordinal < at + n {
                return Some((i, e.lo + (ordinal - at) as i64));
            }
            at += n;
        }
        None
    }

    fn value(&self, ordinal: usize) -> Option<i64> {
        self.locate(ordinal).map(|(_, v)| v)
    }

    /// The elements, as text, that cover ordinals `from..to` and nothing else. Whole elements keep
    /// their spelling.
    fn restrict(&self, from: usize, to: usize) -> Vec<String> {
        let mut out = Vec::new();
        let mut at = 0;
        for e in &self.0 {
            let n = (e.hi - e.lo + 1) as usize;
            let (start, end) = (at.max(from), (at + n).min(to));
            if start < end {
                if start == at && end == at + n {
                    out.push(e.text.clone());
                } else {
                    out.push(range_text(
                        e.lo + (start - at) as i64,
                        e.lo + (end - 1 - at) as i64,
                    ));
                }
            }
            at += n;
        }
        out
    }

    /// The line with the cell of this ordinal replaced (`new` is its new text), in place.
    fn replace_in(
        &self,
        line: &Line,
        key: &str,
        ordinal: usize,
        new: &str,
    ) -> Result<String, DocumentError> {
        let (i, cell) = self.locate(ordinal).ok_or_else(|| refuse(UNSAFE))?;
        let pieces = pieces_replacing(&self.0[i].text, cell, new);
        line.list_splice(key, i, &pieces)
            .ok_or_else(|| refuse(UNSAFE))
    }

    /// The line with the cell of this ordinal taken out, in place. There must be a cell left.
    fn remove_from(&self, line: &Line, key: &str, ordinal: usize) -> Result<String, DocumentError> {
        let (i, cell) = self.locate(ordinal).ok_or_else(|| refuse(UNSAFE))?;
        let pieces = pieces_without(&self.0[i].text, cell);
        line.list_splice(key, i, &pieces)
            .ok_or_else(|| refuse(UNSAFE))
    }
}

/// Whole numbers in the order given, with each ascending run of one written as `a..b`.
fn list_text(cells: &[i64]) -> String {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < cells.len() {
        let mut j = i;
        while j + 1 < cells.len() && cells[j + 1] == cells[j] + 1 {
            j += 1;
        }
        out.push(range_text(cells[i], cells[j]));
        i = j + 1;
    }
    out.join(",")
}

fn whole(n: f64) -> Result<i64, DocumentError> {
    if n.is_finite() && n.fract() == 0.0 && n.abs() < 1e9 {
        Ok(n as i64)
    } else {
        Err(refuse("items sit on whole cells"))
    }
}

// ---------------------------------------------------------------------------------------------
// What an edit asks, and what a rewrite gives back

enum Change {
    Move { x: f64, y: Option<f64> },
    Face(Facing),
    Delete,
}

/// The new lines for one statement, and what to say about them.
struct Rewrite {
    /// The statement's new lines, each with its line ending. Empty when the statement is gone.
    lines: Vec<String>,
    /// The deleted statement carried a comment that was kept as a line of its own.
    kept_comment: bool,
    /// The resolved ground a spawn was pinned to.
    pinned: Option<f64>,
}

impl Rewrite {
    fn lines(lines: Vec<String>) -> Rewrite {
        Rewrite {
            lines,
            kept_comment: false,
            pinned: None,
        }
    }
}

/// A statement deleted whole: its line goes, and a comment it carried stays as a line of its own.
fn remove_statement(line: &Line) -> Rewrite {
    match line.comment_only() {
        Some(comment) => Rewrite {
            lines: vec![comment],
            kept_comment: true,
            pinned: None,
        },
        None => Rewrite::lines(Vec::new()),
    }
}

/// The edit applied to a statement that makes things on a grid of cells: `KIND x=LIST y=N` in
/// `treats` (Item) or `place KIND x=LIST y=LIST` in `edits` (Place). Both read their cells the same
/// way, x outer and y inner, so one routine does both.
fn edit_grid(original: &Line, found: &Found, change: &Change) -> Result<Rewrite, DocumentError> {
    let xs = Cells::read(original, "x")?;
    let ys = Cells::read(original, "y")?;
    let (nx, ny) = (xs.count(), ys.count());
    let total = nx * ny;
    let m = found.member;
    if m >= total {
        return Err(refuse(UNSAFE));
    }
    let (i, j) = (m / ny, m % ny);
    let (ox, oy) = (
        xs.value(i).ok_or_else(|| refuse(UNSAFE))?,
        ys.value(j).ok_or_else(|| refuse(UNSAFE))?,
    );
    match change {
        Change::Move { x, y } => {
            let y = y.ok_or_else(|| refuse("an item needs a y"))?;
            let (tx, ty) = (whole(*x)?, whole(y)?);
            if (tx, ty) == (ox, oy) {
                return Ok(Rewrite::lines(vec![original.raw().to_string()]));
            }
            // In place: one cell of one list changes.
            if total == 1 {
                let mut text = original.raw().to_string();
                if tx != ox {
                    text = Line::new(&text)
                        .set_value("x", &tx.to_string())
                        .ok_or_else(|| refuse(UNSAFE))?;
                }
                if ty != oy {
                    text = Line::new(&text)
                        .set_value("y", &ty.to_string())
                        .ok_or_else(|| refuse(UNSAFE))?;
                }
                return Ok(Rewrite::lines(vec![text]));
            }
            if ny == 1 && ty == oy {
                return Ok(Rewrite::lines(vec![xs.replace_in(
                    original,
                    "x",
                    i,
                    &tx.to_string(),
                )?]));
            }
            if nx == 1 && tx == ox {
                return Ok(Rewrite::lines(vec![ys.replace_in(
                    original,
                    "y",
                    j,
                    &ty.to_string(),
                )?]));
            }
            // Otherwise split, in order: the cells before, this cell, the cells after.
            let middle = original
                .set_value("x", &tx.to_string())
                .and_then(|t| Line::new(&t).set_value("y", &ty.to_string()))
                .ok_or_else(|| refuse(UNSAFE))?;
            let mut out = grid_pieces(original, &xs, &ys, 0, m)?;
            out.push(middle);
            out.extend(grid_pieces(original, &xs, &ys, m + 1, total)?);
            Ok(Rewrite::lines(out))
        }
        Change::Delete => {
            if total == 1 {
                return Ok(remove_statement(original));
            }
            if ny == 1 {
                return Ok(Rewrite::lines(vec![xs.remove_from(original, "x", i)?]));
            }
            if nx == 1 {
                return Ok(Rewrite::lines(vec![ys.remove_from(original, "y", j)?]));
            }
            let mut out = grid_pieces(original, &xs, &ys, 0, m)?;
            out.extend(grid_pieces(original, &xs, &ys, m + 1, total)?);
            Ok(Rewrite::lines(out))
        }
        Change::Face(_) => Err(refuse("only an enemy has a facing")),
    }
}

/// Statements, as clones of the original, that make exactly the cells with ordinals `from..to`, by
/// columns: a partial first column, the whole columns between, a partial last column.
fn grid_pieces(
    original: &Line,
    xs: &Cells,
    ys: &Cells,
    from: usize,
    to: usize,
) -> Result<Vec<String>, DocumentError> {
    let ny = ys.count();
    let mut out = Vec::new();
    if from >= to {
        return Ok(out);
    }
    let (first_col, last_col) = (from / ny, (to - 1) / ny);
    let clone = |x: Vec<String>, y: Option<Vec<String>>| -> Result<String, DocumentError> {
        let text = original.set_list("x", &x).ok_or_else(|| refuse(UNSAFE))?;
        match y {
            Some(y) => Line::new(&text)
                .set_list("y", &y)
                .ok_or_else(|| refuse(UNSAFE)),
            None => Ok(text),
        }
    };
    if first_col == last_col {
        let (a, b) = (from - first_col * ny, to - first_col * ny);
        out.push(clone(
            xs.restrict(first_col, first_col + 1),
            Some(ys.restrict(a, b)),
        )?);
        return Ok(out);
    }
    // The first column, whole or partial.
    let mut whole_from = first_col;
    if !from.is_multiple_of(ny) {
        out.push(clone(
            xs.restrict(first_col, first_col + 1),
            Some(ys.restrict(from - first_col * ny, ny)),
        )?);
        whole_from = first_col + 1;
    }
    // The last column, whole or partial.
    let mut whole_to = last_col + 1;
    let mut tail = None;
    if !to.is_multiple_of(ny) {
        tail = Some(clone(
            xs.restrict(last_col, last_col + 1),
            Some(ys.restrict(0, to - last_col * ny)),
        )?);
        whole_to = last_col;
    }
    if whole_from < whole_to {
        out.push(clone(xs.restrict(whole_from, whole_to), None)?);
    }
    out.extend(tail);
    Ok(out)
}

/// The statement that makes one thing on its own cell, in the form its section accepts: `KIND x=N y=N`
/// in `treats`, `place KIND x=N y=N` in `edits`.
fn single_code(in_edits: bool, kind: &str, x: i64, y: &str) -> String {
    if in_edits {
        format!("place {kind} x={x} y={y}")
    } else {
        format!("{kind} x={x} y={y}")
    }
}

/// A `row` statement: `row KIND x=A..B y=N [by=N]`.
fn edit_row(
    original: &Line,
    found: &Found,
    change: &Change,
    in_edits: bool,
    row: (i64, i64, i64),
) -> Result<Rewrite, DocumentError> {
    let (lo, hi, by) = row;
    let members: Vec<i64> = (0..=((hi - lo) / by)).map(|k| lo + k * by).collect();
    let n = members.len();
    let m = found.member;
    if m >= n {
        return Err(refuse(UNSAFE));
    }
    let y_text = original
        .value("y")
        .ok_or_else(|| refuse(UNSAFE))?
        .to_string();
    let oy = parse_range(&y_text)
        .map(|(a, _)| a)
        .ok_or_else(|| refuse(UNSAFE))?;
    let kind = &found.word;
    // The members `a..b` as statements in the shape they keep: a row when two or more, one cell
    // otherwise.
    let pieces = |a: usize, b: usize| -> Result<Vec<String>, DocumentError> {
        match b.saturating_sub(a) {
            0 => Ok(Vec::new()),
            1 => Ok(vec![original.replace_code(&single_code(
                in_edits, kind, members[a], &y_text,
            ))]),
            _ => Ok(vec![original
                .set_value("x", &range_text(members[a], members[b - 1]))
                .ok_or_else(|| refuse(UNSAFE))?]),
        }
    };
    match change {
        Change::Move { x, y } => {
            let y = y.ok_or_else(|| refuse("an item needs a y"))?;
            let (tx, ty) = (whole(*x)?, whole(y)?);
            if (tx, ty) == (members[m], oy) {
                return Ok(Rewrite::lines(vec![original.raw().to_string()]));
            }
            if n == 1 {
                let mut text = original.raw().to_string();
                if tx != members[m] {
                    text = Line::new(&text)
                        .set_value("x", &tx.to_string())
                        .ok_or_else(|| refuse(UNSAFE))?;
                }
                if ty != oy {
                    text = Line::new(&text)
                        .set_value("y", &ty.to_string())
                        .ok_or_else(|| refuse(UNSAFE))?;
                }
                return Ok(Rewrite::lines(vec![text]));
            }
            if ty == oy {
                // Still a row when the end member moves along the step.
                let mut next = members.clone();
                next[m] = tx;
                if next.windows(2).all(|w| w[1] - w[0] == by) {
                    let text = original
                        .set_value("x", &range_text(next[0], next[n - 1]))
                        .ok_or_else(|| refuse(UNSAFE))?;
                    return Ok(Rewrite::lines(vec![text]));
                }
                // Otherwise one list statement, in the members' order.
                let code = single_list(in_edits, kind, &next, &y_text);
                return Ok(Rewrite::lines(vec![original.replace_code(&code)]));
            }
            let mut out = pieces(0, m)?;
            out.push(original.replace_code(&single_code(in_edits, kind, tx, &ty.to_string())));
            out.extend(pieces(m + 1, n)?);
            Ok(Rewrite::lines(out))
        }
        Change::Delete => {
            if n == 1 {
                return Ok(remove_statement(original));
            }
            if m == 0 || m == n - 1 {
                return Ok(Rewrite::lines(if m == 0 {
                    pieces(1, n)?
                } else {
                    pieces(0, n - 1)?
                }));
            }
            let mut rest = members.clone();
            rest.remove(m);
            let code = single_list(in_edits, kind, &rest, &y_text);
            Ok(Rewrite::lines(vec![original.replace_code(&code)]))
        }
        Change::Face(_) => Err(refuse("only an enemy has a facing")),
    }
}

/// `KIND x=LIST y=N` (or with `place`) for members that share a `y`.
fn single_list(in_edits: bool, kind: &str, xs: &[i64], y: &str) -> String {
    let list = list_text(xs);
    if in_edits {
        format!("place {kind} x={list} y={y}")
    } else {
        format!("{kind} x={list} y={y}")
    }
}

/// A spawn statement: `KIND x=LIST [y=N] [dir=N] [ride]`.
fn edit_spawn(
    original: &Line,
    found: &Found,
    change: &Change,
    spawn: &SpawnAt,
) -> Result<Rewrite, DocumentError> {
    let count = original.field("x").map_or(0, |f| f.items.len());
    let m = found.member;
    if m >= count {
        return Err(refuse(UNSAFE));
    }
    let x_texts: Vec<String> = (0..count)
        .map(|i| original.item("x", i).unwrap_or_default().to_string())
        .collect();
    let has_y = original.field("y").is_some();
    let has_dir = original.field("dir").is_some();
    let ride = original.has_flag("ride");
    let cur_y: Option<f64> = original.value("y").and_then(|t| t.parse().ok());
    let cur_dir: Option<f64> = original.value("dir").and_then(|t| t.parse().ok());

    // The statement the thing is edited in: the whole line when it makes only this thing, else the
    // thing on a line of its own, between the others.
    let apply = |attrs: &dyn Fn(&Line) -> Result<String, DocumentError>,
                 x_text: Option<&str>|
     -> Result<Rewrite, DocumentError> {
        if count == 1 {
            let mut text = original.raw().to_string();
            if let Some(x_text) = x_text {
                text = Line::new(&text)
                    .set_value("x", x_text)
                    .ok_or_else(|| refuse(UNSAFE))?;
            }
            return Ok(Rewrite::lines(vec![attrs(&Line::new(&text))?]));
        }
        let mut mine = x_texts[m].clone();
        if let Some(x_text) = x_text {
            mine = x_text.to_string();
        }
        let middle = original
            .set_list("x", &[mine])
            .ok_or_else(|| refuse(UNSAFE))?;
        let middle = attrs(&Line::new(&middle))?;
        let mut out = Vec::new();
        if m > 0 {
            out.push(
                original
                    .set_list("x", &x_texts[..m])
                    .ok_or_else(|| refuse(UNSAFE))?,
            );
        }
        out.push(middle);
        if m + 1 < count {
            out.push(
                original
                    .set_list("x", &x_texts[m + 1..])
                    .ok_or_else(|| refuse(UNSAFE))?,
            );
        }
        Ok(Rewrite::lines(out))
    };

    match change {
        Change::Move { x, y } => {
            if !x.is_finite() || y.is_some_and(|y| !y.is_finite()) {
                return Err(refuse("that is not a place"));
            }
            let x_text = number_string(*x);
            let x_moves = !near(*x, found.x);
            let y_moves = match (y, has_y) {
                (None, false) => false,
                (Some(v), true) => !near(*v, cur_y.unwrap_or(f64::NAN)),
                _ => true,
            };
            if !x_moves && !y_moves {
                return Ok(Rewrite::lines(vec![original.raw().to_string()]));
            }
            if !y_moves {
                // Only the x of one list member changes: in place.
                let text = original
                    .list_replace("x", m, &x_text)
                    .ok_or_else(|| refuse(UNSAFE))?;
                return Ok(Rewrite::lines(vec![text]));
            }
            if y.is_none() && (has_dir || ride) {
                return Err(refuse(
                    "a spawn that faces or rides needs a y, so it cannot stand on the ground",
                ));
            }
            let y = *y;
            apply(
                &|line: &Line| match y {
                    Some(v) if has_y => line
                        .set_value("y", &number_string(v))
                        .ok_or_else(|| refuse(UNSAFE)),
                    Some(v) => Ok(line.add_field("y", Some(&number_string(v)))),
                    None => line.remove_field("y").ok_or_else(|| refuse(UNSAFE)),
                },
                x_moves.then_some(x_text.as_str()),
            )
        }
        Change::Face(facing) => {
            if ride {
                return Err(refuse("a rider has no facing"));
            }
            let value = match facing {
                Facing::Left => "-1",
                Facing::Right => "1",
            };
            let turned = |dir: f64| match facing {
                Facing::Left => dir < 0.0,
                Facing::Right => dir > 0.0,
            };
            if has_dir {
                if turned(cur_dir.unwrap_or(0.0)) {
                    return Ok(Rewrite::lines(vec![original.raw().to_string()]));
                }
            } else if *facing == Facing::Left {
                // No dir is the Builder's default, which is left.
                return Ok(Rewrite::lines(vec![original.raw().to_string()]));
            }
            let pin = if has_y {
                None
            } else {
                Some(spawn.y.ok_or_else(|| {
                    refuse("there is no ground under it to pin it to, so it cannot face a way")
                })?)
            };
            let mut result = apply(
                &|line: &Line| {
                    let mut text = line.raw().to_string();
                    if let Some(y) = pin {
                        text = Line::new(&text).add_field("y", Some(&number_string(y)));
                    }
                    let now = Line::new(&text);
                    Ok(match now.field("dir") {
                        Some(_) => now.set_value("dir", value).ok_or_else(|| refuse(UNSAFE))?,
                        None => now.add_field("dir", Some(value)),
                    })
                },
                None,
            )?;
            result.pinned = pin;
            Ok(result)
        }
        Change::Delete => {
            if count == 1 {
                return Ok(remove_statement(original));
            }
            let text = original.list_remove("x", m).ok_or_else(|| refuse(UNSAFE))?;
            Ok(Rewrite::lines(vec![text]))
        }
    }
}

/// The start: `start X,Y`.
fn edit_start(original: &Line, start: &StartAt, change: &Change) -> Result<Rewrite, DocumentError> {
    match change {
        Change::Move { x, y } => {
            let y = y.ok_or_else(|| refuse("the start needs a y"))?;
            if !x.is_finite() || !y.is_finite() {
                return Err(refuse("that is not a place"));
            }
            let mut text = original.raw().to_string();
            if !near(*x, start.x) {
                text = Line::new(&text)
                    .set_positional_item(0, 0, &number_string(*x))
                    .ok_or_else(|| refuse(UNSAFE))?;
            }
            if !near(y, start.y) {
                text = Line::new(&text)
                    .set_positional_item(0, 1, &number_string(y))
                    .ok_or_else(|| refuse(UNSAFE))?;
            }
            Ok(Rewrite::lines(vec![text]))
        }
        Change::Face(_) => Err(refuse("the start has no facing")),
        Change::Delete => Err(refuse("a level needs a start")),
    }
}

// ---------------------------------------------------------------------------------------------
// The pipeline

/// The checks a result must pass before the engine accepts it. Refuses with a reason.
fn validate(
    old: &World,
    old_errors: &[(String, String)],
    new_text: &str,
    found: &Found,
    change: &Change,
) -> Result<World, DocumentError> {
    let parsed = parse(new_text);
    let errors = error_keys(&parsed.errors);
    if errors != old_errors {
        // Say what the new text got wrong, in the language's own words.
        if let Some(extra) = parsed
            .errors
            .iter()
            .find(|d| !old_errors.contains(&(d.code.to_string(), message(d))))
        {
            return Err(refuse(message(extra)));
        }
        return Err(refuse(UNSAFE));
    }
    let world = rasterise(&parsed.ast).ok_or_else(|| refuse(UNSAFE))?;
    let unsafe_change = || {
        log::debug!("a structured edit failed its own check");
        refuse(UNSAFE)
    };

    // The cells and tiles do not change: things write none.
    if shell(old) != shell(&world) {
        return Err(unsafe_change());
    }
    let same_items = |a: &ItemAt, b: &ItemAt| a.kind == b.kind && a.x == b.x && a.y == b.y;
    let same_spawns = |a: &SpawnAt, b: &SpawnAt| {
        a.kind == b.kind && a.x == b.x && a.y == b.y && a.dir == b.dir && a.ride == b.ride
    };
    let rest_items = |new: &[ItemAt], old: &[ItemAt], skip_old: usize, skip_new: Option<usize>| {
        let a = old.iter().enumerate().filter(|(i, _)| *i != skip_old);
        let b = new.iter().enumerate().filter(|(i, _)| Some(*i) != skip_new);
        a.clone().count() == b.clone().count() && a.zip(b).all(|((_, a), (_, b))| same_items(a, b))
    };
    let rest_spawns =
        |new: &[SpawnAt], old: &[SpawnAt], skip_old: usize, skip_new: Option<usize>| {
            let a = old.iter().enumerate().filter(|(i, _)| *i != skip_old);
            let b = new.iter().enumerate().filter(|(i, _)| Some(*i) != skip_new);
            a.clone().count() == b.clone().count()
                && a.zip(b).all(|((_, a), (_, b))| same_spawns(a, b))
        };
    let i = found.index;
    match (found.kind, change) {
        (ThingKind::Item, Change::Delete) => {
            if world.items.len() + 1 != old.items.len()
                || !rest_items(&world.items, &old.items, i, None)
                || world.spawns.len() != old.spawns.len()
                || !rest_spawns(&world.spawns, &old.spawns, usize::MAX, None)
            {
                return Err(unsafe_change());
            }
        }
        (ThingKind::Item, Change::Move { x, y }) => {
            let ok = world.items.len() == old.items.len()
                && rest_items(&world.items, &old.items, i, Some(i))
                && world.items[i].kind == old.items[i].kind
                && world.items[i].x == *x
                && Some(world.items[i].y) == *y
                && world.spawns.len() == old.spawns.len()
                && rest_spawns(&world.spawns, &old.spawns, usize::MAX, None);
            if !ok {
                return Err(unsafe_change());
            }
        }
        (ThingKind::Spawn, Change::Delete) => {
            if world.spawns.len() + 1 != old.spawns.len()
                || !rest_spawns(&world.spawns, &old.spawns, i, None)
                || world.items.len() != old.items.len()
                || !rest_items(&world.items, &old.items, usize::MAX, None)
            {
                return Err(unsafe_change());
            }
        }
        (ThingKind::Spawn, Change::Move { x, y }) => {
            let n = world.spawns.get(i);
            let ok = world.spawns.len() == old.spawns.len()
                && rest_spawns(&world.spawns, &old.spawns, i, Some(i))
                && n.is_some_and(|n| {
                    let o = &old.spawns[i];
                    n.kind == o.kind
                        && n.x == *x
                        && n.dir == o.dir
                        && n.ride == o.ride
                        && y.is_none_or(|v| n.y == Some(v))
                })
                && world.items.len() == old.items.len()
                && rest_items(&world.items, &old.items, usize::MAX, None);
            if !ok {
                return Err(unsafe_change());
            }
        }
        (ThingKind::Spawn, Change::Face(facing)) => {
            let n = world.spawns.get(i);
            let ok = world.spawns.len() == old.spawns.len()
                && rest_spawns(&world.spawns, &old.spawns, i, Some(i))
                && n.is_some_and(|n| {
                    let o = &old.spawns[i];
                    let turned = match (n.dir, facing) {
                        (Some(d), Facing::Left) => d < 0.0,
                        (Some(d), Facing::Right) => d > 0.0,
                        (None, Facing::Left) => true,
                        (None, Facing::Right) => false,
                    };
                    n.kind == o.kind && n.x == o.x && n.y == o.y && n.ride == o.ride && turned
                })
                && world.items.len() == old.items.len()
                && rest_items(&world.items, &old.items, usize::MAX, None);
            if !ok {
                return Err(unsafe_change());
            }
        }
        (ThingKind::Start, Change::Move { x, y }) => {
            let ok = world.start.is_some_and(|s| s.x == *x && Some(s.y) == *y)
                && world.items.len() == old.items.len()
                && rest_items(&world.items, &old.items, usize::MAX, None)
                && world.spawns.len() == old.spawns.len()
                && rest_spawns(&world.spawns, &old.spawns, usize::MAX, None);
            if !ok {
                return Err(unsafe_change());
            }
        }
        _ => return Err(unsafe_change()),
    }
    // Things the edit did not name keep their start.
    if found.kind != ThingKind::Start {
        let same = match (&world.start, &old.start) {
            (Some(a), Some(b)) => a.x == b.x && a.y == b.y,
            (None, None) => true,
            _ => false,
        };
        if !same {
            return Err(unsafe_change());
        }
    }
    Ok(world)
}

/// The world without its things or its lines, for comparing what an edit must leave alone.
fn shell(world: &World) -> World {
    let mut shell = world.clone();
    shell.items.clear();
    shell.spawns.clear();
    shell.start = None;
    shell.lines.clear();
    shell
}

/// The errors of a parse as a sorted list of `(code, message)`, which ignores where they are.
fn error_keys(errors: &[fizz_studio_language::errors::Diagnostic]) -> Vec<(String, String)> {
    let mut keys: Vec<(String, String)> = errors
        .iter()
        .map(|d| (d.code.to_string(), message(d)))
        .collect();
    keys.sort();
    keys
}

/// The statement a line says, without its x list, when it is one that can join another: an item
/// (`KIND x=LIST y=N`), a `place`, or a spawn, with no trailing comment.
fn joinable(node: &Node) -> Option<Body> {
    if node.comment.is_some() {
        return None;
    }
    let mut body = node.body.clone();
    match &mut body {
        Body::Item { xs, .. } | Body::Place { xs, .. } => xs.clear(),
        Body::Spawn { xs, .. } => xs.clear(),
        _ => return None,
    }
    Some(body)
}

/// Joins the rewritten lines with the line before the first and the line after the last when the edit
/// made them say the same thing: both are the same kind of statement with the same fields (word,
/// `y`, `dir`, `ride`) and neither has a trailing comment, so the two x lists become one, in order,
/// and the things keep their order. A pair that could already have joined before the edit, and was
/// left apart by whoever wrote it, is left apart: only a join the edit made possible is made. `at` is
/// the index of the first rewritten line, `count` how many there are, and `original` is the
/// statement before the edit. Returns whether anything was joined. The result is checked like any
/// other, so a join that changed what the level builds is refused.
fn coalesce(lines: &mut Vec<String>, at: usize, count: usize, original: &Node) -> bool {
    if count == 0 {
        return false;
    }
    let text = lines.join("\n");
    let parsed = parse(&text);
    let nodes = &parsed.ast.nodes;
    let original = joinable(original);
    // The rewritten lines' neighbours, as they are now.
    let left = at
        .checked_sub(1)
        .and_then(|i| nodes.get(i))
        .and_then(joinable);
    let right = nodes.get(at + count).and_then(joinable);
    // Whether the neighbour could have joined the original: then it was left apart on purpose.
    let was_apart = |neighbour: &Option<Body>| original.is_none() || *neighbour != original;
    let join = |lines: &mut Vec<String>, i: usize| -> bool {
        let (la, lb) = (Line::new(&lines[i]), Line::new(&lines[i + 1]));
        let items = |line: &Line| -> Option<Vec<String>> {
            let field = line.field("x")?;
            (0..field.items.len())
                .map(|k| line.item("x", k).map(str::to_string))
                .collect()
        };
        let merged = items(&la).zip(items(&lb)).and_then(|(mut a, b)| {
            a.extend(b);
            la.set_list("x", &a)
        });
        match merged {
            Some(line) => {
                lines[i] = line;
                lines.remove(i + 1);
                true
            }
            None => false,
        }
    };
    let last = joinable(&nodes[at + count - 1]);
    let first = joinable(&nodes[at]);
    let mut joined = false;
    if right.is_some() && last == right && last.is_some() && was_apart(&right) {
        joined |= join(lines, at + count - 1);
    }
    if left.is_some() && first == left && first.is_some() && was_apart(&left) {
        joined |= join(lines, at - 1);
    }
    joined
}

/// Makes a thing edit against `text`. A no-op (the same place, the facing it already has) gives the
/// text back unchanged. A thing that cannot be edited, or an edit that would not be safe, is
/// refused with a reason; a thing that is no longer where the caller saw it is
/// [`DocumentError::Gone`].
pub fn apply_thing_edit(text: &str, edit: &LevelEdit) -> Result<ThingOutcome, DocumentError> {
    let (thing, change) = match edit {
        LevelEdit::MoveThing { thing, x, y } => (thing, Change::Move { x: *x, y: *y }),
        LevelEdit::FaceThing { thing, facing } => (thing, Change::Face(*facing)),
        LevelEdit::DeleteThing { thing } => (thing, Change::Delete),
        _ => return Err(refuse("that is not an edit of a thing")),
    };
    let parsed = parse(text);
    let world = rasterise(&parsed.ast)
        .ok_or_else(|| refuse("the script has no readable level header, so it has no size"))?;
    let lines: Vec<&str> = text.split('\n').collect();

    // 1. Locate.
    let found = locate(&world, &lines, thing)?;
    let node = parsed
        .ast
        .nodes
        .get(found.line - 1)
        .ok_or_else(|| gone(thing))?;
    let original = Line::new(lines[found.line - 1]);
    let in_edits = section_of(&parsed.ast.nodes, found.line) == Some(SectionName::Edits);

    // 2 to 4. Open the statement, change one member, write the members back.
    let mut rewrite = match (&node.body, found.kind) {
        (Body::PogoCache { .. }, _) => {
            return Err(refuse(format!(
                "made by the pogo-cache on line {}: edit that line in the script",
                found.line
            )));
        }
        (Body::Item { .. } | Body::Place { .. }, ThingKind::Item) => {
            edit_grid(&original, &found, &change)?
        }
        (Body::Row { x, by, .. }, ThingKind::Item) => {
            let (lo, hi, by) = (whole(x.lo)?, whole(x.hi)?, whole(*by)?);
            edit_row(&original, &found, &change, in_edits, (lo, hi, by.max(1)))?
        }
        (Body::Spawn { .. }, ThingKind::Spawn) => {
            let spawn = world.spawns.get(found.index).ok_or_else(|| gone(thing))?;
            edit_spawn(&original, &found, &change, spawn)?
        }
        (Body::Start { .. }, ThingKind::Start) => {
            let start = world.start.as_ref().ok_or_else(|| gone(thing))?;
            edit_start(&original, start, &change)?
        }
        _ => return Err(refuse("the studio cannot edit this kind of line yet")),
    };

    // 5. Splice. The first line keeps the original's comment; lines a split adds carry none.
    for (i, line) in rewrite.lines.iter_mut().enumerate() {
        if i > 0 {
            *line = Line::new(line).without_comment();
        }
    }
    let split = rewrite.lines.len() > 1;
    let mut out: Vec<String> = Vec::with_capacity(lines.len() + 2);
    out.extend(lines[..found.line - 1].iter().map(|l| l.to_string()));
    out.extend(rewrite.lines.iter().cloned());
    out.extend(lines[found.line..].iter().map(|l| l.to_string()));
    // A statement that an earlier split left in pieces joins its neighbours again when they say
    // the same thing, so moving a thing back puts the line back.
    let joined = coalesce(&mut out, found.line - 1, rewrite.lines.len(), node);
    let new_text = out.join("\n");

    // 6. Validate.
    let old_errors = error_keys(&parsed.errors);
    let new_world = if new_text == text {
        None
    } else {
        Some(validate(&world, &old_errors, &new_text, &found, &change)?)
    };

    // 7. The name of the undo step.
    let name = step_name(
        &found,
        &change,
        &rewrite,
        split && !joined,
        new_world.as_ref(),
        thing.line,
    );
    Ok(ThingOutcome {
        text: new_text,
        name,
    })
}

fn step_name(
    found: &Found,
    change: &Change,
    rewrite: &Rewrite,
    split: bool,
    new_world: Option<&World>,
    line: u32,
) -> String {
    let mut notes: Vec<String> = Vec::new();
    if let Some(y) = rewrite.pinned {
        notes.push(format!("pinned to y={}", number_string(y)));
    }
    if rewrite.kept_comment {
        notes.push("kept its comment".to_string());
    }
    if split {
        notes.push(format!("split line {line}"));
    }
    let tail = if notes.is_empty() {
        String::new()
    } else {
        format!(" ({})", notes.join(", "))
    };
    match change {
        Change::Move { x, y } => {
            let at_y = new_world
                .and_then(|w| match found.kind {
                    ThingKind::Item => w.items.get(found.index).map(|i| Some(i.y)),
                    ThingKind::Spawn => w.spawns.get(found.index).map(|s| s.y),
                    ThingKind::Start => w.start.as_ref().map(|s| Some(s.y)),
                })
                .flatten()
                .or(*y)
                .or(found.y);
            match at_y {
                Some(y) => format!(
                    "Move {} to {}, {}{tail}",
                    found.word,
                    number_string(*x),
                    number_string(y)
                ),
                None => format!("Move {} to {}{tail}", found.word, number_string(*x)),
            }
        }
        Change::Face(facing) => format!(
            "Turn {} to face {}{tail}",
            found.word,
            match facing {
                Facing::Left => "left",
                Facing::Right => "right",
            }
        ),
        Change::Delete => format!("Delete {}{tail}", found.word),
    }
}
