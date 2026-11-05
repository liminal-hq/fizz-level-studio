// Settings writes that wait on a pause, which a window flushes before it closes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A hook that debounces a settings write registers a flush here for as long as it is mounted. The
// quit round's commit (and a window that answers ready) awaits `flushPendingWrites`, so a change
// made just before closing reaches Rust before the window or the app goes away.

const flushes = new Set<() => Promise<void>>();

/** Registers a flush; returns the function that unregisters it. */
export function registerFlush(flush: () => Promise<void>): () => void {
	flushes.add(flush);
	return () => {
		flushes.delete(flush);
	};
}

/** Writes every pending change now; a failed write never stops the others or the close. */
export async function flushPendingWrites(): Promise<void> {
	await Promise.all(
		[...flushes].map((flush) =>
			flush().then(
				() => {},
				() => {},
			),
		),
	);
}
