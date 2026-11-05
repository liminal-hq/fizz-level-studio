// Appending studio edits to a script without touching any line already written.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::ast::{Ast, Body, Node, Num, Range, SectionName};

/// One edit the studio adds to the `edits` block. `xs` by `ys` is a cross product, as in the language.
#[derive(Debug, Clone, PartialEq)]
pub enum Edit {
    Paint {
        tile: String,
        xs: Vec<Range>,
        ys: Vec<Range>,
    },
    Clear {
        xs: Vec<Range>,
        ys: Vec<Range>,
    },
    Place {
        kind: String,
        xs: Vec<Range>,
        ys: Vec<Range>,
    },
    /// A run of items along one row: `row ITEM x=a..b y=r [by=n]`.
    Row {
        kind: String,
        x: Range,
        y: f64,
        by: f64,
    },
    /// An enemy or prop on a cell: `drone x=88 y=7`.
    Spawn {
        kind: String,
        x: u32,
        y: u32,
    },
}

fn whole(n: u32) -> Num {
    Num {
        value: f64::from(n),
        text: n.to_string(),
    }
}

fn to_body(edit: &Edit) -> Body {
    match edit {
        Edit::Paint { tile, xs, ys } => Body::Paint {
            tile: tile.clone(),
            xs: xs.clone(),
            ys: ys.clone(),
        },
        Edit::Clear { xs, ys } => Body::Clear {
            xs: xs.clone(),
            ys: ys.clone(),
        },
        Edit::Place { kind, xs, ys } => Body::Place {
            kind: kind.clone(),
            xs: xs.clone(),
            ys: ys.clone(),
        },
        Edit::Row { kind, x, y, by } => Body::Row {
            kind: kind.clone(),
            x: *x,
            y: *y,
            by: *by,
        },
        Edit::Spawn { kind, x, y } => Body::Spawn {
            kind: kind.clone(),
            xs: vec![whole(*x)],
            y: Some(whole(*y)),
            dir: None,
            ride: false,
        },
    }
}

/// Returns a new AST with `edits` added at the end of the edits block, creating the block (after one
/// blank line) when there is none. Existing nodes are copied unchanged, so hand-written lines print
/// exactly as before. Trailing blank lines stay at the end of the file.
pub fn append_edits(ast: &Ast, edits: &[Edit]) -> Ast {
    if edits.is_empty() {
        return ast.clone();
    }
    let at = ast
        .nodes
        .iter()
        .rposition(|n| n.body != Body::Blank)
        .map_or(0, |last| last + 1);
    let has_block = ast.nodes.iter().any(|n| {
        matches!(
            n.body,
            Body::Section {
                name: SectionName::Edits
            }
        )
    });
    let mut added = Vec::new();
    if !has_block {
        added.push(Body::Blank);
        added.push(Body::Section {
            name: SectionName::Edits,
        });
    }
    added.extend(edits.iter().map(to_body));

    let mut nodes: Vec<Node> = ast.nodes[..at].to_vec();
    for (i, body) in added.into_iter().enumerate() {
        nodes.push(Node {
            body,
            line: at + i + 1,
            raw: None,
            comment: None,
        });
    }
    for n in &ast.nodes[at..] {
        let mut shifted = n.clone();
        shifted.line = nodes.len() + 1;
        nodes.push(shifted);
    }
    Ast { nodes }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;
    use crate::printer::print;

    const BASE: &str = "level \"T\" 40x20 ground=4 id=crater\nstart 3,4\n\nterrain\n  flat 40\n";

    fn r(n: f64) -> Range {
        Range { lo: n, hi: n }
    }

    #[test]
    fn creates_the_block_after_one_blank_line() {
        let ast = append_edits(
            &parse(BASE).ast,
            &[Edit::Paint {
                tile: "one-way".into(),
                xs: vec![r(26.0), r(28.0)],
                ys: vec![r(9.0)],
            }],
        );
        assert_eq!(
            print(&ast),
            format!("{BASE}\nedits\n  paint one-way x=26,28 y=9\n")
        );
    }

    #[test]
    fn writes_a_row_with_a_step_and_an_enemy_with_a_cell() {
        let ast = append_edits(
            &parse(BASE).ast,
            &[
                Edit::Row {
                    kind: "cheezie".into(),
                    x: Range { lo: 5.0, hi: 11.0 },
                    y: 7.0,
                    by: 3.0,
                },
                Edit::Row {
                    kind: "choc".into(),
                    x: Range { lo: 2.0, hi: 4.0 },
                    y: 6.0,
                    by: 1.0,
                },
                Edit::Spawn {
                    kind: "drone".into(),
                    x: 8,
                    y: 9,
                },
            ],
        );
        let text = print(&ast);
        assert_eq!(
            text,
            format!(
                "{BASE}\nedits\n  row cheezie x=5..11 y=7 by=3\n  row choc x=2..4 y=6\n  drone x=8 y=9\n"
            )
        );
        assert!(parse(&text).errors.is_empty());
    }

    #[test]
    fn no_edits_changes_nothing() {
        let ast = parse(BASE).ast;
        assert_eq!(append_edits(&ast, &[]), ast);
    }
}
