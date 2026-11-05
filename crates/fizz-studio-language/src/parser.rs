// Parser for Fizz scripts: text in, an AST with line numbers and every original line kept, plus errors.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashSet;

use crate::args::{parse_int10, parse_num, scan_decimal, to_number, Args};
use crate::ast::{Ast, Body, Node, Range, RectOp, SectionName, Seg, Side};
use crate::errors::{closest, suggestion, Arg, Diagnostic, Fault, Key, Noun, What};
use crate::js::{is_line_terminator, is_space, number_string, split_first_space, trim};
use crate::tables::{
    self, has, level_def, words, AREAS, ITEMS, KINDS, LIQUIDS, SEGS, THEMES, TILES,
};

/// The parse of one script: the lossless AST, and every error found, in line order.
#[derive(Debug, Clone, PartialEq)]
pub struct ParseResult {
    pub ast: Ast,
    pub errors: Vec<Diagnostic>,
}

/// Statements that may appear anywhere before the `edits` block, outside any section's own words.
const TOP_WORDS: [&str; 6] = ["level", "theme", "area", "start", "arena", "walls"];
const BLOCK_WORDS: [&str; 12] = [
    "plat",
    "hover",
    "channel",
    "crystal",
    "room",
    "secret-room",
    "wall-behind",
    "mural",
    "ladder",
    "stairs-right",
    "stairs-left",
    "vine-nook",
];
const TREAT_WORDS: [&str; 2] = ["row", "pogo-cache"];
const EDIT_WORDS: [&str; 3] = ["paint", "clear", "place"];

type Parsed<T> = Result<T, Fault>;

struct LevelState {
    w: f64,
    h: f64,
    id: String,
    line: usize,
}

struct State {
    section: Option<SectionName>,
    level: Option<LevelState>,
    seen: HashSet<&'static str>,
    terrain: bool,
}

/// Where a word belongs, for "wrong section" and "unknown word" fixes.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Home {
    Top,
    Section(SectionName),
}

fn fail<T>(code: &'static str, key: Key, args: Vec<Arg>) -> Parsed<T> {
    Err(Fault::new(code, key, args))
}

/// Finds the `//` that starts a trailing comment, ignoring any inside a quoted level name.
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

fn home_of(word: &str) -> Option<Home> {
    if TOP_WORDS.contains(&word) {
        return Some(Home::Top);
    }
    if has(SEGS, word) || word == "liquid" {
        return Some(Home::Section(SectionName::Terrain));
    }
    if has(TILES, word) || BLOCK_WORDS.contains(&word) {
        return Some(Home::Section(SectionName::Blocks));
    }
    if has(ITEMS, word) || TREAT_WORDS.contains(&word) {
        return Some(Home::Section(SectionName::Treats));
    }
    if has(KINDS, word) {
        return Some(Home::Section(SectionName::Enemies));
    }
    if EDIT_WORDS.contains(&word) {
        return Some(Home::Section(SectionName::Edits));
    }
    None
}

fn all_words(section: SectionName) -> Vec<&'static str> {
    match section {
        SectionName::Terrain => {
            let mut list = words(SEGS);
            list.push("liquid");
            list
        }
        SectionName::Blocks => {
            let mut list: Vec<&'static str> =
                words(TILES).into_iter().filter(|t| *t != "empty").collect();
            list.extend(BLOCK_WORDS);
            list
        }
        SectionName::Treats => {
            let mut list = words(ITEMS);
            list.extend(TREAT_WORDS);
            list
        }
        SectionName::Enemies => words(KINDS),
        SectionName::Edits => {
            let mut list: Vec<&'static str> = EDIT_WORDS.to_vec();
            list.extend(words(KINDS));
            list.extend(["hover", "channel", "room", "secret-room"]);
            list
        }
    }
}

fn single(r: Range, what: What) -> Parsed<f64> {
    if r.lo != r.hi {
        return fail(
            "E004",
            Key::NeedsOneNumber,
            vec![
                what.into(),
                number_string(r.lo).into(),
                number_string(r.hi).into(),
            ],
        );
    }
    Ok(r.lo)
}

fn positive(n: f64, what: What) -> Parsed<f64> {
    if n < 1.0 {
        return fail(
            "E015",
            Key::NeedsAtLeastOne,
            vec![what.into(), number_string(n).into()],
        );
    }
    Ok(n)
}

fn inside(st: &State, axis: char, lo: f64, hi: f64) -> Parsed<()> {
    let Some(level) = &st.level else {
        return Ok(());
    };
    let max = (if axis == 'x' { level.w } else { level.h }) - 1.0;
    if lo < 0.0 || hi > max {
        let span = if lo == hi {
            number_string(lo)
        } else {
            format!("{}..{}", number_string(lo), number_string(hi))
        };
        return fail(
            "E013",
            Key::OutsideLevel,
            vec![
                axis.to_string().into(),
                span.into(),
                number_string(max).into(),
            ],
        );
    }
    Ok(())
}

fn inside_all(st: &State, axis: char, ranges: &[Range]) -> Parsed<()> {
    ranges.iter().try_for_each(|r| inside(st, axis, r.lo, r.hi))
}

fn unknown_name(noun: Noun, name: &str, candidates: &[&str]) -> Fault {
    let [nearest, list] = suggestion(name, candidates);
    Fault::new(
        "E002",
        Key::UnknownName,
        vec![noun.into(), name.into(), nearest, list],
    )
}

fn tile_name(word: String) -> Parsed<String> {
    if !has(TILES, &word) {
        return Err(unknown_name(Noun::Tile, &word, &words(TILES)));
    }
    Ok(word)
}

fn item_name(word: String) -> Parsed<String> {
    if !has(ITEMS, &word) {
        return Err(unknown_name(Noun::Item, &word, &words(ITEMS)));
    }
    Ok(word)
}

fn need_ground(st: &State, word: &str) -> Parsed<()> {
    if !st.terrain {
        return fail("E011", Key::NeedsGround, vec![word.into()]);
    }
    Ok(())
}

/// Reads `level "Name" WxH [fields]` by hand, with the reference parser's regular expression rules:
/// JavaScript whitespace, ASCII digits, and a field tail that may hold no line terminator.
fn level_header(body: &str) -> Option<(&str, &str, &str, &str)> {
    let after_keyword = body.strip_prefix("level")?;
    let rest = after_keyword.trim_start_matches(is_space);
    if rest.len() == after_keyword.len() {
        return None;
    }
    let rest = rest.strip_prefix('"')?;
    let (name, rest) = rest.split_once('"')?;
    let after_name = rest.trim_start_matches(is_space);
    if after_name.len() == rest.len() {
        return None;
    }
    let digits = |s: &str| s.bytes().take_while(u8::is_ascii_digit).count();
    let w_len = digits(after_name);
    if w_len == 0 {
        return None;
    }
    let (w, rest) = after_name.split_at(w_len);
    let rest = rest.strip_prefix('x')?;
    let h_len = digits(rest);
    if h_len == 0 {
        return None;
    }
    let (h, tail) = rest.split_at(h_len);
    if tail.is_empty() {
        return Some((name, w, h, ""));
    }
    let fields = tail.trim_start_matches(is_space);
    if fields.len() == tail.len() || fields.chars().any(is_line_terminator) {
        return None;
    }
    Some((name, w, h, fields))
}

fn parse_level(body: &str, st: &mut State) -> Parsed<Body> {
    let Some((name, w_text, h_text, fields)) = level_header(body) else {
        st.level = Some(LevelState {
            w: f64::INFINITY,
            h: f64::INFINITY,
            id: String::new(),
            line: 0,
        });
        return fail("E004", Key::LevelHeaderMalformed, vec![]);
    };
    // Record the size first so a bad `ground=` or `id=` does not make every later line fail too.
    let (w, h) = (to_number(w_text), to_number(h_text));
    st.level = Some(LevelState {
        w,
        h,
        id: String::new(),
        line: 0,
    });
    let mut a = Args::new(fields)?;
    let ground = a.int("ground", "4")?;
    let id_text = a.text("id", "crater")?;
    a.finish("ground=N id=NAME")?;
    if w < 3.0 || h < 3.0 {
        return fail(
            "E015",
            Key::LevelTooSmall,
            vec![number_string(w).into(), number_string(h).into()],
        );
    }
    if level_def(&id_text).is_none() {
        let ids: Vec<&str> = tables::LEVEL_IDS.iter().map(|d| d.id).collect();
        return Err(unknown_name(Noun::LevelId, &id_text, &ids));
    }
    if let Some(level) = &mut st.level {
        level.id = id_text.clone();
    }
    Ok(Body::Level {
        name: name.to_string(),
        w,
        h,
        ground,
        id: id_text,
    })
}

/// `\S+` after `^([a-z0-9-]+)\s+`: the piece of a terrain line, split into its word and count.
fn segment_pieces(piece: &str) -> Option<(&str, &str)> {
    let word_len = piece
        .bytes()
        .take_while(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-')
        .count();
    if word_len == 0 {
        return None;
    }
    let (word, rest) = piece.split_at(word_len);
    let count = rest.trim_start_matches(is_space);
    if count.len() == rest.len() || count.is_empty() || count.contains(is_space) {
        return None;
    }
    Some((word, count))
}

fn parse_segs(body: &str) -> Parsed<Body> {
    let mut segs = Vec::new();
    for piece in body.split(',') {
        let piece = trim(piece);
        let Some((word, count)) = segment_pieces(piece) else {
            return fail("E004", Key::SegmentMalformed, vec![piece.into()]);
        };
        if !has(SEGS, word) {
            return Err(unknown_name(Noun::TerrainSegment, word, &words(SEGS)));
        }
        let what = || What::CountAfter(word.to_string());
        let n = positive(parse_int10(count, what())?, what())?;
        segs.push(Seg {
            seg: word.to_string(),
            n,
        });
    }
    Ok(Body::Segs { segs })
}

/// `^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$`
fn parse_size(text: &str) -> Option<(&str, &str)> {
    let (w, rest) = scan_decimal(text)?;
    let rest = rest.strip_prefix('x')?;
    match scan_decimal(rest) {
        Some((h, "")) => Some((w, h)),
        _ => None,
    }
}

fn parse_statement(word: &str, rest: &str, st: &State) -> Parsed<Body> {
    let mut a = Args::new(rest)?;
    match word {
        "theme" | "area" => {
            let name = a.word(
                What::ThemeOrAreaName(word.to_string()),
                &format!("{word} crater"),
            )?;
            a.finish(&format!("one {word} name"))?;
            let (known, noun) = if word == "theme" {
                (THEMES, Noun::Theme)
            } else {
                (AREAS, Noun::Area)
            };
            if !known.contains(&name.as_str()) {
                return Err(unknown_name(noun, &name, known));
            }
            let level = st.level.as_ref();
            let def = level.and_then(|l| level_def(&l.id));
            if let (Some(level), Some(def)) = (level, def) {
                let want = if word == "theme" { def.theme } else { def.area };
                if want != name {
                    return fail(
                        "E014",
                        Key::ContradictsId,
                        vec![
                            word.into(),
                            name.into(),
                            level.id.as_str().into(),
                            want.into(),
                        ],
                    );
                }
            }
            Ok(if word == "theme" {
                Body::Theme { name }
            } else {
                Body::Area { name }
            })
        }
        "start" => {
            let tight = crate::args::tighten_commas(rest);
            let pair: Vec<&str> = trim(&tight).split(',').collect();
            if pair.len() != 2 || pair.iter().any(|p| p.is_empty()) {
                return fail("E004", Key::StartNeedsTwoNumbers, vec![]);
            }
            let x = parse_num(pair[0], What::StartX)?;
            let y = parse_num(pair[1], What::StartY)?;
            Ok(Body::Start { x, y })
        }
        "arena" => {
            let x = a.range("x", "118..147")?;
            let floor = a.num("floor", "4")?;
            a.finish("x=A..B floor=N")?;
            Ok(Body::Arena { x, floor })
        }
        "walls" => {
            a.finish("nothing")?;
            Ok(Body::Walls)
        }
        "liquid" => {
            let tile = a.word(What::LiquidTile, &format!("liquid {}", LIQUIDS[1]))?;
            a.finish("one liquid")?;
            if !LIQUIDS.contains(&tile.as_str()) {
                return fail(
                    "E002",
                    Key::NotALiquid,
                    vec![tile.into(), LIQUIDS.join(", ").into()],
                );
            }
            Ok(Body::Liquid { tile })
        }
        "plat" => {
            let x = a.range("x", "107..108")?;
            let y = single(a.range("y", "5")?, What::Field("y".to_string()))?;
            a.finish("x=A..B y=N")?;
            inside(st, 'x', x.lo, x.hi)?;
            inside(st, 'y', y, y)?;
            Ok(Body::Plat { x, y })
        }
        "hover" => {
            let from = a.pair("from", "97,4.5")?;
            let to = a.pair("to", "103,4.5")?;
            let speed = a.num("speed", "0.3")?;
            let mut size = None;
            if a.has("size") {
                let text = a.text("size", "3x0.5")?;
                let Some((w, h)) = parse_size(&text) else {
                    return fail("E004", Key::SizeMalformed, vec![]);
                };
                size = Some([
                    parse_num(w, What::PlatformWidth)?,
                    parse_num(h, What::PlatformHeight)?,
                ]);
            }
            let dwell = a.opt_num("dwell")?;
            a.finish("from=X,Y to=X,Y speed=N [size=WxH] [dwell=SECONDS]")?;
            Ok(Body::Hover {
                from,
                to,
                speed,
                size,
                dwell,
            })
        }
        "channel" => {
            let list = a.word(What::ChannelList, "channel 1,2,3 on")?;
            let state = a.word(What::OnOrOff, "channel 1,2,3 on")?;
            a.finish("a channel list and on or off")?;
            if state != "on" && state != "off" {
                return fail("E004", Key::ChannelWord, vec![state.into()]);
            }
            let numbers = list
                .split(',')
                .map(|p| parse_int10(p, What::ChannelNumber))
                .collect::<Parsed<Vec<f64>>>()?;
            if numbers.iter().any(|c| *c < 0.0 || *c > 31.0) {
                return fail("E013", Key::ChannelOutOfRange, vec![]);
            }
            Ok(Body::Channel {
                chs: numbers.iter().map(|c| *c as u8).collect(),
                on: state == "on",
            })
        }
        "crystal" => {
            if a.has("y") {
                return fail("E009", Key::CrystalTakesNoY, vec![]);
            }
            need_ground(st, word)?;
            let xs = a.ranges("x", "10,26,60")?;
            a.finish("x=LIST")?;
            inside_all(st, 'x', &xs)?;
            Ok(Body::Crystal { xs })
        }
        "room" | "secret-room" | "wall-behind" => {
            let x = a.range("x", "10..20")?;
            let y = a.range("y", "4..9")?;
            a.finish("x=A..B y=A..B")?;
            inside(st, 'x', x.lo, x.hi)?;
            inside(st, 'y', y.lo, y.hi)?;
            let op = match word {
                "room" => RectOp::Room,
                "secret-room" => RectOp::SecretRoom,
                _ => RectOp::WallBehind,
            };
            Ok(Body::Rect { op, x, y })
        }
        "mural" => {
            let x = a.int("x", "30")?;
            let y = a.int("y", "8")?;
            a.finish("x=N y=N")?;
            inside(st, 'x', x, x + 2.0)?;
            inside(st, 'y', y, y + 1.0)?;
            Ok(Body::Mural { x, y })
        }
        "ladder" => {
            let x = a.int("x", "30")?;
            let y = a.range("y", "4..12")?;
            a.finish("x=N y=BOTTOM..TOP")?;
            inside(st, 'x', x, x)?;
            inside(st, 'y', y.lo, y.hi)?;
            Ok(Body::Ladder { x, y })
        }
        "stairs-right" | "stairs-left" => {
            let x = a.int("x", "30")?;
            let y = a.int("y", "4")?;
            let count = positive(a.int("count", "6")?, What::Field("count".to_string()))?;
            a.finish("x=N y=N count=N")?;
            let side = if word == "stairs-right" {
                Side::Right
            } else {
                Side::Left
            };
            Ok(Body::Stairs { side, x, y, count })
        }
        "vine-nook" => {
            let x = a.int("x", "30")?;
            let foot = a.int("foot", "4")?;
            let shelf = a.int("shelf", "12")?;
            let dir = a.int("dir", "1")?;
            let depth = positive(a.int("depth", "6")?, What::Field("depth".to_string()))?;
            let h = positive(a.int("h", "4")?, What::Field("h".to_string()))?;
            a.finish("x= foot= shelf= dir= depth= h=")?;
            if dir != 1.0 && dir != -1.0 {
                return fail("E004", Key::DirNotUnit, vec![number_string(dir).into()]);
            }
            Ok(Body::VineNook {
                x,
                foot,
                shelf,
                dir,
                depth,
                h,
            })
        }
        "row" => {
            let kind = item_name(a.word(What::ItemKind, "row cheezie x=17..20 y=7")?)?;
            let x = a.range("x", "17..20")?;
            let y = single(a.range("y", "7")?, What::Field("y".to_string()))?;
            let by = positive(a.opt_int("by", 1.0)?, What::Field("by".to_string()))?;
            a.finish("ITEM x=A..B y=N [by=N]")?;
            if (x.hi - x.lo) % by != 0.0 {
                let next = x.lo + ((x.hi - x.lo) / by).ceil() * by;
                let prev = x.lo + ((x.hi - x.lo) / by).floor() * by;
                return fail(
                    "E012",
                    Key::RowStep,
                    vec![
                        number_string(x.lo).into(),
                        number_string(x.hi).into(),
                        number_string(by).into(),
                        number_string(prev).into(),
                        number_string((prev - x.lo) / by + 1.0).into(),
                        number_string(next).into(),
                    ],
                );
            }
            inside(st, 'x', x.lo, x.hi)?;
            inside(st, 'y', y, y)?;
            Ok(Body::Row { kind, x, y, by })
        }
        "pogo-cache" => {
            need_ground(st, word)?;
            let x = a.range("x", "8..10")?;
            let rise = a.int("rise", "7")?;
            a.finish("x=A..B rise=N")?;
            Ok(Body::PogoCache { x, rise })
        }
        "paint" => {
            let tile = tile_name(a.word(What::TileName, "paint one-way x=26,28 y=9")?)?;
            let xs = a.ranges("x", "26,28,30")?;
            let ys = a.ranges("y", "9")?;
            a.finish("TILE x=LIST y=LIST")?;
            inside_all(st, 'x', &xs)?;
            inside_all(st, 'y', &ys)?;
            Ok(Body::Paint { tile, xs, ys })
        }
        "clear" => {
            let xs = a.ranges("x", "12..14")?;
            let ys = a.ranges("y", "8")?;
            a.finish("x=LIST y=LIST")?;
            inside_all(st, 'x', &xs)?;
            inside_all(st, 'y', &ys)?;
            Ok(Body::Clear { xs, ys })
        }
        "place" => {
            let kind = item_name(a.word(What::ItemKind, "place cheezie x=26,28 y=8")?)?;
            let xs = a.ranges("x", "26,28,30")?;
            let ys = a.ranges("y", "8")?;
            a.finish("ITEM x=LIST y=LIST")?;
            inside_all(st, 'x', &xs)?;
            inside_all(st, 'y', &ys)?;
            Ok(Body::Place { kind, xs, ys })
        }
        // Every word that reaches here has a branch above; a word that did not would be a
        // programming error, so it is reported as an unknown statement rather than a panic.
        _ => {
            let [nearest, list] = suggestion(word, &TOP_WORDS);
            fail(
                "E001",
                Key::UnknownStatement,
                vec![word.into(), nearest, list],
            )
        }
    }
}

fn parse_tile(word: &str, rest: &str, st: &State) -> Parsed<Body> {
    let mut a = Args::new(rest)?;
    let x = a.range("x", "49..51")?;
    let y = a.range("y", "10")?;
    a.finish("x=A..B y=A..B")?;
    inside(st, 'x', x.lo, x.hi)?;
    inside(st, 'y', y.lo, y.hi)?;
    Ok(Body::Tile {
        tile: word.to_string(),
        x,
        y,
    })
}

fn parse_item(word: &str, rest: &str, st: &State) -> Parsed<Body> {
    let mut a = Args::new(rest)?;
    let xs = a.ranges("x", "36")?;
    let y = single(a.range("y", "5")?, What::Field("y".to_string()))?;
    a.finish("x=LIST y=N")?;
    inside_all(st, 'x', &xs)?;
    inside(st, 'y', y, y)?;
    Ok(Body::Item {
        kind: word.to_string(),
        xs,
        y,
    })
}

fn parse_spawn(word: &str, rest: &str, st: &State) -> Parsed<Body> {
    let mut a = Args::new(rest)?;
    let ride = a.flag("ride");
    let xs = a.nums("x", "35,62,85")?;
    let y = a.opt_num("y")?;
    let dir = a.opt_num("dir")?;
    a.finish("x=LIST [y=N] [dir=N] [ride]")?;
    if y.is_none() {
        if dir.is_some() || ride {
            return fail(
                "E016",
                Key::SpawnNeedsY,
                vec![
                    word.into(),
                    xs[0].text.as_str().into(),
                    (if ride { "ride" } else { "" }).into(),
                ],
            );
        }
        need_ground(st, word)?;
    } else if ride && dir.is_some() {
        return fail("E016", Key::SpawnRideAndDir, vec![]);
    }
    for x in &xs {
        let floor = x.value.floor();
        inside(st, 'x', floor, floor)?;
    }
    Ok(Body::Spawn {
        kind: word.to_string(),
        xs,
        y,
        dir,
        ride,
    })
}

fn parse_body(code: &str, st: &mut State) -> Parsed<Body> {
    let body = trim(code);
    let (word, rest) = match split_first_space(body) {
        Some((word, rest)) => (word, trim(rest)),
        None => (body, ""),
    };

    if let (Some(section), true) = (SectionName::from_word(word), rest.is_empty()) {
        if st.section == Some(SectionName::Edits) {
            return fail("E008", Key::SectionAfterEdits, vec![word.into()]);
        }
        if section == SectionName::Edits && st.seen.contains("edits") {
            return fail("E006", Key::SecondEditsBlock, vec![]);
        }
        st.seen.insert(section.as_str());
        st.section = Some(section);
        return Ok(Body::Section { name: section });
    }

    if word == "level" {
        if st.level.is_some() {
            return fail("E006", Key::SecondLevelHeader, vec![]);
        }
        return parse_level(body, st);
    }
    if st.level.is_none() {
        return fail("E007", Key::StatementBeforeLevel, vec![]);
    }

    if let Some(top) = TOP_WORDS.iter().copied().find(|w| *w == word) {
        // The arena is an object the studio places, so it may sit in the edits block as well as above it.
        if st.section == Some(SectionName::Edits) && word == "arena" {
            if st.seen.contains(word) {
                return fail("E006", Key::SecondArena, vec![]);
            }
            st.seen.insert(top);
            return parse_statement(word, rest, st);
        }
        if st.section == Some(SectionName::Edits) {
            return fail("E008", Key::NotInEdits, vec![word.into()]);
        }
        if word != "walls" && st.seen.contains(word) {
            return fail("E006", Key::SecondTopLine, vec![word.into()]);
        }
        st.seen.insert(top);
        return parse_statement(word, rest, st);
    }

    let Some(sec) = st.section else {
        return match home_of(word) {
            Some(Home::Section(home)) => fail(
                "E008",
                Key::BeforeAnySection,
                vec![word.into(), home.as_str().into()],
            ),
            _ => {
                let mut candidates: Vec<&str> = TOP_WORDS.to_vec();
                candidates.extend(SectionName::ALL.map(SectionName::as_str));
                let [nearest, list] = suggestion(word, &candidates);
                fail(
                    "E001",
                    Key::UnknownStatement,
                    vec![word.into(), nearest, list],
                )
            }
        };
    };
    let known = all_words(sec);
    if !known.contains(&word) {
        if let Some(Home::Section(home)) = home_of(word) {
            return fail(
                "E008",
                Key::WrongSection,
                vec![word.into(), home.as_str().into(), sec.as_str().into()],
            );
        }
        let near = closest(word, &known).unwrap_or("");
        return fail(
            "E001",
            Key::UnknownInSection,
            vec![
                word.into(),
                sec.as_str().into(),
                near.into(),
                known.join(", ").into(),
            ],
        );
    }

    if sec == SectionName::Terrain {
        if word == "liquid" {
            return parse_statement(word, rest, st);
        }
        st.terrain = true;
        return parse_segs(body);
    }
    if sec == SectionName::Blocks && has(TILES, word) {
        return parse_tile(word, rest, st);
    }
    if sec == SectionName::Treats && has(ITEMS, word) {
        return parse_item(word, rest, st);
    }
    if sec == SectionName::Enemies || (sec == SectionName::Edits && has(KINDS, word)) {
        return parse_spawn(word, rest, st);
    }
    parse_statement(word, rest, st)
}

/// Parses a script. Every line becomes a node that keeps its original text, and every line that
/// fails becomes an `error` node plus a diagnostic; the rest of the script is still read.
pub fn parse(text: &str) -> ParseResult {
    let mut st = State {
        section: None,
        level: None,
        seen: HashSet::new(),
        terrain: false,
    };
    let mut errors: Vec<Diagnostic> = Vec::new();
    let mut nodes: Vec<Node> = Vec::new();
    for (i, raw) in text.split('\n').enumerate() {
        let line = i + 1;
        let (code, comment) = split_comment(raw);
        let raw_text = Some(raw.to_string());
        if trim(code).is_empty() {
            let body = if trim(raw).is_empty() {
                Body::Blank
            } else {
                Body::Comment
            };
            nodes.push(Node {
                body,
                line,
                raw: raw_text,
                comment,
            });
            continue;
        }
        match parse_body(code, &mut st) {
            Ok(body) => {
                if matches!(body, Body::Level { .. }) {
                    if let Some(level) = &mut st.level {
                        level.line = line;
                    }
                }
                nodes.push(Node {
                    body,
                    line,
                    raw: raw_text,
                    comment,
                });
            }
            Err(fault) => {
                if let Some(level) = &mut st.level {
                    if level.line == 0 {
                        level.line = line;
                    }
                }
                let body = Body::Error {
                    code: fault.code.to_string(),
                };
                errors.push(fault.at(line));
                nodes.push(Node {
                    body,
                    line,
                    raw: raw_text,
                    comment,
                });
            }
        }
    }
    match &st.level {
        None => {
            if errors.is_empty() {
                errors.push(Fault::new("E007", Key::NoLevelHeader, vec![]).at(1));
            }
        }
        Some(level) => {
            if !st.seen.contains("start") {
                errors.push(Fault::new("E010", Key::NoStartLine, vec![]).at(level.line));
            }
        }
    }
    errors.sort_by_key(|e| e.line);
    ParseResult {
        ast: Ast { nodes },
        errors,
    }
}
