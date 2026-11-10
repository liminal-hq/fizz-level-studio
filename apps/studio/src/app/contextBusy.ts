// The mark a surface sets while a stroke, a pan or a drag owns the pointer, so no context menu opens over it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** The attribute a surface sets, on any element, while a stroke, a pan or a drag is going; the host opens nothing until it clears. */
export const CONTEXT_BUSY = 'data-context-busy';

/** True while something that owns the pointer is running. */
export function isContextBusy(): boolean {
	return document.querySelector(`[${CONTEXT_BUSY}]`) !== null;
}
