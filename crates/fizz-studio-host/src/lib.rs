// The game host: draw a frame and step a world, behind a trait
//
// Pure Rust with no Tauri. Each game gets an implementation (D59); `stub` answers honestly until
// the Fizz 2 draw and step APIs exist (F5, F6).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod stream;
pub mod stub;

/// What a host says when asked for something.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostAnswer<T> {
    /// The game produced a result.
    Result(T),
    /// The game cannot do this at all yet; the capability is not available.
    NotAvailable,
    /// The game could do this, but it has not been run.
    NotRun,
}

/// An indexed 8-bit frame, as the game draws it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub width: u16,
    pub height: u16,
    /// One palette index per pixel, row by row, top row first.
    pub pixels: Vec<u8>,
    /// The palette in force for this frame, as RGB triples.
    pub palette: Vec<[u8; 3]>,
}

/// What to draw.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DrawRequest {
    /// The revision of the script the frame is drawn from.
    pub revision: u64,
    pub width: u16,
    pub height: u16,
}

/// What a step reports.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepReport {
    pub tick: u64,
}

/// Draws and steps a game.
pub trait GameHost {
    /// Draws the level as the game would.
    fn draw(&self, request: &DrawRequest) -> HostAnswer<Frame>;
    /// Steps the world one tick.
    fn step(&mut self) -> HostAnswer<StepReport>;
}
