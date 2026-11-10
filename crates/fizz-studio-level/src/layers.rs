// The layers of a Fizz 1 script: which statements belong to which layer, and what a change touches
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A layer is a section of the script (`terrain`, `blocks`, `treats`, `enemies`, `edits`) or a group
// of statements inside one: `walls`, `crystals` and `markers` (the exits and doors). The Layers
// panel lists them, and a lock is kept under the layer's id. The lock is defined by effect: a
// statement belongs to the layers of what it builds, wherever it is written, so a `place cheezie`
// in the `edits` block belongs to `treats` as well as to `edits`.

use std::collections::{HashMap, HashSet};

use fizz_studio_language::ast::{Ast, Body, Node, Range, SectionName};
use fizz_studio_language::parser::parse;
use fizz_studio_language::raster::{rasterise, World};
use fizz_studio_protocol::{ViewSection, ViewSectionAffects, ViewSectionKind};

/// The tiles the objects list shows as things of their own.
pub(crate) const MARKER_TILES: [&str; 4] = ["exit", "red-door", "blue-door", "green-door"];

/// Every layer id, in the order the panel lists them.
pub const LAYER_ORDER: [&str; 8] = [
    "terrain", "walls", "blocks", "crystals", "markers", "treats", "enemies", "edits",
];

/// The layer's name in English, for the label a view carries.
fn label(id: &str) -> &'static str {
    match id {
        "terrain" => "Terrain",
        "walls" => "Walls",
        "blocks" => "Blocks",
        "crystals" => "Crystals",
        "markers" => "Markers",
        "treats" => "Treats",
        "enemies" => "Enemies",
        "edits" => "Edits",
        _ => "",
    }
}

/// A node with the section it sits in and the layers it belongs to.
struct Statement<'a> {
    node: &'a Node,
    section: Option<SectionName>,
    layers: Vec<&'static str>,
}

fn is_neutral(body: &Body) -> bool {
    matches!(body, Body::Blank | Body::Comment)
}

/// The layers a statement belongs to, by what it builds, in panel order.
fn layers_of(body: &Body, section: Option<SectionName>) -> Vec<&'static str> {
    let mut out: Vec<&'static str> = Vec::new();
    match body {
        Body::Section { name } => out.push(name.as_str()),
        Body::Walls => out.push("walls"),
        Body::Crystal { .. } => out.push("crystals"),
        Body::Tile { tile, .. } => {
            out.push(if MARKER_TILES.contains(&tile.as_str()) {
                "markers"
            } else {
                "blocks"
            });
        }
        Body::Paint { tile, .. } => {
            if MARKER_TILES.contains(&tile.as_str()) {
                out.push("markers");
            }
        }
        Body::Item { .. } | Body::Row { .. } | Body::PogoCache { .. } | Body::Place { .. } => {
            out.push("treats");
        }
        Body::Spawn { .. } => out.push("enemies"),
        Body::Segs { .. } | Body::Liquid { .. } => out.push("terrain"),
        Body::Plat { .. }
        | Body::Hover { .. }
        | Body::Channel { .. }
        | Body::Rect { .. }
        | Body::Mural { .. }
        | Body::Ladder { .. }
        | Body::Stairs { .. }
        | Body::VineNook { .. } => out.push("blocks"),
        // A line that did not parse could be anything, so it belongs to the section it sits in.
        Body::Error { .. } => out.extend(section.map(SectionName::as_str)),
        _ => {}
    }
    // Every statement in the edits block is an edit, whatever else it builds.
    if section == Some(SectionName::Edits) && !matches!(body, Body::Blank | Body::Comment) {
        out.push("edits");
    }
    out.sort_by_key(|id| LAYER_ORDER.iter().position(|l| l == id));
    out.dedup();
    out
}

fn statements(ast: &Ast) -> Vec<Statement<'_>> {
    let mut section = None;
    ast.nodes
        .iter()
        .map(|node| {
            if let Body::Section { name } = &node.body {
                section = Some(*name);
            }
            Statement {
                node,
                section,
                layers: layers_of(&node.body, section),
            }
        })
        .collect()
}

/// The runs of lines `owned` picks, as `[first, last]`. A blank line or a comment between two owned
/// lines belongs to the run; a line of another layer ends it.
fn runs(statements: &[Statement<'_>], owned: impl Fn(&Statement<'_>) -> bool) -> Vec<[u32; 2]> {
    let mut out: Vec<[u32; 2]> = Vec::new();
    let mut open: Option<[u32; 2]> = None;
    for statement in statements {
        let line = u32::try_from(statement.node.line).unwrap_or(u32::MAX);
        if owned(statement) {
            match &mut open {
                Some(run) => run[1] = line,
                None => open = Some([line, line]),
            }
        } else if !is_neutral(&statement.node.body) {
            out.extend(open.take());
        }
    }
    out.extend(open);
    out
}

/// The layer that owns what a statement sets: its first layer other than `edits`, else `edits`. A
/// cell belongs to the layer of the last statement that wrote it, so a tile painted into the `edits`
/// block belongs to `edits`, and an exit painted there belongs to `markers`.
fn primary(layers: &[&'static str]) -> Option<&'static str> {
    layers
        .iter()
        .copied()
        .find(|id| *id != "edits")
        .or_else(|| layers.first().copied())
}

/// The owning layer of each statement, by its line.
fn owners_by_line(statements: &[Statement<'_>]) -> HashMap<usize, &'static str> {
    statements
        .iter()
        .filter_map(|s| primary(&s.layers).map(|id| (s.node.line, id)))
        .collect()
}

/// The lines of every statement that belongs to one of the `hidden` layers, which the masked
/// rasteriser leaves out.
pub(crate) fn lines_in(ast: &Ast, hidden: &[String]) -> HashSet<usize> {
    statements(ast)
        .iter()
        .filter(|s| s.layers.iter().any(|id| hidden.iter().any(|h| h == id)))
        .map(|s| s.node.line)
        .collect()
}

/// Which layer wrote each cell of the world, as an index into `sections` (by the statement that
/// last set it, from the rasteriser's own line record); [`NO_SECTION`] where no statement did or
/// the layer has no row.
pub(crate) fn cell_sections(ast: &Ast, world: &World, sections: &[ViewSection]) -> Vec<u8> {
    let all = statements(ast);
    let owner = owners_by_line(&all);
    let row: HashMap<&str, u8> = sections
        .iter()
        .enumerate()
        .filter_map(|(i, s)| u8::try_from(i).ok().map(|i| (s.id.as_str(), i)))
        .collect();
    world
        .lines
        .iter()
        .map(|line| {
            owner
                .get(line)
                .and_then(|id| row.get(id))
                .copied()
                .unwrap_or(NO_SECTION)
        })
        .collect()
}

/// The `cell_sections` value of a cell no statement wrote.
pub const NO_SECTION: u8 = u8::MAX;

/// Every cell a `paint` or `clear` covers inside a level of `width` by `height`, as `y * width + x`.
fn covered(xs: &[Range], ys: &[Range], width: usize, height: usize) -> Vec<usize> {
    let span = |ranges: &[Range], limit: usize| -> Vec<usize> {
        let mut out = Vec::new();
        for r in ranges {
            let (lo, hi) = (r.lo.max(0.0), r.hi.min(limit as f64 - 1.0));
            let mut at = lo.ceil();
            while at <= hi {
                out.push(at as usize);
                at += 1.0;
            }
        }
        out
    };
    let (columns, rows) = (span(xs, width), span(ys, height));
    rows.iter()
        .flat_map(|y| columns.iter().map(move |x| y * width + x))
        .collect()
}

/// The layers that own the cells a paint or clear statement covers in `world`, which is the level
/// as it stands without that statement (before it was added, or after it was taken away).
fn owners_beneath(
    body: &Body,
    world: &World,
    owner_of_line: &HashMap<usize, &'static str>,
) -> Vec<&'static str> {
    let (Body::Paint { xs, ys, .. } | Body::Clear { xs, ys }) = body else {
        return Vec::new();
    };
    let mut owners: Vec<&'static str> = Vec::new();
    for cell in covered(xs, ys, world.w, world.h) {
        if let Some(id) = world
            .lines
            .get(cell)
            .and_then(|line| owner_of_line.get(line))
        {
            if !owners.contains(id) {
                owners.push(id);
            }
        }
    }
    owners
}

fn crystal_cells(ast: &Ast) -> u32 {
    let mut cells = 0.0_f64;
    for node in &ast.nodes {
        if let Body::Crystal { xs } = &node.body {
            for r in xs {
                if r.hi >= r.lo {
                    cells += (r.hi - r.lo).floor() + 1.0;
                }
            }
        }
    }
    cells.min(f64::from(u32::MAX)) as u32
}

/// The layers of a script, in panel order, for the view. `items`, `enemies` and `markers` are the
/// counts of the things the level builds, since a thing belongs to its layer wherever it is
/// written.
pub(crate) fn sections(
    ast: &Ast,
    items: usize,
    enemies: usize,
    markers: usize,
) -> Vec<ViewSection> {
    let all = statements(ast);
    let mut out = Vec::new();
    for id in LAYER_ORDER {
        let header = SectionName::from_word(id);
        let derived = header.is_none();
        let has_header = header.is_some_and(|name| {
            all.iter()
                .any(|s| matches!(&s.node.body, Body::Section { name: n } if *n == name))
        });
        let owned = |s: &Statement<'_>| match header {
            // The whole block, comments and all, however its statements read.
            Some(SectionName::Edits) => s.section == Some(SectionName::Edits),
            Some(_) => s.layers.contains(&id) && s.section == header,
            None => s.layers.contains(&id),
        };
        let lines = runs(&all, owned);
        if !has_header && (!derived || lines.is_empty()) {
            continue;
        }
        let statement_count = all
            .iter()
            .filter(|s| {
                owned(s)
                    && !is_neutral(&s.node.body)
                    && !matches!(s.node.body, Body::Section { .. })
            })
            .count();
        let (kind, affects, count) = match id {
            "terrain" | "blocks" => (
                ViewSectionKind::Tiles,
                ViewSectionAffects::Cells,
                statement_count,
            ),
            "treats" => (ViewSectionKind::Things, ViewSectionAffects::Things, items),
            "enemies" => (ViewSectionKind::Things, ViewSectionAffects::Things, enemies),
            "edits" => (
                ViewSectionKind::Things,
                ViewSectionAffects::Cells,
                statement_count,
            ),
            "walls" => (
                ViewSectionKind::Derived,
                ViewSectionAffects::Cells,
                statement_count,
            ),
            "crystals" => (
                ViewSectionKind::Derived,
                ViewSectionAffects::Cells,
                crystal_cells(ast) as usize,
            ),
            _ => (
                ViewSectionKind::Derived,
                ViewSectionAffects::Things,
                markers,
            ),
        };
        out.push(ViewSection {
            id: id.to_owned(),
            label: label(id).to_owned(),
            kind,
            affects,
            lines,
            count: u32::try_from(count).unwrap_or(u32::MAX),
        });
    }
    out
}

/// The statements that are not blank or a comment, with their section.
fn meaningful(statements: Vec<Statement<'_>>) -> Vec<Statement<'_>> {
    statements
        .into_iter()
        .filter(|s| !is_neutral(&s.node.body))
        .collect()
}

fn same(a: &Statement<'_>, b: &Statement<'_>) -> bool {
    a.section == b.section && a.node.body == b.node.body
}

/// The largest middle (old statements times new) compared exactly; past it every statement in the
/// middle counts as changed.
const MAX_COMPARE: usize = 4_000_000;

/// The layers a change from the text `old` to the text `new` touches, in panel order: those of every
/// statement that was removed or added, compared statement by statement (a comment, a blank line
/// or a trailing comment changes nothing). A statement that moved to another section counts as
/// removed from one and added to the other.
pub fn layers_changed(old: &str, new: &str) -> Vec<String> {
    if old == new {
        return Vec::new();
    }
    let (old_parsed, new_parsed) = (parse(old), parse(new));
    let old_all = meaningful(statements(&old_parsed.ast));
    let new_all = meaningful(statements(&new_parsed.ast));
    let prefix = old_all
        .iter()
        .zip(&new_all)
        .take_while(|(a, b)| same(a, b))
        .count();
    let room = old_all.len().min(new_all.len()) - prefix;
    let suffix = old_all
        .iter()
        .rev()
        .zip(new_all.iter().rev())
        .take(room)
        .take_while(|(a, b)| same(a, b))
        .count();
    let old_mid = &old_all[prefix..old_all.len() - suffix];
    let new_mid = &new_all[prefix..new_all.len() - suffix];

    // Which statements of each middle a longest common subsequence leaves unmatched.
    let (mut old_kept, mut new_kept) = (vec![false; old_mid.len()], vec![false; new_mid.len()]);
    if old_mid.len().saturating_mul(new_mid.len()) <= MAX_COMPARE {
        let (n, m) = (old_mid.len(), new_mid.len());
        let mut table = vec![0u32; (n + 1) * (m + 1)];
        let at = |i: usize, j: usize| i * (m + 1) + j;
        for i in (0..n).rev() {
            for j in (0..m).rev() {
                table[at(i, j)] = if same(&old_mid[i], &new_mid[j]) {
                    table[at(i + 1, j + 1)] + 1
                } else {
                    table[at(i + 1, j)].max(table[at(i, j + 1)])
                };
            }
        }
        let (mut i, mut j) = (0, 0);
        while i < n && j < m {
            if same(&old_mid[i], &new_mid[j]) {
                old_kept[i] = true;
                new_kept[j] = true;
                i += 1;
                j += 1;
            } else if table[at(i + 1, j)] >= table[at(i, j + 1)] {
                i += 1;
            } else {
                j += 1;
            }
        }
    }
    let mut touched: Vec<&'static str> = Vec::new();
    // A paint or clear that was added or taken away changes the cells it covers, which belong to
    // the layers that wrote them: those layers are touched too (the lock is by effect).
    let old_world = rasterise(&old_parsed.ast);
    let new_world = rasterise(&new_parsed.ast);
    let old_owner = owners_by_line(&statements(&old_parsed.ast));
    let new_owner = owners_by_line(&statements(&new_parsed.ast));
    for (statement, kept) in old_mid.iter().zip(&old_kept) {
        if !kept {
            touched.extend(statement.layers.iter().copied());
            // Taken away: the cells go back to whatever the rest of the script made them.
            if let Some(world) = &new_world {
                touched.extend(owners_beneath(&statement.node.body, world, &new_owner));
            }
        }
    }
    for (statement, kept) in new_mid.iter().zip(&new_kept) {
        if !kept {
            touched.extend(statement.layers.iter().copied());
            // Added: it covers cells the script made before it.
            if let Some(world) = &old_world {
                touched.extend(owners_beneath(&statement.node.body, world, &old_owner));
            }
        }
    }
    LAYER_ORDER
        .into_iter()
        .filter(|id| touched.contains(id))
        .map(str::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use fizz_studio_language::parser::parse;

    const CRATER: &str = include_str!("../../../fixtures/fizz1/levels/crater.fizz");

    fn ids(text: &str) -> Vec<String> {
        sections(&parse(text).ast, 0, 0, 0)
            .into_iter()
            .map(|s| s.id)
            .collect()
    }

    #[test]
    fn a_level_lists_its_headers_with_the_derived_rows_in_panel_order() {
        assert_eq!(
            ids(CRATER),
            ["terrain", "walls", "blocks", "crystals", "markers", "treats", "enemies"]
        );
    }

    #[test]
    fn a_header_leaves_out_the_lines_a_derived_row_takes() {
        let all = sections(&parse(CRATER).ast, 7, 9, 3);
        let find = |id: &str| all.iter().find(|s| s.id == id).unwrap().clone();
        // The blocks header is line 18; crater.fizz holds red-door (21), exit (23) and crystal (24).
        let lines: Vec<&str> = CRATER.lines().collect();
        let line_of = |needle: &str| {
            lines
                .iter()
                .position(|l| l.trim_start().starts_with(needle))
                .unwrap() as u32
                + 1
        };
        let blocks = find("blocks");
        assert_eq!(blocks.lines[0][0], line_of("blocks"));
        for taken in [line_of("red-door"), line_of("exit"), line_of("crystal")] {
            assert!(
                !blocks.lines.iter().any(|[a, b]| (*a..=*b).contains(&taken)),
                "blocks still owns line {taken}: {:?}",
                blocks.lines
            );
        }
        assert_eq!(find("crystals").lines, [[line_of("crystal"); 2]]);
        assert_eq!(find("crystals").count, 7);
        assert_eq!(find("markers").count, 3);
        assert_eq!(find("walls").lines, [[line_of("walls"); 2]]);
        assert_eq!(find("treats").count, 7);
        assert_eq!(find("enemies").count, 9);
        assert_eq!(find("terrain").kind, ViewSectionKind::Tiles);
        assert_eq!(find("markers").affects, ViewSectionAffects::Things);
    }

    #[test]
    fn a_script_without_a_section_has_no_rows() {
        assert!(ids("level \"T\" 40x20 ground=4 id=t\nstart 3,4\n").is_empty());
    }

    fn append(line: &str) -> String {
        format!("{CRATER}\nedits\n  {line}\n")
    }

    #[test]
    fn an_edit_touches_edits_and_the_layer_of_what_it_builds() {
        let touched = |line: &str| layers_changed(CRATER, &append(line));
        assert_eq!(touched("place cheezie x=5 y=9"), ["treats", "edits"]);
        assert_eq!(touched("row choc x=2..4 y=6"), ["treats", "edits"]);
        assert_eq!(touched("drone x=8 y=9"), ["enemies", "edits"]);
        assert_eq!(touched("paint exit x=5 y=9"), ["markers", "edits"]);
        assert_eq!(touched("paint grass x=5 y=9"), ["edits"]);
        assert_eq!(touched("clear x=5 y=9"), ["edits"]);
    }

    #[test]
    fn a_change_to_a_written_line_touches_the_layer_it_sits_in() {
        let changed = CRATER.replace("soda        x=36 y=5", "soda        x=37 y=5");
        assert_eq!(layers_changed(CRATER, &changed), ["treats"]);
        let changed = CRATER.replace("flat 14, up 2", "flat 15, up 2");
        assert_eq!(layers_changed(CRATER, &changed), ["terrain"]);
        let changed = CRATER.replace("red-door x=171", "red-door x=172");
        assert_eq!(layers_changed(CRATER, &changed), ["markers"]);
        let changed = CRATER.replace("crystal  x=10,", "crystal  x=11,");
        assert_eq!(layers_changed(CRATER, &changed), ["crystals"]);
    }

    #[test]
    fn comments_blank_lines_and_the_header_change_no_layer() {
        let changed = CRATER.replace("start 3,4", "// moved\nstart 3,4\n\n");
        assert!(layers_changed(CRATER, &changed).is_empty());
        let changed = CRATER.replace("id=crater", "id=crater2");
        assert!(layers_changed(CRATER, &changed).is_empty());
        let changed = CRATER.replace("x=36 y=5", "x=36 y=5 // new note");
        assert!(layers_changed(CRATER, &changed).is_empty());
    }

    #[test]
    fn a_statement_moved_to_another_section_touches_both() {
        let moved = CRATER
            .replace("  soda        x=36 y=5\n", "")
            .replace("enemies\n", "enemies\n  soda        x=36 y=5\n");
        // The soda is a treat wherever it is written, but the line left treats and entered enemies.
        assert_eq!(layers_changed(CRATER, &moved), ["treats", "enemies"]);
    }

    #[test]
    fn reordering_statements_touches_their_layer() {
        let swapped = CRATER.replace(
            "  soda        x=36 y=5\n  row choc    x=46..52 y=8 by=3\n",
            "  row choc    x=46..52 y=8 by=3\n  soda        x=36 y=5\n",
        );
        assert_eq!(layers_changed(CRATER, &swapped), ["treats"]);
    }
}
