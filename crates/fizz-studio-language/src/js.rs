// JavaScript string and number rules the Fizz 1 parser depends on, kept exact so the port matches.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::Serializer;

/// Whether `c` is whitespace to a JavaScript `\s` or `String.prototype.trim`.
///
/// This is not `char::is_whitespace`: JavaScript counts the byte order mark (U+FEFF) and leaves out
/// the next line character (U+0085).
pub fn is_space(c: char) -> bool {
    matches!(
        c,
        '\u{9}'..='\u{d}'
            | ' '
            | '\u{a0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200a}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
            | '\u{feff}'
    )
}

/// Whether `c` ends a line to a JavaScript regular expression's `.`.
pub fn is_line_terminator(c: char) -> bool {
    matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// `String.prototype.trim`.
pub fn trim(s: &str) -> &str {
    s.trim_matches(is_space)
}

/// `String.prototype.trimEnd`.
pub fn trim_end(s: &str) -> &str {
    s.trim_end_matches(is_space)
}

/// Splits `s` at its first whitespace character, like `search(/\s/)` then slicing past it.
pub fn split_first_space(s: &str) -> Option<(&str, &str)> {
    let (i, c) = s.char_indices().find(|(_, c)| is_space(*c))?;
    Some((&s[..i], &s[i + c.len_utf8()..]))
}

/// The text of a number as JavaScript's `String(n)` writes it.
pub fn number_string(n: f64) -> String {
    if n.is_nan() {
        return "NaN".to_string();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity" } else { "-Infinity" }.to_string();
    }
    if n == 0.0 {
        return "0".to_string();
    }
    let magnitude = n.abs();
    if (1e-6..1e21).contains(&magnitude) {
        return format!("{n}");
    }
    let text = format!("{n:e}");
    match text.split_once('e') {
        Some((digits, exponent)) if !exponent.starts_with('-') => format!("{digits}e+{exponent}"),
        _ => text,
    }
}

/// Serialises a number as `JSON.stringify` does: whole values as integers, and a number JSON cannot
/// hold (`Infinity`) as `null`.
pub fn serialize_number<S: Serializer>(n: &f64, serializer: S) -> Result<S::Ok, S::Error> {
    let n = *n;
    if !n.is_finite() {
        return serializer.serialize_none();
    }
    if n.fract() == 0.0 {
        // Negative zero compares equal to zero, so it lands here and prints as `0`, as JSON.stringify does.
        if (0.0..18_446_744_073_709_551_616.0).contains(&n) {
            return serializer.serialize_u64(n as u64);
        }
        if (-9_223_372_036_854_775_808.0..0.0).contains(&n) {
            return serializer.serialize_i64(n as i64);
        }
    }
    serializer.serialize_f64(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_numbers_like_javascript() {
        assert_eq!(number_string(0.0), "0");
        assert_eq!(number_string(-0.0), "0");
        assert_eq!(number_string(40.0), "40");
        assert_eq!(number_string(-3.0), "-3");
        assert_eq!(number_string(2.5), "2.5");
        assert_eq!(number_string(1e20), "100000000000000000000");
        assert_eq!(number_string(1e21), "1e+21");
        assert_eq!(number_string(1.5e300), "1.5e+300");
        assert_eq!(number_string(-2e21), "-2e+21");
        assert_eq!(number_string(f64::INFINITY), "Infinity");
        assert_eq!(number_string(f64::INFINITY - 1.0), "Infinity");
    }

    #[test]
    fn whitespace_follows_javascript() {
        assert!(is_space('\u{feff}'));
        assert!(is_space('\u{a0}'));
        assert!(is_space('\u{3000}'));
        assert!(!is_space('\u{85}'));
        assert!(!is_space('\u{200b}'));
        assert_eq!(trim("\u{feff} x\u{85}\u{2028}"), "x\u{85}");
    }
}
