// What the Inspector asks of the level, before it is tied to a revision and a thing
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The Inspector says what it wants (move here, face this way, delete); the editor screen, which
// holds the current level, names the thing and builds the `LevelEdit` Rust takes. That keeps the
// reference to the thing as fresh as the revision the edit is sent with, and lets a torn-off
// Inspector send the same request over the bridge.

import type { Facing } from '@liminal-hq/fizz-studio-protocol/generated/Facing';
import type { LevelEdit } from '@liminal-hq/fizz-studio-protocol/generated/LevelEdit';
import type { LevelView } from '@liminal-hq/fizz-studio-protocol/generated/LevelView';
import type { LevelError } from '@liminal-hq/fizz-studio-protocol/generated/LevelError';
import type { ThingRef } from '@liminal-hq/fizz-studio-protocol/generated/ThingRef';
import type { ViewSection } from '@liminal-hq/fizz-studio-protocol/generated/ViewSection';
import type { MessageId } from '../i18n/messages';
import { lockedProblem } from '../panels/layers/lockedNote';
import type { Thing } from '../tools/tool';

/** A change to the selected thing. */
export type ThingEditSpec =
	| { op: 'move'; x: number; y: number | null }
	| { op: 'face'; facing: Facing }
	| { op: 'delete' };

/**
 * What to ask of the level: a change, or a function that works the change out from the level as the
 * edit queue finds it when its turn comes (a nudge counts on from the one before it) and answers
 * null when there is nothing to do.
 */
export type ThingEditSource =
	| ThingEditSpec
	| ((view: LevelView, thing: Thing) => ThingEditSpec | null);

/** Why a change was not made, as a catalogue message or, for Rust's own words, plain text. */
export type EditProblem =
	| { id: MessageId; values?: Record<string, string | number> }
	| { text: string };

/** What the Inspector hears back about a change it asked for. */
export type ThingEditResult = { ok: true } | { ok: false; problem: EditProblem };

/** What the Inspector asks to change the thing, and to end the undo step a run of changes made. */
export interface ThingEditApi {
	apply(spec: ThingEditSpec, mergeKey: string): Promise<ThingEditResult>;
	endStep(): void;
}

/** The `LevelEdit` for `spec` on the thing `ref` names. */
export function buildEdit(spec: ThingEditSpec, ref: ThingRef): LevelEdit {
	if (spec.op === 'move') return { kind: 'move-thing', thing: ref, x: spec.x, y: spec.y };
	if (spec.op === 'face') return { kind: 'face-thing', thing: ref, facing: spec.facing };
	return { kind: 'delete-thing', thing: ref };
}

/**
 * The key a run of moves of one thing shares, so they become one undo step. `burst` changes when a
 * run ends, so a later run on the same thing is a step of its own.
 */
export function moveKey(thing: Thing, burst: number): string {
	return `thing:${thing.kind}:${thing.index}:move:${burst}`;
}

/** The problem to show for a refused change. */
export function editProblem(error: unknown, sections: readonly ViewSection[]): EditProblem {
	const refusal = error as Partial<LevelError> | null;
	switch (refusal?.kind) {
		case 'locked':
			return lockedProblem(refusal.layers ?? [], sections);
		case 'gone':
			return { id: 'inspector.gone' };
		case 'invalid':
			return { text: refusal.message ?? '' };
		case 'stale':
			return { id: 'editor.stale' };
		default:
			return { id: 'editor.failed' };
	}
}
