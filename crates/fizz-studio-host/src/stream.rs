// Encoding frames for the webview: send only what changed, tagged with the revision
//
// A frame crosses to the webview over a `Channel` as raw bytes. The palette is sent only when it
// changes, a frame is sent only when its pixels change, and each message carries the revision it
// was drawn from so the canvas can drop a stale frame (Q43).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::Frame;
use std::fmt;

/// One message on the frame channel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreamMessage {
    /// The revision of the script the frame was drawn from.
    pub revision: u64,
    pub width: u16,
    pub height: u16,
    /// The palette as RGB triples, only when it differs from the last one sent.
    pub palette: Option<Vec<[u8; 3]>>,
    pub pixels: Vec<u8>,
}

impl StreamMessage {
    /// The bytes this message carries across the channel.
    pub fn byte_len(&self) -> usize {
        self.pixels.len() + self.palette.as_ref().map_or(0, |p| p.len() * 3)
    }
}

/// Turns frames into messages, skipping a frame that has not changed.
#[derive(Debug, Default)]
pub struct FrameEncoder {
    last: Option<Frame>,
}

impl FrameEncoder {
    pub fn new() -> Self {
        Self::default()
    }

    /// The message for `frame`, or `None` when it equals the last one sent.
    pub fn encode(&mut self, revision: u64, frame: &Frame) -> Option<StreamMessage> {
        let (palette_changed, pixels_changed) = match &self.last {
            None => (true, true),
            Some(last) => (
                last.palette != frame.palette,
                last.pixels != frame.pixels
                    || last.width != frame.width
                    || last.height != frame.height,
            ),
        };
        if !palette_changed && !pixels_changed {
            return None;
        }
        self.last = Some(frame.clone());
        Some(StreamMessage {
            revision,
            width: frame.width,
            height: frame.height,
            palette: palette_changed.then(|| frame.palette.clone()),
            pixels: frame.pixels.clone(),
        })
    }
}

/// The bytes before the pixels: revision (8), width (2), height (2), flags (1).
const HEADER_LEN: usize = 13;
/// The flag bit that says a 256-colour palette follows the header.
const FLAG_PALETTE: u8 = 1;
/// A palette is 256 RGB triples.
const PALETTE_LEN: usize = 256 * 3;

/// Why bytes are not a stream message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WireError {
    /// Fewer bytes than the header, or than the header says follow.
    Truncated,
    /// The flags set a bit this version does not know.
    UnknownFlags(u8),
    /// A palette that is not 256 colours.
    BadPalette,
}

impl fmt::Display for WireError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WireError::Truncated => write!(f, "the frame message is shorter than it says"),
            WireError::UnknownFlags(flags) => {
                write!(f, "the frame message sets unknown flags {flags:#04x}")
            }
            WireError::BadPalette => {
                write!(f, "the frame message has a palette that is not 256 colours")
            }
        }
    }
}

impl std::error::Error for WireError {}

impl StreamMessage {
    /// The message as bytes for a raw `Channel`: little-endian revision, width, height, a flags
    /// byte, the palette (768 bytes) when the flag is set, then the pixels.
    pub fn to_bytes(&self) -> Result<Vec<u8>, WireError> {
        if let Some(palette) = &self.palette {
            if palette.len() != 256 {
                return Err(WireError::BadPalette);
            }
        }
        let mut out = Vec::with_capacity(HEADER_LEN + self.byte_len());
        out.extend_from_slice(&self.revision.to_le_bytes());
        out.extend_from_slice(&self.width.to_le_bytes());
        out.extend_from_slice(&self.height.to_le_bytes());
        out.push(if self.palette.is_some() {
            FLAG_PALETTE
        } else {
            0
        });
        if let Some(palette) = &self.palette {
            for rgb in palette {
                out.extend_from_slice(rgb);
            }
        }
        out.extend_from_slice(&self.pixels);
        Ok(out)
    }

    /// Reads a message back from `to_bytes`.
    pub fn from_bytes(bytes: &[u8]) -> Result<StreamMessage, WireError> {
        if bytes.len() < HEADER_LEN {
            return Err(WireError::Truncated);
        }
        let revision = u64::from_le_bytes(bytes[0..8].try_into().expect("8 bytes"));
        let width = u16::from_le_bytes(bytes[8..10].try_into().expect("2 bytes"));
        let height = u16::from_le_bytes(bytes[10..12].try_into().expect("2 bytes"));
        let flags = bytes[12];
        if flags & !FLAG_PALETTE != 0 {
            return Err(WireError::UnknownFlags(flags));
        }
        let mut at = HEADER_LEN;
        let palette = if flags & FLAG_PALETTE != 0 {
            let end = at + PALETTE_LEN;
            let raw = bytes.get(at..end).ok_or(WireError::Truncated)?;
            at = end;
            Some(raw.as_chunks::<3>().0.to_vec())
        } else {
            None
        };
        let pixel_len = usize::from(width) * usize::from(height);
        let pixels = bytes.get(at..at + pixel_len).ok_or(WireError::Truncated)?;
        Ok(StreamMessage {
            revision,
            width,
            height,
            palette,
            pixels: pixels.to_vec(),
        })
    }
}
