// Which tooltip is showing: one for the whole window, so two never stack
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { tooltipDelay } from './tooltipModel';

/** The tooltip showing now: whose it is and the element it hangs from. */
export interface ActiveTooltip {
	id: string;
	anchor: HTMLElement;
}

type Listener = () => void;

let active: ActiveTooltip | null = null;
let closedAt = Number.NEGATIVE_INFINITY;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit() {
	for (const listener of [...listeners]) listener();
}

export function subscribeTooltip(listener: Listener): () => void {
	listeners.add(listener);
	return () => void listeners.delete(listener);
}

export function activeTooltip(): ActiveTooltip | null {
	return active;
}

function cancel() {
	if (timer !== null) clearTimeout(timer);
	timer = null;
}

/** Shows this trigger's tooltip after the pointer's rest (at once for `immediate`, as keyboard focus does). */
export function requestTooltip(next: ActiveTooltip, immediate = false): void {
	cancel();
	const delay = immediate ? 0 : tooltipDelay({ open: active !== null, closedAt, now: Date.now() });
	const open = () => {
		timer = null;
		if (!next.anchor.isConnected) return;
		active = next;
		emit();
	};
	if (delay <= 0) open();
	else timer = setTimeout(open, delay);
}

/** Hides the tooltip, or only the one with this id (a trigger leaving must not close its neighbour's). */
export function dismissTooltip(id?: string): void {
	if (id !== undefined && active?.id !== id) {
		// A tooltip waiting on its delay is cancelled by its own trigger leaving.
		if (active === null) cancel();
		return;
	}
	cancel();
	if (active) {
		closedAt = Date.now();
		active = null;
		emit();
	}
}

/** For tests: forgets everything. */
export function resetTooltips(): void {
	cancel();
	active = null;
	closedAt = Number.NEGATIVE_INFINITY;
}
