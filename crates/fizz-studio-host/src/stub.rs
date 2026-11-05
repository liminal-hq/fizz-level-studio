// The flat fallback host and a synthetic frame source
//
// Stands in for F5 (the draw API) and F6 (world stepping) until `fizz-slice-view` and `fizz-ep2`
// are linked natively. `FlatFallbackHost` never invents a frame or a result. `SyntheticFrames`
// makes test frames for measuring the stream (Q43) only; they look nothing like the game's.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::{DrawRequest, Frame, GameHost, HostAnswer, StepReport};

/// A host that cannot draw or step, so the canvas shows its flat fallback with a banner.
#[derive(Debug, Default, Clone, Copy)]
pub struct FlatFallbackHost;

impl GameHost for FlatFallbackHost {
    fn draw(&self, _request: &DrawRequest) -> HostAnswer<Frame> {
        HostAnswer::NotAvailable
    }

    fn step(&mut self) -> HostAnswer<StepReport> {
        HostAnswer::NotRun
    }
}

/// Made-up 8-bit frames of a given size: a diagonal gradient that scrolls by one pixel per frame.
#[derive(Debug, Clone)]
pub struct SyntheticFrames {
    width: u16,
    height: u16,
    tick: u64,
    /// The palette changes every `palette_every` frames; 0 means never.
    palette_every: u64,
}

impl SyntheticFrames {
    pub fn new(width: u16, height: u16, palette_every: u64) -> Self {
        Self {
            width,
            height,
            tick: 0,
            palette_every,
        }
    }

    fn palette(&self) -> Vec<[u8; 3]> {
        let shift = self.tick.checked_div(self.palette_every).unwrap_or(0) as u8;
        (0..=255u8)
            .map(|i| [i.wrapping_add(shift), i, 255 - i])
            .collect()
    }
}

impl Iterator for SyntheticFrames {
    type Item = Frame;

    fn next(&mut self) -> Option<Frame> {
        let (w, h) = (usize::from(self.width), usize::from(self.height));
        let shift = self.tick as usize;
        let mut pixels = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                pixels.push(((x + y + shift) % 256) as u8);
            }
        }
        let frame = Frame {
            width: self.width,
            height: self.height,
            pixels,
            palette: self.palette(),
        };
        self.tick += 1;
        Some(frame)
    }
}
