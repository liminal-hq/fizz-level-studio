// Overworld scripts: a lossless parser and printer, ported from `overworld.ts`.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashSet;

use crate::args::{parse_num, tighten_commas, to_number, Args};
use crate::ast::{Num, Range};
use crate::errors::{suggestion, Arg, Diagnostic, Fault, Key, Noun, What};
use crate::js::{
    is_line_terminator, is_space, js_number, number_string, serialize_number, split_first_space,
    trim,
};
use crate::parser::header_line;
use crate::tables::{self, has, level_def, words, AREAS, TILES};
use serde::{Serialize, Serializer};

const POINT_WORDS: [&str; 4] = ["level", "tele", "saucer", "sign"];

/// The sections an overworld script has.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OwSection {
    Blocks,
    Points,
    Edits,
}

impl OwSection {
    fn as_str(self) -> &'static str {
        match self {
            OwSection::Blocks => "blocks",
            OwSection::Points => "points",
            OwSection::Edits => "edits",
        }
    }

    fn from_word(word: &str) -> Option<OwSection> {
        [OwSection::Blocks, OwSection::Points, OwSection::Edits]
            .into_iter()
            .find(|s| s.as_str() == word)
    }
}

struct Js(f64);

impl Serialize for Js {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serialize_number(&self.0, serializer)
    }
}

fn pair<S: Serializer>(p: &[f64; 2], serializer: S) -> Result<S::Ok, S::Error> {
    [Js(p[0]), Js(p[1])].serialize(serializer)
}

/// What an overworld line says. Serialises with a `type` tag, to the JSON the TypeScript parser records.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum OwBody {
    Blank,
    Comment,
    Error {
        code: String,
    },
    Overworld {
        name: String,
        #[serde(serialize_with = "serialize_number")]
        w: f64,
        #[serde(serialize_with = "serialize_number")]
        h: f64,
        id: String,
    },
    Start {
        x: Num,
        y: Num,
    },
    Area {
        area: String,
        x: Range,
        y: Range,
    },
    Section {
        name: OwSection,
    },
    Tile {
        tile: String,
        x: Range,
        y: Range,
    },
    Path {
        #[serde(serialize_with = "pair")]
        from: [f64; 2],
        #[serde(serialize_with = "pair")]
        to: [f64; 2],
    },
    Scatter,
    Level {
        slug: String,
        at: [Num; 2],
        req: Vec<String>,
        big: bool,
        hidden: bool,
    },
    Tele {
        label: String,
        at: [Num; 2],
        with: String,
        req: Vec<String>,
        hidden: bool,
    },
    Saucer {
        at: [Num; 2],
    },
    Sign {
        #[serde(serialize_with = "serialize_number")]
        n: f64,
        at: [Num; 2],
    },
}

/// A line of an overworld script: what it says, where it is, and its original text.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OwNode {
    #[serde(flatten)]
    pub body: OwBody,
    pub line: usize,
    pub raw: Option<String>,
    /// The trailing `// ...` comment, without the slashes.
    pub comment: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OwAst {
    pub nodes: Vec<OwNode>,
}

/// The parse of one overworld script: the lossless AST, and every error found, in line order.
#[derive(Debug, Clone, PartialEq)]
pub struct OwParse {
    pub ast: OwAst,
    pub errors: Vec<Diagnostic>,
}

/// True when a script's first statement is an `overworld` header.
pub fn is_overworld(text: &str) -> bool {
    for raw in text.split('\n') {
        let code = trim(strip_comment(raw));
        if code.is_empty() {
            continue;
        }
        let Some(rest) = code.strip_prefix("overworld") else {
            return false;
        };
        return rest.chars().next().is_some_and(is_space);
    }
    false
}

/// `raw.replace(/\/\/.*$/, '')`: the first `//` whose tail holds no line terminator is cut off, with
/// everything after it.
fn strip_comment(raw: &str) -> &str {
    let mut from = 0;
    while let Some(found) = raw[from..].find("//") {
        let at = from + found;
        if !raw[at + 2..].chars().any(is_line_terminator) {
            return &raw[..at];
        }
        from = at + 1;
    }
    raw
}

struct Header {
    w: f64,
    h: f64,
    line: usize,
}

struct Tele {
    label: String,
    with: String,
    line: usize,
}

struct State {
    section: Option<OwSection>,
    header: Option<Header>,
    seen: HashSet<&'static str>,
    labels: Vec<String>,
    tele: Vec<Tele>,
}

type Parsed<T> = Result<T, Fault>;

fn fail<T>(code: &'static str, key: Key, args: Vec<Arg>) -> Parsed<T> {
    Err(Fault::new(code, key, args))
}

/// Finds the `//` that starts a trailing comment, ignoring any inside a quoted overworld name.
fn split_comment(raw: &str) -> (&str, Option<String>) {
    let bytes = raw.as_bytes();
    let mut quoted = false;
    for i in 0..bytes.len().saturating_sub(1) {
        if bytes[i] == b'"' {
            quoted = !quoted;
        }
        if !quoted && bytes[i] == b'/' && bytes[i + 1] == b'/' {
            return (&raw[..i], Some(trim(&raw[i + 2..]).to_string()));
        }
    }
    (raw, None)
}

fn inside_map(st: &State, axis: char, lo: f64, hi: f64) -> Parsed<()> {
    let Some(header) = &st.header else {
        return Ok(());
    };
    let max = (if axis == 'x' { header.w } else { header.h }) - 1.0;
    if lo < 0.0 || hi > max {
        let span = if lo == hi {
            number_string(lo)
        } else {
            format!("{}..{}", number_string(lo), number_string(hi))
        };
        return fail(
            "E013",
            Key::OutsideOverworld,
            vec![
                axis.to_string().into(),
                span.into(),
                number_string(max).into(),
            ],
        );
    }
    Ok(())
}

fn unknown_name(noun: Noun, name: &str, candidates: &[&str]) -> Fault {
    let [nearest, list] = suggestion(name, candidates);
    Fault::new(
        "E002",
        Key::UnknownName,
        vec![noun.into(), name.into(), nearest, list],
    )
}

fn level_ids() -> Vec<&'static str> {
    tables::LEVEL_IDS.iter().map(|d| d.id).collect()
}

fn req_list(a: &mut Args) -> Parsed<Vec<String>> {
    if !a.has("req") {
        return Ok(Vec::new());
    }
    let text = a.text("req", "crater,meteor-mesa")?;
    let names: Vec<String> = text.split(',').map(str::to_string).collect();
    for n in &names {
        if n != "secret" && level_def(n).is_none() {
            let mut candidates = level_ids();
            candidates.push("secret");
            return Err(unknown_name(Noun::Requirement, n, &candidates));
        }
    }
    Ok(names)
}

fn point(a: &mut Args, key: &str, st: &State) -> Parsed<[Num; 2]> {
    let at = a.pair(key, "14,6")?;
    for (axis, n) in [('x', &at[0]), ('y', &at[1])] {
        let cell = n.value.floor();
        inside_map(st, axis, cell, cell)?;
    }
    Ok(at)
}

fn parse_header(body: &str, st: &mut State) -> Parsed<OwBody> {
    let Some((name, w_text, h_text, fields)) = header_line("overworld", body) else {
        st.header = Some(Header {
            w: f64::INFINITY,
            h: f64::INFINITY,
            line: 0,
        });
        return fail("E004", Key::OverworldHeaderMalformed, vec![]);
    };
    let (w, h) = (to_number(w_text), to_number(h_text));
    st.header = Some(Header { w, h, line: 0 });
    let mut a = Args::new(fields)?;
    let id = a.text("id", "main")?;
    a.finish("id=NAME")?;
    if w < 3.0 || h < 3.0 {
        return fail(
            "E015",
            Key::OverworldTooSmall,
            vec![number_string(w).into(), number_string(h).into()],
        );
    }
    Ok(OwBody::Overworld {
        name: name.to_string(),
        w,
        h,
        id,
    })
}

/// The tile words a `blocks` line takes, for the "unknown statement" fix.
fn block_words() -> Vec<&'static str> {
    let mut list: Vec<&'static str> = words(TILES).into_iter().filter(|t| *t != "empty").collect();
    list.extend(["path", "scatter"]);
    list
}

fn parse_start(rest: &str, st: &mut State) -> Parsed<OwBody> {
    let tight = tighten_commas(rest);
    let parts: Vec<&str> = trim(&tight).split(',').collect();
    if parts.len() != 2 || parts.iter().any(|p| p.is_empty()) {
        return fail("E004", Key::OverworldStartNeedsTwoNumbers, vec![]);
    }
    if st.seen.contains("start") {
        return fail("E006", Key::SecondTopLine, vec!["start".into()]);
    }
    st.seen.insert("start");
    let x = parse_num(parts[0], What::StartX)?;
    let y = parse_num(parts[1], What::StartY)?;
    Ok(OwBody::Start { x, y })
}

fn parse_area(rest: &str, st: &State) -> Parsed<OwBody> {
    let mut a = Args::new(rest)?;
    let name = a.word(What::AreaName, "area crater-fields x=0..24 y=0..22")?;
    if !AREAS.contains(&name.as_str()) {
        return Err(unknown_name(Noun::Area, &name, AREAS));
    }
    let x = a.range("x", "0..24")?;
    let y = a.range("y", "0..22")?;
    a.finish("AREA x=A..B y=A..B")?;
    inside_map(st, 'x', x.lo, x.hi)?;
    inside_map(st, 'y', y.lo, y.hi)?;
    Ok(OwBody::Area { area: name, x, y })
}

fn parse_body(code: &str, st: &mut State) -> Parsed<OwBody> {
    let body = trim(code);
    let (word, rest) = match split_first_space(body) {
        Some((word, rest)) => (word, trim(rest)),
        None => (body, ""),
    };

    if let (Some(section), true) = (OwSection::from_word(word), rest.is_empty()) {
        if st.section == Some(OwSection::Edits) {
            return fail("E008", Key::SectionAfterEdits, vec![word.into()]);
        }
        if st.seen.contains(word) && word == "edits" {
            return fail("E006", Key::SecondEditsBlock, vec![]);
        }
        st.seen.insert(section.as_str());
        st.section = Some(section);
        return Ok(OwBody::Section { name: section });
    }
    if word == "overworld" {
        if st.header.is_some() {
            return fail("E006", Key::SecondOverworldHeader, vec![]);
        }
        return parse_header(body, st);
    }
    if st.header.is_none() {
        return fail("E007", Key::StatementBeforeOverworld, vec![]);
    }
    let mut a = Args::new(rest)?;
    match word {
        "start" => return parse_start(rest, st),
        "area" => return parse_area(rest, st),
        _ => {}
    }
    let Some(sec) = st.section else {
        return fail("E008", Key::OverworldBeforeAnySection, vec![word.into()]);
    };
    // `path` is also a tile word, so `path from= to=` draws a route and `path x= y=` fills tiles.
    let route = word == "path" && a.has("from");
    let wrong_section = |home: &str| {
        fail(
            "E008",
            Key::WrongSection,
            vec![word.into(), home.into(), sec.as_str().into()],
        )
    };
    if !route && ((has(TILES, word) && word != "empty") || word == "paint" || word == "clear") {
        if sec == OwSection::Points {
            return wrong_section("blocks");
        }
        if word == "paint" || word == "clear" {
            return fail("E001", Key::NotInOverworld, vec![word.into()]);
        }
        let x = a.range("x", "24..25")?;
        let y = a.range("y", "0..43")?;
        a.finish("x=A..B y=A..B")?;
        inside_map(st, 'x', x.lo, x.hi)?;
        inside_map(st, 'y', y.lo, y.hi)?;
        return Ok(OwBody::Tile {
            tile: word.to_string(),
            x,
            y,
        });
    }
    if route || word == "scatter" {
        if sec == OwSection::Points {
            return wrong_section("blocks");
        }
        if word == "scatter" {
            a.finish("nothing")?;
            return Ok(OwBody::Scatter);
        }
        let f = a.pair("from", "8,9")?;
        let t = a.pair("to", "14,6")?;
        a.finish("from=X,Y to=X,Y")?;
        for p in [&f, &t] {
            if p[0].value.fract() != 0.0 || p[1].value.fract() != 0.0 {
                return fail("E004", Key::PathNotWhole, vec![]);
            }
            inside_map(st, 'x', p[0].value, p[0].value)?;
            inside_map(st, 'y', p[1].value, p[1].value)?;
        }
        return Ok(OwBody::Path {
            from: [f[0].value, f[1].value],
            to: [t[0].value, t[1].value],
        });
    }
    if POINT_WORDS.contains(&word) {
        if sec == OwSection::Blocks {
            return wrong_section("points");
        }
        return parse_point(word, &mut a, st);
    }
    let known: Vec<&str> = if sec == OwSection::Points {
        POINT_WORDS.to_vec()
    } else {
        block_words()
    };
    let shown: Vec<&str> = known.iter().copied().take(12).collect();
    let takes = format!(
        "{}{}",
        shown.join(", "),
        if known.len() > 12 { ", ..." } else { "" }
    );
    fail(
        "E001",
        Key::OverworldUnknownInSection,
        vec![word.into(), sec.as_str().into(), takes.into()],
    )
}

fn parse_point(word: &str, a: &mut Args, st: &mut State) -> Parsed<OwBody> {
    match word {
        "level" => {
            let slug = a.word(What::LevelName, "level crater at=14,6")?;
            if level_def(&slug).is_none() {
                return Err(unknown_name(Noun::Level, &slug, &level_ids()));
            }
            let at = point(a, "at", st)?;
            let req = req_list(a)?;
            let big = a.flag("big");
            let hidden = a.flag("hidden");
            a.finish("LEVEL at=X,Y [req=LIST] [big] [hidden]")?;
            Ok(OwBody::Level {
                slug,
                at,
                req,
                big,
                hidden,
            })
        }
        "tele" => {
            let label = a.word(What::TeleporterName, "tele pad-a at=12,19 with=pad-b")?;
            if st.labels.contains(&label) {
                return fail("E006", Key::DuplicateTeleporter, vec![label.into()]);
            }
            st.labels.push(label.clone());
            let at = point(a, "at", st)?;
            let with = a.text("with", "pad-b")?;
            let req = req_list(a)?;
            let hidden = a.flag("hidden");
            a.finish("NAME at=X,Y with=NAME [req=LIST] [hidden]")?;
            st.tele.push(Tele {
                label: label.clone(),
                with: with.clone(),
                line: 0,
            });
            Ok(OwBody::Tele {
                label,
                at,
                with,
                req,
                hidden,
            })
        }
        "saucer" => {
            let at = point(a, "at", st)?;
            a.finish("at=X,Y")?;
            Ok(OwBody::Saucer { at })
        }
        _ => {
            let text = a.word(What::SignNumber, "sign 0 at=8,16")?;
            let n = js_number(&text);
            if !n.is_finite() || n.fract() != 0.0 || n < 0.0 {
                return fail("E004", Key::SignNumberBad, vec![]);
            }
            let at = point(a, "at", st)?;
            a.finish("N at=X,Y")?;
            Ok(OwBody::Sign { n, at })
        }
    }
}

/// Parses an overworld script. Every line becomes a node that keeps its original text, and every
/// line that fails becomes an `error` node plus a diagnostic; the rest of the script is still read.
pub fn parse_overworld(text: &str) -> OwParse {
    let mut st = State {
        section: None,
        header: None,
        seen: HashSet::new(),
        labels: Vec::new(),
        tele: Vec::new(),
    };
    let mut errors: Vec<Diagnostic> = Vec::new();
    let mut nodes: Vec<OwNode> = Vec::new();
    for (i, raw) in text.split('\n').enumerate() {
        let line = i + 1;
        let (code, comment) = split_comment(raw);
        let raw_text = Some(raw.to_string());
        if trim(code).is_empty() {
            let body = if trim(raw).is_empty() {
                OwBody::Blank
            } else {
                OwBody::Comment
            };
            nodes.push(OwNode {
                body,
                line,
                raw: raw_text,
                comment,
            });
            continue;
        }
        let body = match parse_body(code, &mut st) {
            Ok(body) => {
                if matches!(body, OwBody::Overworld { .. }) {
                    if let Some(header) = &mut st.header {
                        header.line = line;
                    }
                }
                if matches!(body, OwBody::Tele { .. }) {
                    if let Some(tele) = st.tele.last_mut() {
                        tele.line = line;
                    }
                }
                body
            }
            Err(fault) => {
                let body = OwBody::Error {
                    code: fault.code.to_string(),
                };
                errors.push(fault.at(line));
                body
            }
        };
        nodes.push(OwNode {
            body,
            line,
            raw: raw_text,
            comment,
        });
    }
    match &st.header {
        None => {
            if errors.is_empty() {
                errors.push(Fault::new("E007", Key::NoOverworldHeader, vec![]).at(1));
            }
        }
        Some(header) => {
            if !st.seen.contains("start") {
                errors.push(Fault::new("E010", Key::NoOverworldStart, vec![]).at(header.line));
            }
        }
    }
    for t in &st.tele {
        if !st.labels.contains(&t.with) {
            errors.push(
                Fault::new(
                    "E002",
                    Key::TeleporterPartnerMissing,
                    vec![
                        t.label.as_str().into(),
                        t.with.as_str().into(),
                        st.labels.join(", ").into(),
                    ],
                )
                .at(t.line),
            );
        }
    }
    errors.sort_by_key(|e| e.line);
    OwParse {
        ast: OwAst { nodes },
        errors,
    }
}

/// Every parsed line prints as the text it was read from.
pub fn print_overworld(ast: &OwAst) -> String {
    ast.nodes
        .iter()
        .map(|n| n.raw.as_deref().unwrap_or(""))
        .collect::<Vec<_>>()
        .join("\n")
}
