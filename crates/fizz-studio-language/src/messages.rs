// The English (Canada) text of every parse diagnostic, byte for byte as the TypeScript package writes it.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::errors::{Arg, Diagnostic, Key, Noun, What};

fn what_text(what: &What) -> String {
    match what {
        What::Field(key) => format!("`{key}=`"),
        What::CountAfter(seg) => format!("the count after `{seg}`"),
        What::ChannelNumber => "a channel number".to_string(),
        What::StartX => "start x".to_string(),
        What::StartY => "start y".to_string(),
        What::PlatformWidth => "the platform width".to_string(),
        What::PlatformHeight => "the platform height".to_string(),
        What::ThemeOrAreaName(word) => format!("{word} name"),
        What::LiquidTile => "liquid tile".to_string(),
        What::ChannelList => "channel list".to_string(),
        What::OnOrOff => "on or off".to_string(),
        What::ItemKind => "item kind".to_string(),
        What::TileName => "tile name".to_string(),
        What::AreaName => "area name".to_string(),
        What::LevelName => "level id".to_string(),
        What::TeleporterName => "teleporter name".to_string(),
        What::SignNumber => "sign number".to_string(),
    }
}

fn noun_text(noun: Noun) -> &'static str {
    match noun {
        Noun::Tile => "tile",
        Noun::Item => "item",
        Noun::LevelId => "level id",
        Noun::TerrainSegment => "terrain segment",
        Noun::Theme => "theme",
        Noun::Area => "area",
        Noun::Level => "level",
        Noun::Requirement => "requirement",
    }
}

/// Argument `i` of `d` as text.
fn arg(d: &Diagnostic, i: usize) -> String {
    match d.args.get(i) {
        Some(Arg::Text(text)) => text.clone(),
        Some(Arg::What(what)) => what_text(what),
        Some(Arg::Noun(noun)) => noun_text(*noun).to_string(),
        None => String::new(),
    }
}

/// "did you mean" when a nearest word is known, else the list of choices.
fn suggest_fix(nearest: &str, candidates: &str) -> String {
    if nearest.is_empty() {
        format!("use one of: {candidates}")
    } else {
        format!("did you mean `{nearest}`?")
    }
}

/// What went wrong, in English (Canada).
pub fn message(d: &Diagnostic) -> String {
    let a = |i| arg(d, i);
    match d.key {
        Key::NotWholeNumber => format!("{} must be a whole number, found `{}`", a(0), a(1)),
        Key::NotNumber => format!("{} must be a number, found `{}`", a(0), a(1)),
        Key::BadRange => format!(
            "{} must be a whole number or a range such as 3..7, found `{}`",
            a(0),
            a(1)
        ),
        Key::BackwardsRange => format!("{} range {}..{} runs backwards", a(0), a(1), a(2)),
        Key::DuplicateField => format!("field `{}=` is given twice", a(0)),
        Key::MissingWord => format!("missing {}", a(0)),
        Key::FieldHasNoValue => format!("field `{}=` has no value", a(0)),
        Key::MissingField => format!("missing field `{}=`", a(0)),
        Key::ListNotAllowed => format!(
            "`{}=` takes one value or one range here, found a list `{}`",
            a(0),
            a(1)
        ),
        Key::PairNeedsTwo => format!("`{}=` takes two numbers, found `{}`", a(0), a(1)),
        Key::UnexpectedWord => format!("unexpected `{}`", a(0)),
        Key::UnknownField => format!("unknown field `{}=`", a(0)),
        Key::LevelHeaderMalformed => "the level header is malformed".to_string(),
        Key::LevelTooSmall => format!("a level {}x{} is too small", a(0), a(1)),
        Key::UnknownName => format!("unknown {} `{}`", a(0), a(1)),
        Key::SegmentMalformed => format!("`{}` is not a terrain segment", a(0)),
        Key::ContradictsId => format!(
            "{} `{}` contradicts id `{}`, whose {} in the level table is `{}`",
            a(0),
            a(1),
            a(2),
            a(0),
            a(3)
        ),
        Key::StartNeedsTwoNumbers => "`start` takes two numbers".to_string(),
        Key::NotALiquid => format!("`{}` is not a liquid", a(0)),
        Key::SizeMalformed => "`size=` must be width x height, such as 3x0.5".to_string(),
        Key::ChannelWord => format!("a channel is `on` or `off`, found `{}`", a(0)),
        Key::ChannelOutOfRange => "switch channels run 0..31".to_string(),
        Key::CrystalTakesNoY => "`crystal` sits on the ground and takes no `y=`".to_string(),
        Key::DirNotUnit => format!("`dir=` must be 1 or -1, found {}", a(0)),
        Key::RowStep => format!(
            "x={}..{} does not end on a step of {} from {}",
            a(0),
            a(1),
            a(2),
            a(0)
        ),
        Key::NeedsGround => format!(
            "`{}` reads the ground height, but no terrain line comes before it",
            a(0)
        ),
        Key::SpawnNeedsY => "`dir=` and `ride` need an explicit `y=`".to_string(),
        Key::SpawnRideAndDir => "`ride` and `dir=` cannot be combined".to_string(),
        Key::NeedsOneNumber => format!(
            "{} must be one number, found the range {}..{}",
            a(0),
            a(1),
            a(2)
        ),
        Key::NeedsAtLeastOne => format!("{} must be at least 1, found {}", a(0), a(1)),
        Key::OutsideLevel => format!(
            "{} {} is outside the level ({} runs 0..{})",
            a(0),
            a(1),
            a(0),
            a(2)
        ),
        Key::SectionAfterEdits => format!("`{}` cannot follow the edits block", a(0)),
        Key::SecondEditsBlock => "a second edits block".to_string(),
        Key::SecondLevelHeader => "a second `level` header".to_string(),
        Key::StatementBeforeLevel => {
            "the script has a statement before its `level` header".to_string()
        }
        Key::SecondArena => "a second `arena` line".to_string(),
        Key::NotInEdits => format!("`{}` cannot appear in the edits block", a(0)),
        Key::SecondTopLine => format!("a second `{}` line", a(0)),
        Key::BeforeAnySection => format!("`{}` appears before any section header", a(0)),
        Key::UnknownStatement => format!("unknown statement `{}`", a(0)),
        Key::WrongSection => format!("`{}` belongs under `{}`, not `{}`", a(0), a(1), a(2)),
        Key::UnknownInSection => format!("unknown statement `{}` in `{}`", a(0), a(1)),
        Key::NoLevelHeader => "the script has no `level` header".to_string(),
        Key::NoStartLine | Key::NoOverworldStart => "the script has no `start` line".to_string(),
        Key::OutsideOverworld => format!(
            "{} {} is outside the overworld ({} runs 0..{})",
            a(0),
            a(1),
            a(0),
            a(2)
        ),
        Key::OverworldHeaderMalformed => "the overworld header is malformed".to_string(),
        Key::OverworldTooSmall => format!("an overworld {}x{} is too small", a(0), a(1)),
        Key::SecondOverworldHeader => "a second `overworld` header".to_string(),
        Key::StatementBeforeOverworld => {
            "the script has a statement before its `overworld` header".to_string()
        }
        Key::NoOverworldHeader => "the script has no `overworld` header".to_string(),
        Key::OverworldStartNeedsTwoNumbers => "`start` takes two numbers".to_string(),
        Key::DuplicateTeleporter => format!("a second teleporter called `{}`", a(0)),
        Key::NotInOverworld => format!("`{}` is not used in an overworld script", a(0)),
        Key::OverworldBeforeAnySection => {
            format!("`{}` appears before any section header", a(0))
        }
        Key::PathNotWhole => "a path runs between whole tiles".to_string(),
        Key::SignNumberBad => "a sign number is a whole number from 0".to_string(),
        Key::OverworldUnknownInSection => {
            format!("unknown statement `{}` in `{}`", a(0), a(1))
        }
        Key::TeleporterPartnerMissing => format!(
            "teleporter `{}` pairs with `{}`, which does not exist",
            a(0),
            a(1)
        ),
    }
}

/// How to put it right, in English (Canada).
pub fn fix(d: &Diagnostic) -> String {
    let a = |i| arg(d, i);
    match d.key {
        Key::NotWholeNumber => "write digits only, such as 14 or -2".to_string(),
        Key::NotNumber => "write a decimal such as 7 or 88.5".to_string(),
        Key::BadRange => "write `a` or `a..b` with whole numbers".to_string(),
        Key::BackwardsRange => format!("write it as {}..{}", a(2), a(1)),
        Key::DuplicateField => format!("keep one `{}=`", a(0)),
        Key::MissingWord => format!("write `{}`", a(1)),
        Key::FieldHasNoValue => format!("write a value after `{}=`", a(0)),
        Key::MissingField => format!("add `{}={}`", a(0), a(1)),
        Key::ListNotAllowed => format!(
            "write `{}=a..b` or put the lines on separate statements",
            a(0)
        ),
        Key::PairNeedsTwo => format!("write `{}={}`", a(0), a(2)),
        Key::UnexpectedWord => format!("this statement takes: {}", a(1)),
        Key::UnknownField => format!("this statement takes: {}", a(1)),
        Key::LevelHeaderMalformed => {
            "write: level \"Name\" 192x28 ground=4 id=crater".to_string()
        }
        Key::LevelTooSmall => "make it at least 3x3".to_string(),
        Key::UnknownName => suggest_fix(&a(2), &a(3)),
        Key::SegmentMalformed => {
            "write each segment as a word and a count, such as `flat 14, up 2`".to_string()
        }
        Key::ContradictsId => format!(
            "write `{} {}`, or remove the line (the level table in levels.rs decides {})",
            a(0),
            a(3),
            a(0)
        ),
        Key::StartNeedsTwoNumbers => "write `start 3,4`".to_string(),
        Key::NotALiquid => format!("use one of: {}", a(1)),
        Key::SizeMalformed => {
            "write `size=3x0.5` (tiles wide by tiles high)".to_string()
        }
        Key::ChannelWord => "write `channel 1,2,3 on`".to_string(),
        Key::ChannelOutOfRange => "use a channel from 0 to 31".to_string(),
        Key::CrystalTakesNoY => "remove `y=`; to place a crystal tile at a height use `paint crystal-tile` in the edits block".to_string(),
        Key::DirNotUnit => {
            "write dir=1 (towards the right) or dir=-1 (towards the left)".to_string()
        }
        Key::RowStep => format!(
            "write x={}..{} by={} ({} items) or x={}..{} by={}",
            a(0),
            a(3),
            a(2),
            a(4),
            a(0),
            a(5),
            a(2)
        ),
        Key::NeedsGround => {
            "move it below the `terrain` lines (statements run in file order)".to_string()
        }
        Key::SpawnNeedsY => {
            let ride = if a(2).is_empty() { "" } else { " ride" };
            format!("add y=, for example `{} x={} y=7.5{}`", a(0), a(1), ride)
        }
        Key::SpawnRideAndDir => {
            "the Builder has no spawn that does both; use one of them".to_string()
        }
        Key::NeedsOneNumber => "write a single whole number".to_string(),
        Key::NeedsAtLeastOne => "use a count of 1 or more, or delete the line".to_string(),
        Key::OutsideLevel => format!(
            "keep {} within 0..{}, or change the size on the `level` line",
            a(0),
            a(2)
        ),
        Key::SectionAfterEdits => {
            "the edits block is last; move this section above `edits`".to_string()
        }
        Key::SecondEditsBlock => "merge the lines into the first `edits` block".to_string(),
        Key::SecondLevelHeader => "a script holds one level; split it into two files".to_string(),
        Key::StatementBeforeLevel | Key::NoLevelHeader => {
            "start the script with: level \"Name\" 192x28 ground=4 id=crater".to_string()
        }
        Key::SecondArena => "keep one `arena` line".to_string(),
        Key::NotInEdits => "the edits block holds paint, clear, place, row, enemies, hover, channel, room and secret-room; move this line above `edits`".to_string(),
        Key::SecondTopLine => format!("keep one `{}` line", a(0)),
        Key::BeforeAnySection => format!("put it under a `{}` header", a(1)),
        Key::UnknownStatement => suggest_fix(&a(1), &a(2)),
        Key::WrongSection => format!("move the line under a `{}` header", a(1)),
        Key::UnknownInSection => {
            let nearest = a(2);
            if nearest.is_empty() {
                format!("`{}` takes: {}", a(1), a(3))
            } else {
                format!("did you mean `{nearest}`?")
            }
        }
        Key::NoStartLine => "add `start 3,4` (Ben's spawn tile, x then y)".to_string(),
        Key::OutsideOverworld => format!(
            "keep {} within 0..{}, or change the size on the `overworld` line",
            a(0),
            a(2)
        ),
        Key::OverworldHeaderMalformed => {
            "write: overworld \"Name\" 60x44 id=main".to_string()
        }
        Key::OverworldTooSmall => "make it at least 3x3".to_string(),
        Key::SecondOverworldHeader => "a script holds one overworld".to_string(),
        Key::StatementBeforeOverworld | Key::NoOverworldHeader => {
            "start the script with: overworld \"Name\" 60x44 id=main".to_string()
        }
        Key::NoOverworldStart => {
            "add `start 9.2,8.2` (where Ben stands when the map opens)".to_string()
        }
        Key::OverworldStartNeedsTwoNumbers => "write `start 9.2,8.2`".to_string(),
        Key::DuplicateTeleporter => "give each teleporter its own name".to_string(),
        Key::NotInOverworld => {
            "write the tile word first, such as `river x=24..25 y=0..43`".to_string()
        }
        Key::OverworldBeforeAnySection => {
            "put it under a `blocks` or `points` header".to_string()
        }
        Key::PathNotWhole => "write whole numbers, such as `from=8,9`".to_string(),
        Key::SignNumberBad => "write `sign 0 at=8,16`".to_string(),
        Key::OverworldUnknownInSection => format!("`{}` takes: {}", a(1), a(2)),
        Key::TeleporterPartnerMissing => format!("name an existing teleporter: {}", a(2)),
    }
}

/// A diagnostic on one line, as the reference package's `formatError` writes it.
pub fn format_error(d: &Diagnostic) -> String {
    format!(
        "line {}: {} {} (fix: {})",
        d.line,
        d.code,
        message(d),
        fix(d)
    )
}
