// What the game host can do and what a frame stream reports
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Whether the host can do one thing, said honestly: a host never pretends.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum HostCapability {
    /// The host can do it now.
    Available,
    /// The game cannot do this at all yet; the canvas shows its flat fallback.
    NotAvailable,
    /// The game could do this, but it has not been run.
    NotRun,
}

/// What the game host can draw and run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct HostStatus {
    /// Drawing a level as the game does.
    pub draw: HostCapability,
    /// Stepping a world.
    pub step: HostCapability,
}

/// What a finished synthetic frame stream sent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct StreamSummary {
    /// Messages sent: a frame that did not change is not sent.
    pub sent: u32,
    /// Frames produced.
    pub produced: u32,
    /// Bytes sent, headers included.
    pub bytes: u64,
}
