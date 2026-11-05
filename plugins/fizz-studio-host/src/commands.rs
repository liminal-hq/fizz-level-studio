// The plugin's commands: what the host can do, and a paced synthetic frame stream
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::time::{Duration, Instant};

use fizz_studio_host::stream::FrameEncoder;
use fizz_studio_host::stub::{FlatFallbackHost, SyntheticFrames};
use fizz_studio_host::{DrawRequest, GameHost, HostAnswer};
use fizz_studio_protocol::{HostCapability, HostStatus, StreamSummary};
use tauri::ipc::{Channel, InvokeResponseBody};

/// What the host can draw and run today. The Fizz 2 games are not linked yet, so the answer is the
/// flat fallback's: nothing is drawn by the game and nothing is stepped.
#[tauri::command]
pub fn host_status() -> HostStatus {
    let mut host = FlatFallbackHost;
    let draw = match host.draw(&DrawRequest {
        revision: 0,
        width: 320,
        height: 200,
    }) {
        HostAnswer::Result(_) => HostCapability::Available,
        HostAnswer::NotAvailable => HostCapability::NotAvailable,
        HostAnswer::NotRun => HostCapability::NotRun,
    };
    let step = match host.step() {
        HostAnswer::Result(_) => HostCapability::Available,
        HostAnswer::NotAvailable => HostCapability::NotAvailable,
        HostAnswer::NotRun => HostCapability::NotRun,
    };
    HostStatus { draw, step }
}

/// Streams `frames` synthetic 320 by 200 indexed frames at `fps` over `on_frame`, as raw bytes in
/// the wire format of `fizz_studio_host::stream::StreamMessage`, for measuring the stream (Q43).
/// The palette changes every `palette_every` frames (0 means never); a frame that did not change is
/// not sent. The frames are test data and look nothing like the game's.
///
/// The command is `async` on purpose, and the pacing runs on a blocking thread so the sleeps never
/// hold the async runtime.
#[tauri::command]
pub async fn host_stream_synthetic(
    frames: u32,
    fps: u32,
    palette_every: u64,
    on_frame: Channel<InvokeResponseBody>,
) -> Result<StreamSummary, String> {
    if fps == 0 || fps > 240 {
        return Err("fps must be between 1 and 240".to_owned());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let interval = Duration::from_secs_f64(1.0 / f64::from(fps));
        let start = Instant::now();
        let mut source = SyntheticFrames::new(320, 200, palette_every);
        let mut encoder = FrameEncoder::new();
        let mut summary = StreamSummary {
            sent: 0,
            produced: 0,
            bytes: 0,
        };
        for n in 0..frames {
            let due = start + interval * n;
            if let Some(wait) = due.checked_duration_since(Instant::now()) {
                std::thread::sleep(wait);
            }
            let frame = source.next().expect("the synthetic source never ends");
            summary.produced += 1;
            if let Some(message) = encoder.encode(u64::from(n), &frame) {
                let bytes = message.to_bytes().map_err(|e| e.to_string())?;
                summary.bytes += bytes.len() as u64;
                on_frame
                    .send(InvokeResponseBody::Raw(bytes))
                    .map_err(|e| e.to_string())?;
                summary.sent += 1;
            }
        }
        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}
