// Parse diagnostics for Fizz scripts: a code, a line, a message key and its arguments.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::Serialize;

/// Something named in a message: a field, a count, a word. The wording lives in `messages.rs`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum What {
    /// A `key=` field.
    Field(String),
    /// The count after a terrain segment word.
    CountAfter(String),
    ChannelNumber,
    StartX,
    StartY,
    PlatformWidth,
    PlatformHeight,
    /// The name a `theme` or `area` line takes (the argument is the word).
    ThemeOrAreaName(String),
    LiquidTile,
    ChannelList,
    OnOrOff,
    ItemKind,
    TileName,
    /// The area name an overworld `area` line takes.
    AreaName,
    /// The level id an overworld `level` point takes.
    LevelName,
    TeleporterName,
    SignNumber,
}

/// The kind of name an "unknown ..." message is about.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Noun {
    Tile,
    Item,
    LevelId,
    TerrainSegment,
    Theme,
    Area,
    /// A level named in an overworld `level` point.
    Level,
    /// A name in an overworld `req=` list.
    Requirement,
}

/// One argument of a diagnostic message.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum Arg {
    Text(String),
    What(What),
    Noun(Noun),
}

impl From<&str> for Arg {
    fn from(text: &str) -> Arg {
        Arg::Text(text.to_string())
    }
}

impl From<String> for Arg {
    fn from(text: String) -> Arg {
        Arg::Text(text)
    }
}

impl From<What> for Arg {
    fn from(what: What) -> Arg {
        Arg::What(what)
    }
}

impl From<Noun> for Arg {
    fn from(noun: Noun) -> Arg {
        Arg::Noun(noun)
    }
}

/// Every distinct message the parser can give. `messages.rs` holds the English (Canada) text of each
/// key, as a message and a fix, built from the diagnostic's arguments.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Key {
    /// `[what, text]`
    NotWholeNumber,
    /// `[what, text]`
    NotNumber,
    /// `[what, text]`
    BadRange,
    /// `[what, lo, hi]`
    BackwardsRange,
    /// `[key]`
    DuplicateField,
    /// `[what, example]`
    MissingWord,
    /// `[key]`
    FieldHasNoValue,
    /// `[key, example]`
    MissingField,
    /// `[key, text]`
    ListNotAllowed,
    /// `[key, text, example]`
    PairNeedsTwo,
    /// `[word, allowed]`
    UnexpectedWord,
    /// `[key, allowed]`
    UnknownField,
    LevelHeaderMalformed,
    /// `[w, h]`
    LevelTooSmall,
    /// `[noun, name, nearest, candidates]`
    UnknownName,
    /// `[piece]`
    SegmentMalformed,
    /// `[word, name, id, want]`
    ContradictsId,
    StartNeedsTwoNumbers,
    /// `[word, candidates]`
    NotALiquid,
    SizeMalformed,
    /// `[state]`
    ChannelWord,
    ChannelOutOfRange,
    CrystalTakesNoY,
    /// `[dir]`
    DirNotUnit,
    /// `[lo, hi, by, prev, count, next]`
    RowStep,
    /// `[word]`
    NeedsGround,
    /// `[word, x, ride]` where `ride` is `ride` or empty
    SpawnNeedsY,
    SpawnRideAndDir,
    /// `[what, lo, hi]`
    NeedsOneNumber,
    /// `[what, n]`
    NeedsAtLeastOne,
    /// `[axis, span, max]`
    OutsideLevel,
    /// `[word]`
    SectionAfterEdits,
    SecondEditsBlock,
    SecondLevelHeader,
    StatementBeforeLevel,
    SecondArena,
    /// `[word]`
    NotInEdits,
    /// `[word]`
    SecondTopLine,
    /// `[word, home]`
    BeforeAnySection,
    /// `[word, nearest, candidates]`
    UnknownStatement,
    /// `[word, home, section]`
    WrongSection,
    /// `[word, section, nearest, candidates]`
    UnknownInSection,
    NoLevelHeader,
    NoStartLine,
    /// `[axis, span, max]`
    OutsideOverworld,
    OverworldHeaderMalformed,
    /// `[w, h]`
    OverworldTooSmall,
    SecondOverworldHeader,
    StatementBeforeOverworld,
    NoOverworldHeader,
    NoOverworldStart,
    OverworldStartNeedsTwoNumbers,
    /// `[label]`
    DuplicateTeleporter,
    /// `[word]`
    NotInOverworld,
    /// `[word]`
    OverworldBeforeAnySection,
    PathNotWhole,
    SignNumberBad,
    /// `[word, section, takes]`
    OverworldUnknownInSection,
    /// `[label, with, labels]`
    TeleporterPartnerMissing,
}

/// A failure on one line, before the parser knows which line it was.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fault {
    pub code: &'static str,
    pub key: Key,
    pub args: Vec<Arg>,
}

impl Fault {
    pub fn new(code: &'static str, key: Key, args: Vec<Arg>) -> Fault {
        Fault { code, key, args }
    }

    pub fn at(self, line: usize) -> Diagnostic {
        Diagnostic {
            line,
            code: self.code,
            key: self.key,
            args: self.args,
        }
    }
}

/// A parse error: the 1-based line, a stable code (`E001` to `E016`), and the message key with the
/// values it names. `messages::message` and `messages::fix` turn it into text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    pub line: usize,
    pub code: &'static str,
    pub key: Key,
    pub args: Vec<Arg>,
}

/// The edit distance between two words, counted in UTF-16 units as the reference parser does.
fn distance(a: &str, b: &str) -> usize {
    let a: Vec<u16> = a.encode_utf16().collect();
    let b: Vec<u16> = b.encode_utf16().collect();
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut prev = row[0];
        row[0] = i;
        for j in 1..=b.len() {
            let current = row[j];
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            row[j] = (row[j] + 1).min(row[j - 1] + 1).min(prev + cost);
            prev = current;
        }
    }
    row[b.len()]
}

/// The closest candidate within two edits, for "did you mean" fixes. The first of equally close
/// candidates wins.
pub fn closest<'a>(word: &str, candidates: &[&'a str]) -> Option<&'a str> {
    let mut best = None;
    let mut best_distance = 3;
    for candidate in candidates {
        let d = distance(word, candidate);
        if d < best_distance {
            best = Some(*candidate);
            best_distance = d;
        }
    }
    best
}

/// The arguments a suggestion needs: the nearest candidate (empty when none is close) and the whole
/// list, comma separated.
pub fn suggestion(word: &str, candidates: &[&str]) -> [Arg; 2] {
    [
        Arg::Text(closest(word, candidates).unwrap_or("").to_string()),
        Arg::Text(candidates.join(", ")),
    ]
}
