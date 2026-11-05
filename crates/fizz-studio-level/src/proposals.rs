// What Claude has proposed (the ghosts) and the words the editor offers (the palette and completion)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Both are read-only views. The ghosts come from the `<level>.studio.json` sidecar the MCP server
// writes: its pending history entries, each parsed with the language's own parser and spread out
// into cells, so the webview draws them and never reads a line of the language itself.

use fizz_studio_language::ast::{Body, Range};
use fizz_studio_language::docs::{docs_for, DocKind, Scope};
use fizz_studio_language::parser::parse;
use fizz_studio_protocol::{GhostCell, GhostOp, GhostProposal, WordDoc};

/// The sidecar's file name for a level file: the same path with `.fizz` swapped for `.studio.json`.
pub fn sidecar_path(level_path: &str) -> String {
    format!(
        "{}.studio.json",
        level_path.strip_suffix(".fizz").unwrap_or(level_path)
    )
}

/// Every word a Fizz 1 level script can use, in the language's order, for completion and the
/// Palette. Field names are left out: they only make sense after a statement's word.
pub fn word_docs() -> Vec<WordDoc> {
    docs_for(Scope::Level)
        .into_iter()
        .filter_map(|doc| {
            let kind = match doc.kind {
                DocKind::Statement => "statement",
                DocKind::Section => "section",
                DocKind::Segment => "segment",
                DocKind::Tile => "tile",
                DocKind::Item => "item",
                DocKind::Enemy => "enemy",
                DocKind::Field => return None,
            };
            Some(WordDoc {
                word: doc.word.clone(),
                kind: kind.to_string(),
                syntax: doc.syntax.clone(),
                example: doc.example.clone(),
                note: doc.note.clone(),
            })
        })
        .collect()
}

/// The most cells one proposal may draw, so a careless range cannot make the webview heavy.
const MAX_GHOST_CELLS: usize = 20_000;

fn spread(ranges: &[Range], limit: u32) -> Vec<u32> {
    let mut out = Vec::new();
    for range in ranges {
        let lo = range.lo.max(0.0);
        let hi = range.hi.min(f64::from(limit) - 1.0);
        let (mut at, end) = (lo as u32, hi as u32);
        if hi < lo || limit == 0 {
            continue;
        }
        while at <= end {
            out.push(at);
            at += 1;
        }
    }
    out
}

/// The cells one line of edits changes, inside a `width` by `height` level.
fn line_cells(body: &Body, width: u32, height: u32) -> Vec<GhostCell> {
    let (op, word, xs, ys) = match body {
        Body::Paint { tile, xs, ys } => (GhostOp::Paint, Some(tile.clone()), xs, ys),
        Body::Clear { xs, ys } => (GhostOp::Clear, None, xs, ys),
        Body::Place { kind, xs, ys } => (GhostOp::Place, Some(kind.clone()), xs, ys),
        _ => return Vec::new(),
    };
    let (columns, rows) = (spread(xs, width), spread(ys, height));
    let mut cells = Vec::new();
    for &y in &rows {
        for &x in &columns {
            cells.push(GhostCell {
                x,
                y,
                op,
                word: word.clone(),
            });
        }
    }
    cells
}

/// Expands proposal lines into cells with the level's own header, so words and bounds are the real
/// ones. A line that does not parse as a paint, clear or place contributes nothing.
fn proposal_cells(level_text: &str, lines: &[String], width: u32, height: u32) -> Vec<GhostCell> {
    let parsed = parse(level_text);
    let Some(header) = parsed
        .ast
        .nodes
        .iter()
        .find(|n| matches!(n.body, Body::Level { .. }))
        .and_then(|n| n.raw.clone())
    else {
        return Vec::new();
    };
    let prefix = [header.as_str(), "start 0,0", "edits"];
    let scratch = prefix
        .iter()
        .copied()
        .chain(lines.iter().map(String::as_str));
    let scratch: Vec<&str> = scratch.collect();
    let reparsed = parse(&scratch.join("\n"));
    let bad: Vec<usize> = reparsed.errors.iter().map(|e| e.line).collect();
    let mut cells = Vec::new();
    for node in reparsed.ast.nodes.iter().skip(prefix.len()) {
        if bad.contains(&node.line) {
            continue;
        }
        cells.extend(line_cells(&node.body, width, height));
        if cells.len() > MAX_GHOST_CELLS {
            cells.truncate(MAX_GHOST_CELLS);
            break;
        }
    }
    cells
}

/// The pending proposals in a sidecar, as ghosts over a level. Anything not pending is ignored, and
/// a sidecar that is not valid JSON, or has no history, has none: it is never an error to draw
/// nothing.
pub fn pending_ghosts(
    level_text: &str,
    width: u32,
    height: u32,
    sidecar_json: &str,
) -> Vec<GhostProposal> {
    let Ok(root) = serde_json::from_str::<serde_json::Value>(sidecar_json) else {
        return Vec::new();
    };
    let Some(history) = root.get("history").and_then(|h| h.as_array()) else {
        return Vec::new();
    };
    let text_of = |entry: &serde_json::Value, key: &str| {
        entry.get(key).and_then(|v| v.as_str()).map(String::from)
    };
    history
        .iter()
        .filter(|entry| entry.get("status").and_then(|s| s.as_str()) == Some("pending"))
        .filter_map(|entry| {
            let lines: Vec<String> = entry
                .get("lines")?
                .as_array()?
                .iter()
                .filter_map(|l| l.as_str().map(String::from))
                .collect();
            Some(GhostProposal {
                id: text_of(entry, "id")?,
                title: text_of(entry, "title").unwrap_or_default(),
                why: text_of(entry, "why"),
                cells: proposal_cells(level_text, &lines, width, height),
                lines,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const CRATER: &str = include_str!("../../../levels/crater.fizz");

    fn sidecar(entries: &str) -> String {
        format!(
            r#"{{"version":1,"mode":"propose","nextId":9,"nextNote":1,"notes":[],"history":[{entries}]}}"#
        )
    }

    #[test]
    fn the_sidecar_sits_beside_the_level() {
        assert_eq!(sidecar_path("/a/b/crater.fizz"), "/a/b/crater.studio.json");
        assert_eq!(sidecar_path("odd"), "odd.studio.json");
    }

    #[test]
    fn the_words_include_paint_and_every_kind_but_fields() {
        let words = word_docs();
        let paint = words.iter().find(|w| w.word == "paint").unwrap();
        assert_eq!(paint.kind, "statement");
        assert!(!paint.syntax.is_empty());
        for kind in ["tile", "item", "enemy", "section"] {
            assert!(words.iter().any(|w| w.kind == kind), "no {kind} word");
        }
        assert!(words.iter().any(|w| w.word == "grass" && w.kind == "tile"));
    }

    #[test]
    fn a_pending_proposal_spreads_into_cells_and_others_are_left_out() {
        let json = sidecar(
            r#"{"id":"h1","by":"claude","mode":"propose","title":"A ledge","why":"for a jump",
            "lines":["paint grass x=2..3 y=4","place cheezie x=2 y=5","clear x=0 y=0"],"status":"pending"},
            {"id":"h2","title":"Old","lines":["paint grass x=0 y=0"],"status":"accepted"},
            {"id":"h3","title":"No","lines":["paint grass x=0 y=0"],"status":"rejected"}"#,
        );
        let ghosts = pending_ghosts(CRATER, 40, 20, &json);
        assert_eq!(ghosts.len(), 1);
        let ghost = &ghosts[0];
        assert_eq!(ghost.id, "h1");
        assert_eq!(ghost.why.as_deref(), Some("for a jump"));
        assert_eq!(ghost.lines.len(), 3);
        let at = |x, y| ghost.cells.iter().find(|c| c.x == x && c.y == y).unwrap();
        assert_eq!(at(2, 4).op, GhostOp::Paint);
        assert_eq!(at(3, 4).word.as_deref(), Some("grass"));
        assert_eq!(at(2, 5).op, GhostOp::Place);
        assert_eq!(at(0, 0).op, GhostOp::Clear);
        assert_eq!(ghost.cells.len(), 4);
    }

    #[test]
    fn cells_outside_the_level_are_clipped() {
        let json = sidecar(
            r#"{"id":"h1","title":"Wide","lines":["paint grass x=2..3 y=1"],"status":"pending"}"#,
        );
        let ghosts = pending_ghosts(CRATER, 3, 20, &json);
        let xs: Vec<u32> = ghosts[0].cells.iter().map(|c| c.x).collect();
        assert_eq!(xs, vec![2]);
    }

    #[test]
    fn a_missing_or_broken_sidecar_has_no_ghosts() {
        assert!(pending_ghosts(CRATER, 40, 20, "not json").is_empty());
        assert!(pending_ghosts(CRATER, 40, 20, "{}").is_empty());
        assert!(pending_ghosts(CRATER, 40, 20, &sidecar("")).is_empty());
    }

    #[test]
    fn a_line_the_language_rejects_draws_nothing() {
        let json = sidecar(
            r#"{"id":"h1","title":"Mixed","lines":["paint nothing-like-this x=1 y=1","paint grass x=1 y=1"],"status":"pending"}"#,
        );
        let ghosts = pending_ghosts(CRATER, 40, 20, &json);
        assert_eq!(ghosts[0].cells.len(), 1);
    }
}
