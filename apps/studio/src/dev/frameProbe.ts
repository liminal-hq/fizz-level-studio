// A developer probe that measures the frame stream: arrival spacing, decode time, and draw time
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Run it with `VITE_FIZZ_PROBE=frames bun run tauri:dev`. It streams synthetic 320 by 200 frames
// from the host at 60 frames per second, expands each to RGBA through its palette, draws it to a
// canvas, and logs one summary line (which the logger forwards into the log file). It exists to
// answer Q43 with a measurement on the real webview, so it is never started in a release build.

import { streamSyntheticFrames, type FrameMessage } from '@liminal-hq/fizz-studio-plugin-host';

const FRAMES = 600;
const FPS = 60;

/** The `p`th percentile (0 to 1) of an unsorted list, by the nearest-rank method. */
export function percentile(values: number[], p: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
	return sorted[rank] ?? 0;
}

/** Turns indexed pixels into RGBA through a 256-colour palette of RGB triples. */
export function expandToRgba(
	pixels: Uint8Array,
	palette: Uint8Array,
	out: Uint8ClampedArray,
): void {
	for (let i = 0; i < pixels.length; i++) {
		const colour = (pixels[i] ?? 0) * 3;
		const at = i * 4;
		out[at] = palette[colour] ?? 0;
		out[at + 1] = palette[colour + 1] ?? 0;
		out[at + 2] = palette[colour + 2] ?? 0;
		out[at + 3] = 255;
	}
}

export async function runFrameProbe(): Promise<void> {
	const canvas = document.createElement('canvas');
	canvas.width = 320;
	canvas.height = 200;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('The probe needs a 2D canvas.');
	const image = context.createImageData(320, 200);
	let palette = new Uint8Array(768);
	const arrivals: number[] = [];
	const draws: number[] = [];
	let last = 0;
	let bytes = 0;

	const started = performance.now();
	const summary = await streamSyntheticFrames(
		{ frames: FRAMES, fps: FPS, paletteEvery: 30 },
		(frame: FrameMessage) => {
			const now = performance.now();
			if (last !== 0) arrivals.push(now - last);
			last = now;
			if (frame.palette) palette = new Uint8Array(frame.palette);
			bytes += frame.pixels.length + (frame.palette?.length ?? 0);
			const drawStart = performance.now();
			expandToRgba(frame.pixels, palette, image.data);
			context.putImageData(image, 0, 0);
			draws.push(performance.now() - drawStart);
		},
	);
	const elapsed = (performance.now() - started) / 1000;
	const fixed = (n: number) => n.toFixed(2);
	console.info(
		`frame probe: ${summary.sent}/${summary.produced} frames, ${bytes} bytes, ` +
			`${fixed(summary.sent / elapsed)} fps achieved over ${fixed(elapsed)} s; ` +
			`arrival gap ms p50 ${fixed(percentile(arrivals, 0.5))} p95 ${fixed(percentile(arrivals, 0.95))} ` +
			`max ${fixed(Math.max(...arrivals))}; ` +
			`decode and draw ms p50 ${fixed(percentile(draws, 0.5))} p95 ${fixed(percentile(draws, 0.95))} ` +
			`max ${fixed(Math.max(...draws))}`,
	);
}
