// Field reading for one statement line: positional words, `key=value` fields and bare flags.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::ast::{Num, Range};
use crate::errors::{Fault, Key, What};
use crate::js::{is_space, number_string};

/// The `-?\d+` at the start of `s`: the matched text and what follows it.
fn scan_int(s: &str) -> Option<(&str, &str)> {
    let digits_from = usize::from(s.starts_with('-'));
    let digits = s[digits_from..]
        .bytes()
        .take_while(u8::is_ascii_digit)
        .count();
    if digits == 0 {
        return None;
    }
    Some(s.split_at(digits_from + digits))
}

/// The `\d+(?:\.\d+)?` at the start of `s`: the matched text and what follows it.
pub fn scan_decimal(s: &str) -> Option<(&str, &str)> {
    let digits = s.bytes().take_while(u8::is_ascii_digit).count();
    if digits == 0 {
        return None;
    }
    let after = &s[digits..];
    let fraction = match after.strip_prefix('.') {
        Some(frac) => frac.bytes().take_while(u8::is_ascii_digit).count(),
        None => 0,
    };
    let len = if fraction > 0 {
        digits + 1 + fraction
    } else {
        digits
    };
    Some(s.split_at(len))
}

/// JavaScript's `Number(text)` for text already known to be a decimal literal.
pub fn to_number(text: &str) -> f64 {
    text.parse::<f64>().unwrap_or(f64::NAN)
}

pub fn parse_int10(text: &str, what: What) -> Result<f64, Fault> {
    match scan_int(text) {
        Some((_, "")) => Ok(to_number(text)),
        _ => Err(Fault::new(
            "E004",
            Key::NotWholeNumber,
            vec![what.into(), text.into()],
        )),
    }
}

pub fn parse_num(text: &str, what: What) -> Result<Num, Fault> {
    let valid = match scan_decimal(text.strip_prefix('-').unwrap_or(text)) {
        Some((_, rest)) => rest.is_empty(),
        None => false,
    };
    if !valid {
        return Err(Fault::new(
            "E004",
            Key::NotNumber,
            vec![what.into(), text.into()],
        ));
    }
    Ok(Num {
        value: to_number(text),
        text: text.to_string(),
    })
}

/// One list element: `a` or `a..b`, with whole numbers.
pub fn parse_range(text: &str, what: What) -> Result<Range, Fault> {
    let bad = || {
        Fault::new(
            "E004",
            Key::BadRange,
            vec![what.clone().into(), text.into()],
        )
    };
    let (lo_text, rest) = scan_int(text).ok_or_else(bad)?;
    let hi_text = if rest.is_empty() {
        lo_text
    } else {
        let tail = rest.strip_prefix("..").ok_or_else(bad)?;
        match scan_int(tail) {
            Some((hi_text, "")) => hi_text,
            _ => return Err(bad()),
        }
    };
    let (lo, hi) = (to_number(lo_text), to_number(hi_text));
    if lo > hi {
        return Err(Fault::new(
            "E005",
            Key::BackwardsRange,
            vec![
                what.into(),
                number_string(lo).into(),
                number_string(hi).into(),
            ],
        ));
    }
    Ok(Range { lo, hi })
}

/// `body` with the whitespace around every comma removed, like `replace(/\s*,\s*/g, ',')`.
pub fn tighten_commas(body: &str) -> String {
    let mut out = String::with_capacity(body.len());
    let mut chars = body.chars().peekable();
    while let Some(c) = chars.next() {
        if c == ',' {
            out.truncate(out.trim_end_matches(is_space).len());
            out.push(',');
            while chars.next_if(|n| is_space(*n)).is_some() {}
        } else {
            out.push(c);
        }
    }
    out
}

/// The fields of one statement line, consumed as the parser reads them.
pub struct Args {
    pos: Vec<String>,
    kv: Vec<(String, String)>,
}

impl Args {
    pub fn new(body: &str) -> Result<Args, Fault> {
        let mut pos = Vec::new();
        let mut kv: Vec<(String, String)> = Vec::new();
        let tight = tighten_commas(body);
        for token in tight.split(is_space).filter(|t| !t.is_empty()) {
            match token.find('=') {
                Some(i) if i > 0 => {
                    let key = &token[..i];
                    if kv.iter().any(|(k, _)| k == key) {
                        return Err(Fault::new("E009", Key::DuplicateField, vec![key.into()]));
                    }
                    kv.push((key.to_string(), token[i + 1..].to_string()));
                }
                _ => pos.push(token.to_string()),
            }
        }
        Ok(Args { pos, kv })
    }

    /// Takes the next positional word, or fails naming what was expected and an example line.
    pub fn word(&mut self, what: What, example: &str) -> Result<String, Fault> {
        if self.pos.is_empty() {
            return Err(Fault::new(
                "E003",
                Key::MissingWord,
                vec![what.into(), example.into()],
            ));
        }
        Ok(self.pos.remove(0))
    }

    pub fn flag(&mut self, name: &str) -> bool {
        match self.pos.iter().position(|p| p == name) {
            Some(i) => {
                self.pos.remove(i);
                true
            }
            None => false,
        }
    }

    pub fn has(&self, key: &str) -> bool {
        self.kv.iter().any(|(k, _)| k == key)
    }

    fn take(&mut self, key: &str) -> Result<Option<String>, Fault> {
        let Some(i) = self.kv.iter().position(|(k, _)| k == key) else {
            return Ok(None);
        };
        let (_, value) = self.kv.remove(i);
        if value.is_empty() {
            return Err(Fault::new("E003", Key::FieldHasNoValue, vec![key.into()]));
        }
        Ok(Some(value))
    }

    fn need(&mut self, key: &str, example: &str) -> Result<String, Fault> {
        self.take(key)?
            .ok_or_else(|| Fault::new("E003", Key::MissingField, vec![key.into(), example.into()]))
    }

    /// A plain word field such as `id=crater`.
    pub fn text(&mut self, key: &str, example: &str) -> Result<String, Fault> {
        self.need(key, example)
    }

    pub fn int(&mut self, key: &str, example: &str) -> Result<f64, Fault> {
        let value = self.need(key, example)?;
        parse_int10(&value, What::Field(key.to_string()))
    }

    pub fn opt_int(&mut self, key: &str, fallback: f64) -> Result<f64, Fault> {
        match self.take(key)? {
            Some(value) => parse_int10(&value, What::Field(key.to_string())),
            None => Ok(fallback),
        }
    }

    pub fn num(&mut self, key: &str, example: &str) -> Result<Num, Fault> {
        let value = self.need(key, example)?;
        parse_num(&value, What::Field(key.to_string()))
    }

    pub fn opt_num(&mut self, key: &str) -> Result<Option<Num>, Fault> {
        match self.take(key)? {
            Some(value) => parse_num(&value, What::Field(key.to_string())).map(Some),
            None => Ok(None),
        }
    }

    /// A field that must be exactly one number or one range.
    pub fn range(&mut self, key: &str, example: &str) -> Result<Range, Fault> {
        let value = self.need(key, example)?;
        if value.contains(',') {
            return Err(Fault::new(
                "E004",
                Key::ListNotAllowed,
                vec![key.into(), value.into()],
            ));
        }
        parse_range(&value, What::Field(key.to_string()))
    }

    /// A comma list of numbers and ranges.
    pub fn ranges(&mut self, key: &str, example: &str) -> Result<Vec<Range>, Fault> {
        let value = self.need(key, example)?;
        value
            .split(',')
            .map(|p| parse_range(p, What::Field(key.to_string())))
            .collect()
    }

    /// A comma list of plain decimals, no ranges.
    pub fn nums(&mut self, key: &str, example: &str) -> Result<Vec<Num>, Fault> {
        let value = self.need(key, example)?;
        value
            .split(',')
            .map(|p| parse_num(p, What::Field(key.to_string())))
            .collect()
    }

    /// Two decimals joined by a comma, such as `103,4.5`.
    pub fn pair(&mut self, key: &str, example: &str) -> Result<[Num; 2], Fault> {
        let value = self.need(key, example)?;
        let parts: Vec<&str> = value.split(',').collect();
        if parts.len() != 2 {
            return Err(Fault::new(
                "E004",
                Key::PairNeedsTwo,
                vec![key.into(), value.as_str().into(), example.into()],
            ));
        }
        let what = || What::Field(key.to_string());
        Ok([parse_num(parts[0], what())?, parse_num(parts[1], what())?])
    }

    /// Fails on anything the statement did not consume.
    pub fn finish(&self, allowed: &str) -> Result<(), Fault> {
        if let Some(extra) = self.pos.first() {
            return Err(Fault::new(
                "E009",
                Key::UnexpectedWord,
                vec![extra.as_str().into(), allowed.into()],
            ));
        }
        if let Some((key, _)) = self.kv.first() {
            return Err(Fault::new(
                "E009",
                Key::UnknownField,
                vec![key.as_str().into(), allowed.into()],
            ));
        }
        Ok(())
    }
}
