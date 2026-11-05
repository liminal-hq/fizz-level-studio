// Measures a paint stroke from the command being sent to the canvas redrawing, in the running app
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Build the debug app first (`bun run app:build`), then `bun run check:perf`. Each stroke sends the
// same two commands the editor sends (a paint, then the end of the step) over the real IPC, and the
// page is hooked to stamp every canvas redraw. A stroke's time is from sending the paint to the
// first redraw after it, on an otherwise idle page, so it covers Rust applying the edit, the answer
// crossing IPC, React rendering and the canvas drawing. It does not cover the pointer event
// reaching the handler (microseconds) or the compositor putting the frame on screen (up to one
// refresh). Synthetic and X11 pointer input did not reach the canvas's handlers under the bridge, so
// the strokes are commands, not mouse movements. R-PERF-01 asks for at most 16 ms at the 95th
// percentile on Marshmallow Meadows. A debug build is slower than a release build, so the figure is
// a ceiling.

import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { App, Bridge, binary, makeProfile, root, within } from './driver';

const STROKES = Number(process.env.STROKES ?? 220);
const WARM_UP = 20;
const BUDGET_MS = 16;
/** Longest to wait for a redraw before a stroke counts as unanswered. */
const GIVE_UP_MS = 1000;
const BATCH_SIZE = 30;

/** Hooks the page once and opens the level; returns the session's id and revision. */
const SETUP = (path: string) => `
	const draws = [];
	window.__draws = draws;
	const fill = CanvasRenderingContext2D.prototype.fillRect;
	CanvasRenderingContext2D.prototype.fillRect = function (...a) {
		if (a[0] === 0 && a[1] === 0) draws.push(performance.now());
		return fill.apply(this, a);
	};
	const snapshot = await window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-worlds|level_open', { path: ${JSON.stringify(path)} });
	return { id: snapshot.id, revision: String(snapshot.revision) };
`;

/** Runs strokes `from` to `to` in the page (the bridge limits how long one script may run). */
const BATCH = (id: string, revision: string, from: number, to: number) => `
	const invoke = (command, args) =>
		window.__TAURI_INTERNALS__.invoke('plugin:fizz-studio-worlds|' + command, args);
	const draws = window.__draws;
	const wait = (ms) => new Promise((done) => setTimeout(done, ms));
	let revision = Number(${JSON.stringify(revision)});
	const times = [];
	let unanswered = 0;
	for (let i = ${from}; i < ${to}; i++) {
		await wait(40);
		draws.length = 0;
		const sent = performance.now();
		const row = 20 + (i % 5);
		const snapshot = await invoke('level_apply', {
			id: ${JSON.stringify(id)},
			edit: { kind: 'paint', tile: 'fill', x: [[i % 200, i % 200]], y: [[row, row]] },
			basedOn: revision,
			mergeKey: 'stroke-' + i,
		});
		revision = snapshot.revision;
		let waited = 0;
		while (draws.length === 0 && waited++ < ${GIVE_UP_MS}) await wait(1);
		if (draws.length === 0) { unanswered += 1; continue; }
		times.push(draws[0] - sent);
		await invoke('level_end_step', { id: ${JSON.stringify(id)} });
	}
	return { times, unanswered, revision: String(revision) };
`;

function percentile(sorted: number[], p: number): number {
	return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

async function main(): Promise<void> {
	if (!existsSync(binary)) {
		console.error(`No debug build at ${binary}. Run \`bun run app:build\` first.`);
		process.exit(2);
	}
	const profile = makeProfile();
	const path = join(profile.dir, 'marshmallow-meadows.fizz');
	copyFileSync(join(root, 'levels/real/marshmallow-meadows.fizz'), path);
	const bridge = await Bridge.connect();
	let app: App | undefined;
	try {
		app = new App(profile, [path]);
		await bridge.start();
		if (!(await bridge.ready())) throw new Error('the app did not become ready');
		const shown = await within(10_000, () =>
			bridge.js<boolean>(`return document.querySelector('canvas') !== null;`).catch(() => false),
		);
		if (shown === null) throw new Error('the level did not open');
		const session = await bridge.js<{ id: string; revision: string }>(SETUP(path));
		const all: number[] = [];
		let unanswered = 0;
		let revision = session.revision;
		for (let from = 0; from < STROKES; from += BATCH_SIZE) {
			const done = await bridge.js<{ times: number[]; unanswered: number; revision: string }>(
				BATCH(session.id, revision, from, Math.min(STROKES, from + BATCH_SIZE)),
				'main-1',
				30_000,
			);
			all.push(...done.times);
			unanswered += done.unanswered;
			revision = done.revision;
		}
		const result = { times: all, unanswered };
		const times = result.times.slice(WARM_UP).sort((a, b) => a - b);
		if (times.length < 20) throw new Error(`only ${times.length} strokes were answered`);
		const p50 = percentile(times, 50);
		const p95 = percentile(times, 95);
		const max = times[times.length - 1] ?? 0;
		console.log(
			`paint stroke, command sent to canvas redraw, Marshmallow Meadows, ${times.length} strokes (debug build, ${result.unanswered} unanswered)`,
		);
		console.log(`p50 ${p50.toFixed(1)} ms   p95 ${p95.toFixed(1)} ms   max ${max.toFixed(1)} ms`);
		console.log(`machine: ${cpus()[0]?.model ?? 'unknown'}, ${cpus().length} threads`);
		console.log(`${p95 <= BUDGET_MS ? 'PASS' : 'FAIL'}  p95 within ${BUDGET_MS} ms`);
		process.exitCode = p95 <= BUDGET_MS ? 0 : 1;
	} finally {
		await bridge.close();
		await app?.quit();
		rmSync(profile.dir, { recursive: true, force: true });
	}
}

await main();
