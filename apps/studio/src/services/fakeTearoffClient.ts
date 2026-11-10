// A tear-off client for tests: scripted features and reports, with every call recorded
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	NO_TEAROFF,
	type BeginResult,
	type DragHover,
	type DragLeave,
	type DropReport,
	type Hit,
	type PanelDragPayload,
	type PayloadDropped,
	type Point,
	type Region,
	type Size,
	type TearoffClient,
	type TearoffFeatures,
	type ToplevelBeginReport,
	type ToplevelDragEnded,
	type ToplevelDragStarted,
} from './tearoffClient';

export interface FakeTearoff extends TearoffClient {
	/** What the next calls answer; change them between steps. */
	features_: TearoffFeatures;
	beginResult: BeginResult;
	toplevelResult: ToplevelBeginReport;
	dropReport: DropReport;
	hit: Hit | null;
	/** Every call, in order, as `name` or `name:argument`. */
	calls: string[];
	begun: { payload: PanelDragPayload; grabOffset: Point; size: Size }[];
	updates: PanelDragPayload[];
	ended: ('drop' | 'cancel')[];
	regions: Region[][];
	toplevel: { payload: PanelDragPayload; label: string; grabOffset: Point }[];
	/** Sends an event to what listens. */
	emit: {
		timeout(): void;
		stale(stale: boolean): void;
		toplevelStarted(started: ToplevelDragStarted): void;
		toplevelEnded(ended: ToplevelDragEnded): void;
		dropped(dropped: PayloadDropped): void;
		hover(hover: DragHover): void;
		leave(leave: DragLeave): void;
	};
}

/** A fake with every feature off; set `features_` for the system under test. */
export function createFakeTearoff(features: Partial<TearoffFeatures> = {}): FakeTearoff {
	const listeners = {
		timeout: new Set<() => void>(),
		stale: new Set<(stale: boolean) => void>(),
		started: new Set<(started: ToplevelDragStarted) => void>(),
		ended: new Set<(ended: ToplevelDragEnded) => void>(),
		dropped: new Set<(dropped: PayloadDropped) => void>(),
		hover: new Set<(hover: DragHover) => void>(),
		leave: new Set<(leave: DragLeave) => void>(),
	};
	function add<T>(set: Set<T>, listener: T) {
		set.add(listener);
		return () => {
			set.delete(listener);
		};
	}
	const fake: FakeTearoff = {
		features_: { ...NO_TEAROFF, ...features },
		beginResult: 'following',
		toplevelResult: { state: 'started', reason: null },
		dropReport: { cursor: null, scaleFactor: 1, cursorStale: false, hit: null },
		hit: null,
		calls: [],
		begun: [],
		updates: [],
		ended: [],
		regions: [],
		toplevel: [],
		features: async () => fake.features_,
		begin: async (payload, grabOffset, size) => {
			fake.calls.push('begin');
			fake.begun.push({ payload, grabOffset, size });
			return fake.beginResult;
		},
		update: async (payload) => {
			fake.calls.push('update');
			fake.updates.push(payload);
		},
		end: async (outcome) => {
			fake.calls.push(`end:${outcome}`);
			fake.ended.push(outcome);
			return outcome === 'cancel' ? { ...fake.dropReport, hit: null } : fake.dropReport;
		},
		hitTest: async () => {
			fake.calls.push('hitTest');
			return fake.hit;
		},
		setDropRegions: async (regions) => {
			fake.calls.push('setDropRegions');
			fake.regions.push(regions);
		},
		onTimeout: (listener) => add(listeners.timeout, listener),
		onCursorStale: (listener) => add(listeners.stale, listener),
		beginToplevelDrag: async (payload, label, grabOffset) => {
			fake.calls.push(`beginToplevelDrag:${label}`);
			fake.toplevel.push({ payload, label, grabOffset });
			return fake.toplevelResult;
		},
		endToplevelDrag: async () => {
			fake.calls.push('endToplevelDrag');
		},
		onToplevelStarted: (listener) => add(listeners.started, listener),
		onToplevelEnded: (listener) => add(listeners.ended, listener),
		onPayloadDropped: (listener) => add(listeners.dropped, listener),
		onDragHover: (listener) => add(listeners.hover, listener),
		onDragLeave: (listener) => add(listeners.leave, listener),
		emit: {
			timeout: () => listeners.timeout.forEach((l) => l()),
			stale: (stale) => listeners.stale.forEach((l) => l(stale)),
			toplevelStarted: (started) => listeners.started.forEach((l) => l(started)),
			toplevelEnded: (ended) => listeners.ended.forEach((l) => l(ended)),
			dropped: (dropped) => listeners.dropped.forEach((l) => l(dropped)),
			hover: (hover) => listeners.hover.forEach((l) => l(hover)),
			leave: (leave) => listeners.leave.forEach((l) => l(leave)),
		},
	};
	return fake;
}
