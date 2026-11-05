// Printer for Fizz scripts: parsed lines print as written; nodes built in memory print canonically.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::ast::{Ast, Body, Node, Num, Range, Side};
use crate::js::{number_string, trim_end};

pub fn range_text(r: &Range) -> String {
    if r.lo == r.hi {
        number_string(r.lo)
    } else {
        format!("{}..{}", number_string(r.lo), number_string(r.hi))
    }
}

pub fn ranges_text(rs: &[Range]) -> String {
    rs.iter().map(range_text).collect::<Vec<_>>().join(",")
}

fn pair_text(pair: &[Num; 2]) -> String {
    format!("{},{}", pair[0].text, pair[1].text)
}

/// The canonical text of a node, for nodes that have no original line.
pub fn format_node(n: &Node) -> String {
    let tail = match n.comment.as_deref() {
        Some(comment) if !comment.is_empty() => format!("  // {comment}"),
        _ => String::new(),
    };
    let ind = "  ";
    match &n.body {
        Body::Blank => String::new(),
        Body::Comment => {
            trim_end(&format!("// {}", n.comment.as_deref().unwrap_or(""))).to_string()
        }
        Body::Error { .. } => n.raw.clone().unwrap_or_default(),
        Body::Level {
            name,
            w,
            h,
            ground,
            id,
        } => format!(
            "level \"{name}\" {}x{} ground={} id={id}{tail}",
            number_string(*w),
            number_string(*h),
            number_string(*ground)
        ),
        Body::Theme { name } => format!("theme {name}{tail}"),
        Body::Area { name } => format!("area {name}{tail}"),
        Body::Start { x, y } => format!("start {},{}{tail}", x.text, y.text),
        Body::Arena { x, floor } => {
            format!("arena x={} floor={}{tail}", range_text(x), floor.text)
        }
        Body::Walls => format!("walls{tail}"),
        Body::Section { name } => format!("{}{tail}", name.as_str()),
        Body::Segs { segs } => {
            let list: Vec<String> = segs
                .iter()
                .map(|s| format!("{} {}", s.seg, number_string(s.n)))
                .collect();
            format!("{ind}{}{tail}", list.join(", "))
        }
        Body::Liquid { tile } => format!("{ind}liquid {tile}{tail}"),
        Body::Tile { tile, x, y } => {
            format!("{ind}{tile} x={} y={}{tail}", range_text(x), range_text(y))
        }
        Body::Plat { x, y } => {
            format!(
                "{ind}plat x={} y={}{tail}",
                range_text(x),
                number_string(*y)
            )
        }
        Body::Hover {
            from,
            to,
            speed,
            size,
            dwell,
        } => {
            let size = size
                .as_ref()
                .map(|s| format!(" size={}x{}", s[0].text, s[1].text))
                .unwrap_or_default();
            let dwell = dwell
                .as_ref()
                .map(|d| format!(" dwell={}", d.text))
                .unwrap_or_default();
            format!(
                "{ind}hover from={} to={} speed={}{size}{dwell}{tail}",
                pair_text(from),
                pair_text(to),
                speed.text
            )
        }
        Body::Channel { chs, on } => {
            let list: Vec<String> = chs.iter().map(u8::to_string).collect();
            format!(
                "{ind}channel {} {}{tail}",
                list.join(","),
                if *on { "on" } else { "off" }
            )
        }
        Body::Crystal { xs } => format!("{ind}crystal x={}{tail}", ranges_text(xs)),
        Body::Rect { op, x, y } => format!(
            "{ind}{} x={} y={}{tail}",
            op.as_str(),
            range_text(x),
            range_text(y)
        ),
        Body::Mural { x, y } => format!(
            "{ind}mural x={} y={}{tail}",
            number_string(*x),
            number_string(*y)
        ),
        Body::Ladder { x, y } => {
            format!(
                "{ind}ladder x={} y={}{tail}",
                number_string(*x),
                range_text(y)
            )
        }
        Body::Stairs { side, x, y, count } => {
            let side = match side {
                Side::Right => "right",
                Side::Left => "left",
            };
            format!(
                "{ind}stairs-{side} x={} y={} count={}{tail}",
                number_string(*x),
                number_string(*y),
                number_string(*count)
            )
        }
        Body::VineNook {
            x,
            foot,
            shelf,
            dir,
            depth,
            h,
        } => format!(
            "{ind}vine-nook x={} foot={} shelf={} dir={} depth={} h={}{tail}",
            number_string(*x),
            number_string(*foot),
            number_string(*shelf),
            number_string(*dir),
            number_string(*depth),
            number_string(*h)
        ),
        Body::Item { kind, xs, y } => {
            format!(
                "{ind}{kind} x={} y={}{tail}",
                ranges_text(xs),
                number_string(*y)
            )
        }
        Body::Row { kind, x, y, by } => {
            let by = if *by == 1.0 {
                String::new()
            } else {
                format!(" by={}", number_string(*by))
            };
            format!(
                "{ind}row {kind} x={} y={}{by}{tail}",
                range_text(x),
                number_string(*y)
            )
        }
        Body::PogoCache { x, rise } => format!(
            "{ind}pogo-cache x={} rise={}{tail}",
            range_text(x),
            number_string(*rise)
        ),
        Body::Spawn {
            kind,
            xs,
            y,
            dir,
            ride,
        } => {
            let xs: Vec<&str> = xs.iter().map(|x| x.text.as_str()).collect();
            let mut line = format!("{ind}{kind} x={}", xs.join(","));
            if let Some(y) = y {
                line.push_str(&format!(" y={}", y.text));
            }
            if let Some(dir) = dir {
                line.push_str(&format!(" dir={}", dir.text));
            }
            if *ride {
                line.push_str(" ride");
            }
            line + &tail
        }
        Body::Paint { tile, xs, ys } => format!(
            "{ind}paint {tile} x={} y={}{tail}",
            ranges_text(xs),
            ranges_text(ys)
        ),
        Body::Clear { xs, ys } => format!(
            "{ind}clear x={} y={}{tail}",
            ranges_text(xs),
            ranges_text(ys)
        ),
        Body::Place { kind, xs, ys } => format!(
            "{ind}place {kind} x={} y={}{tail}",
            ranges_text(xs),
            ranges_text(ys)
        ),
    }
}

/// Script text for an AST. A parsed script prints exactly as it was read, comments and blank lines
/// included.
pub fn print(ast: &Ast) -> String {
    ast.nodes
        .iter()
        .map(|n| n.raw.clone().unwrap_or_else(|| format_node(n)))
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn nodes_built_in_memory_print_canonically() {
        let source = "level \"T\" 40x20 ground=4 id=crater  // hi\nstart 3,4\nterrain\n  flat 40, up 2\nblocks\n  block x=1..2 y=3\n  hover from=1,5 to=4,5 speed=0.3 size=3x0.5 dwell=2\n  channel 1,2 on\ntreats\n  row choc x=2..8 y=5 by=2\nenemies\n  drone x=1.5,2 y=7.5 dir=1\n";
        let parsed = parse(source);
        assert!(parsed.errors.is_empty());
        let rebuilt = Ast {
            nodes: parsed
                .ast
                .nodes
                .into_iter()
                .map(|n| Node { raw: None, ..n })
                .collect(),
        };
        assert_eq!(print(&rebuilt), source);
    }
}
