// The host's contract: honest answers, and a stream that sends only what changed
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_host::stream::FrameEncoder;
use fizz_studio_host::stub::{FlatFallbackHost, SyntheticFrames};
use fizz_studio_host::{DrawRequest, GameHost, HostAnswer};

/// What every `GameHost` must do: answer, never panic, never pretend.
fn contract<H: GameHost>(host: &mut H) {
    let request = DrawRequest {
        revision: 7,
        width: 320,
        height: 200,
    };
    match host.draw(&request) {
        HostAnswer::Result(frame) => {
            assert_eq!(
                usize::from(frame.width) * usize::from(frame.height),
                frame.pixels.len()
            );
        }
        HostAnswer::NotAvailable | HostAnswer::NotRun => {}
    }
    let _ = host.step();
}

#[test]
fn the_flat_fallback_says_it_cannot_draw_or_step() {
    let mut host = FlatFallbackHost;
    contract(&mut host);
    let request = DrawRequest {
        revision: 1,
        width: 320,
        height: 200,
    };
    assert_eq!(host.draw(&request), HostAnswer::NotAvailable);
    assert_eq!(host.step(), HostAnswer::NotRun);
}

#[test]
fn synthetic_frames_are_320_by_200_indexed_and_scroll() {
    let mut frames = SyntheticFrames::new(320, 200, 0);
    let a = frames.next().unwrap();
    let b = frames.next().unwrap();
    assert_eq!(a.pixels.len(), 64_000);
    assert_eq!(a.palette.len(), 256);
    assert_ne!(a.pixels, b.pixels);
    assert_eq!(a.palette, b.palette);
}

#[test]
fn the_encoder_sends_the_palette_only_when_it_changes() {
    let mut frames = SyntheticFrames::new(320, 200, 2);
    let mut encoder = FrameEncoder::new();
    let sent: Vec<_> = (0..4)
        .map(|i| encoder.encode(i, &frames.next().unwrap()).unwrap())
        .collect();
    let palette_flags: Vec<bool> = sent.iter().map(|m| m.palette.is_some()).collect();
    assert_eq!(palette_flags, vec![true, false, true, false]);
    assert_eq!(sent[1].byte_len(), 64_000);
    assert_eq!(sent[0].byte_len(), 64_000 + 768);
    assert_eq!(sent[3].revision, 3);
}

#[test]
fn the_encoder_skips_a_frame_that_has_not_changed() {
    let frame = SyntheticFrames::new(8, 8, 0).next().unwrap();
    let mut encoder = FrameEncoder::new();
    assert!(encoder.encode(1, &frame).is_some());
    assert!(encoder.encode(2, &frame).is_none());
}
