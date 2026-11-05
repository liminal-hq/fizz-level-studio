// Tests for the host plugin's commands
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::sync::{Arc, Mutex};

use fizz_studio_host::stream::StreamMessage;
use fizz_studio_protocol::HostCapability;
use tauri::ipc::{Channel, InvokeResponseBody};

use crate::commands::{host_status, host_stream_synthetic};

#[test]
fn the_host_says_it_cannot_draw_or_step_yet() {
    let status = host_status();
    assert_eq!(status.draw, HostCapability::NotAvailable);
    assert_eq!(status.step, HostCapability::NotRun);
}

/// The raw messages a channel has received, in order.
type Received = Arc<Mutex<Vec<Vec<u8>>>>;

fn collecting_channel() -> (Channel<InvokeResponseBody>, Received) {
    let received = Arc::new(Mutex::new(Vec::new()));
    let sink = received.clone();
    let channel = Channel::new(move |body| {
        if let InvokeResponseBody::Raw(bytes) = body {
            sink.lock().unwrap().push(bytes);
        }
        Ok(())
    });
    (channel, received)
}

#[test]
fn a_stream_sends_each_changed_frame_as_raw_bytes_in_order() {
    let (channel, received) = collecting_channel();
    let summary =
        tauri::async_runtime::block_on(host_stream_synthetic(6, 240, 2, channel)).expect("streams");
    assert_eq!(summary.produced, 6);
    assert_eq!(summary.sent, 6);
    let received = received.lock().unwrap();
    assert_eq!(received.len(), 6);
    assert_eq!(
        summary.bytes,
        received.iter().map(|b| b.len() as u64).sum::<u64>()
    );
    let messages: Vec<StreamMessage> = received
        .iter()
        .map(|bytes| StreamMessage::from_bytes(bytes).expect("a whole message"))
        .collect();
    let revisions: Vec<u64> = messages.iter().map(|m| m.revision).collect();
    assert_eq!(revisions, vec![0, 1, 2, 3, 4, 5]);
    let palettes: Vec<bool> = messages.iter().map(|m| m.palette.is_some()).collect();
    assert_eq!(palettes, vec![true, false, true, false, true, false]);
    assert!(messages.iter().all(|m| m.pixels.len() == 64_000));
}

#[test]
fn a_stream_keeps_to_its_pace() {
    let (channel, _received) = collecting_channel();
    let started = std::time::Instant::now();
    tauri::async_runtime::block_on(host_stream_synthetic(31, 60, 0, channel)).expect("streams");
    // 30 intervals of 1/60 s: about half a second, never much faster.
    assert!(started.elapsed() >= std::time::Duration::from_millis(450));
}

#[test]
fn a_frame_rate_outside_the_range_is_refused() {
    for fps in [0, 241] {
        let (channel, received) = collecting_channel();
        let result = tauri::async_runtime::block_on(host_stream_synthetic(3, fps, 0, channel));
        assert!(result.is_err(), "fps {fps}");
        assert!(received.lock().unwrap().is_empty());
    }
}
