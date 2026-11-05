// Encoding frames for the webview: send only what changed, tagged with the revision
//
// A frame crosses to the webview over a `Channel` as raw bytes. The palette is sent only when it
// changes, a frame is sent only when its pixels change, and each message carries the revision it
// was drawn from so the canvas can drop a stale frame (Q43).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::Frame;

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
