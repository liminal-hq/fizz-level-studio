// Exposes typed guest-side wrappers for the fizz-studio-host plugin
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { HostStatus } from '@liminal-hq/fizz-studio-protocol/generated/HostStatus';
import type { StreamSummary } from '@liminal-hq/fizz-studio-protocol/generated/StreamSummary';
import { Channel, invoke } from '@tauri-apps/api/core';

const PREFIX = 'plugin:fizz-studio-host|';

/** What the game host can draw and run. */
export function getHostStatus(): Promise<HostStatus> {
	return invoke<HostStatus>(`${PREFIX}host_status`);
}

/** One frame message: the revision, the size, the palette when it changed, and the indexed pixels. */
export interface FrameMessage {
	revision: bigint;
	width: number;
	height: number;
	palette: Uint8Array | null;
	pixels: Uint8Array;
}

const HEADER_LENGTH = 13;
const FLAG_PALETTE = 1;
const PALETTE_LENGTH = 256 * 3;

/**
 * Reads one message from the raw bytes the host sends (little-endian revision, width, height, a
 * flags byte, the 768-byte palette when the flag is set, then the pixels). Throws on bytes that are
 * not a whole message, never guessing.
 */
export function decodeFrame(buffer: ArrayBuffer): FrameMessage {
	if (buffer.byteLength < HEADER_LENGTH)
		throw new Error('The frame message is shorter than its header.');
	const view = new DataView(buffer);
	const revision = view.getBigUint64(0, true);
	const width = view.getUint16(8, true);
	const height = view.getUint16(10, true);
	const flags = view.getUint8(12);
	if ((flags & ~FLAG_PALETTE) !== 0)
		throw new Error(`The frame message sets unknown flags ${flags}.`);
	let at = HEADER_LENGTH;
	let palette: Uint8Array | null = null;
	if ((flags & FLAG_PALETTE) !== 0) {
		if (buffer.byteLength < at + PALETTE_LENGTH)
			throw new Error('The frame message is shorter than its palette.');
		palette = new Uint8Array(buffer, at, PALETTE_LENGTH);
		at += PALETTE_LENGTH;
	}
	const pixelLength = width * height;
	if (buffer.byteLength < at + pixelLength)
		throw new Error('The frame message is shorter than its pixels.');
	return { revision, width, height, palette, pixels: new Uint8Array(buffer, at, pixelLength) };
}

export interface SyntheticStreamOptions {
	frames: number;
	fps: number;
	/** The palette changes every this many frames; 0 means never. */
	paletteEvery: number;
}

/**
 * Streams synthetic 320 by 200 indexed frames from the host, for measuring the stream. `onFrame`
 * gets each decoded message as it arrives; the promise resolves with what the host reports sending.
 * The frames are test data and look nothing like the game's.
 */
export function streamSyntheticFrames(
	options: SyntheticStreamOptions,
	onFrame: (frame: FrameMessage) => void,
): Promise<StreamSummary> {
	const channel = new Channel<ArrayBuffer>();
	channel.onmessage = (buffer) => onFrame(decodeFrame(buffer));
	return invoke<StreamSummary>(`${PREFIX}host_stream_synthetic`, {
		frames: options.frames,
		fps: options.fps,
		paletteEvery: options.paletteEvery,
		onFrame: channel,
	});
}
